export interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  dates: {
    start: {
      localDate: string;
      localTime: string;
    };
  };
  _embedded?: {
    venues?: Array<{
      name: string;
      city: {
        name: string;
      };
      state: {
        name: string;
      };
    }>;
  };
}

export class TicketmasterService {
  private apiKey: string;
  private baseUrl = 'https://app.ticketmaster.com/discovery/v2';
  private openai: any;

  constructor(apiKey: string, openai?: any) {
    this.apiKey = apiKey;
    this.openai = openai;
  }

  async aiSearch(query: string, userCity?: string): Promise<{
    events: TicketmasterEvent[];
    searchParams: {
      city?: string;
      artist?: string;
      genre?: string;
      dateRange?: { startDate?: string; endDate?: string };
      keywords?: string[];
    };
    explanation: string;
  }> {
    try {
      // Use OpenAI to intelligently parse the query
      const searchParams = await this.parseQueryWithAI(query, userCity);
      console.log('🔍 AI Parsed Search Parameters:', searchParams);
      
      let events: TicketmasterEvent[] = [];
      
      // If searching for a specific artist, use attraction search first
      if (searchParams.artist) {
        console.log(`🎵 Searching for artist: ${searchParams.artist}`);
        
        // Step 1: Search for the artist/attraction
        const attractionUrl = `${this.baseUrl}/attractions.json?apikey=${this.apiKey}&keyword=${encodeURIComponent(searchParams.artist)}&classificationName=music`;
        console.log(`🔍 Attraction search URL: ${attractionUrl}`);
        
        const attractionResponse = await fetch(attractionUrl);
        if (attractionResponse.ok) {
          const attractionData = await attractionResponse.json();
          const attractions = attractionData._embedded?.attractions || [];
          console.log(`🎵 Found ${attractions.length} attractions for ${searchParams.artist}`);
          
          if (attractions.length > 0) {
            // Use the first attraction (most relevant)
            const attractionId = attractions[0].id;
            console.log(`🎵 Using attraction ID: ${attractionId}`);
            
            // Step 2: Search for events using the attraction ID
            let eventUrl = `${this.baseUrl}/events.json?apikey=${this.apiKey}&attractionId=${attractionId}&size=20`;
            
                                                          // Add location filter if specified
                        if (searchParams.city) {
                          const cityLower = searchParams.city.toLowerCase();
                          if (cityLower.includes('los angeles') || cityLower.includes('la') || cityLower.includes('costa mesa')) {
                            eventUrl += '&dmaId=324'; // Los Angeles DMA
                            console.log('🔍 Using LA DMA for regional search');
                          } else if (cityLower.includes('new york') || cityLower.includes('nyc')) {
                            eventUrl += '&dmaId=345'; // New York DMA
                            console.log('🔍 Using NYC DMA for regional search');
                          } else if (cityLower.includes('chicago')) {
                            eventUrl += '&dmaId=602'; // Chicago DMA
                            console.log('🔍 Using Chicago DMA for regional search');
                          } else if (cityLower.includes('las vegas') || cityLower.includes('vegas')) {
                            eventUrl += '&dmaId=839'; // Las Vegas DMA
                            console.log('🔍 Using Las Vegas DMA for regional search');
                          } else {
                            eventUrl += `&city=${encodeURIComponent(searchParams.city)}`;
                            console.log(`🔍 Using city parameter for: ${searchParams.city}`);
                          }
                        }
            
            // Always use current dates - start from today, end 1 month from now
            const now = new Date();
            const oneMonthFromNow = new Date(now);
            oneMonthFromNow.setMonth(now.getMonth() + 1);
            
            const startDate = now.toISOString().split('.')[0] + 'Z';
            const endDate = oneMonthFromNow.toISOString().split('.')[0] + 'Z';
            
            eventUrl += `&startDateTime=${encodeURIComponent(startDate)}`;
            eventUrl += `&endDateTime=${encodeURIComponent(endDate)}`;
            
            console.log(`🔍 Event search URL: ${eventUrl}`);
            
            const eventResponse = await fetch(eventUrl);
            if (eventResponse.ok) {
              const eventData = await eventResponse.json();
              events = eventData._embedded?.events || [];
              console.log(`🎵 Found ${events.length} events for ${searchParams.artist}`);
            }
          }
        }
      }
      
      // If no events found with attraction search, fall back to keyword search
      if (events.length === 0) {
        console.log('🔍 No events found with attraction search, trying keyword search...');
        const url = this.buildSearchUrl(searchParams);
        console.log('🔍 Fallback URL:', url);
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          events = data._embedded?.events || [];
          console.log(`🔍 Keyword search found: ${events.length} events`);
        }
      }
      
      return {
        events: events.slice(0, 5), // Limit to 5 events
        searchParams,
        explanation: events.length > 0 
          ? `Found ${events.length} events matching your search. Here are some upcoming shows:`
          : searchParams.artist 
            ? `I couldn't find any upcoming ${searchParams.artist} concerts in ${searchParams.city || 'the specified area'} right now. This could mean they don't have any scheduled shows in the next 6 months, or the shows might be in different cities.`
            : "I couldn't find any events matching your search criteria right now."
      };
    } catch (error) {
      console.error('Ticketmaster search error:', error);
      return {
        events: [],
        searchParams: {},
        explanation: "I'm having trouble searching for events right now. Please try again!"
      };
    }
  }

  private async parseQueryWithAI(query: string, userCity?: string): Promise<{
    city?: string;
    artist?: string;
    genre?: string;
    dateRange?: { startDate?: string; endDate?: string };
    keywords?: string[];
  }> {
    if (!this.openai) {
      // Fallback to basic parsing
      return this.basicParseQuery(query, userCity);
    }

    try {
      const prompt = `Analyze this event search query and extract search parameters for Ticketmaster API. Return ONLY a valid JSON object with these fields:

- city: the city mentioned (or use "${userCity || 'Los Angeles'}" if no city mentioned)
- artist: any artist, band, or performer name mentioned (e.g., "Taylor Swift", "The Weeknd", "Ludacris", "Drake", "Beyoncé")
- genre: music genre (rock, pop, hip hop, country, jazz, electronic, etc.)
- keywords: array of other relevant search terms

IMPORTANT: If an artist name is mentioned, extract it exactly as written (e.g., "Ludacris", "Drake", "Taylor Swift").
IMPORTANT: Do NOT include fields with "undefined" or "null" values.
IMPORTANT: Do NOT include dateRange - we handle dates automatically.

Query: "${query}"

Return ONLY the JSON object, no markdown formatting, no code blocks, no additional text.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      console.log(`🔍 Raw AI response: ${response}`);
      
      if (response) {
        try {
          // Clean up the response - remove markdown code blocks if present
          let cleanResponse = response;
          if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
          } else if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/^```\n/, '').replace(/\n```$/, '');
          }
          
          const parsed = JSON.parse(cleanResponse);
          console.log(`✅ Parsed AI response:`, parsed);
          return parsed;
        } catch (parseError) {
          console.error('Error parsing OpenAI response:', parseError);
          return this.basicParseQuery(query, userCity);
        }
      }
    } catch (error) {
      console.error('Error using OpenAI for query parsing:', error);
    }

    // Fallback to basic parsing
    return this.basicParseQuery(query, userCity);
  }

  private basicParseQuery(query: string, userCity?: string): {
    city?: string;
    artist?: string;
    genre?: string;
    dateRange?: { startDate?: string; endDate?: string };
    keywords?: string[];
  } {
    const lowerQuery = query.toLowerCase();
    const result: any = {};

    // Extract city - look for any city name in the query
    // Use pattern matching to extract city names from natural language
    const cityPatterns = [
      /(?:in|at|near|around) ([a-zA-Z\s]+)/i,
      /([a-zA-Z\s]+) (?:concerts?|shows?|events?)/i,
      /(?:concerts?|shows?|events?) (?:in|at|near) ([a-zA-Z\s]+)/i
    ];
    
    // First check if userCity is provided
    if (userCity) {
      result.city = userCity;
    } else {
      // Try to extract city from query patterns
      for (const pattern of cityPatterns) {
        const match = query.match(pattern);
        if (match) {
          const potentialCity = match[1];
          if (potentialCity && potentialCity.length > 2) {
            // Clean up the city name
            const cleanCity = potentialCity.trim();
            // Filter out common non-city words
            const nonCityWords = ['the', 'and', 'or', 'for', 'with', 'by', 'to', 'a', 'an', 'concerts', 'shows', 'events'];
            const words = cleanCity.split(' ');
            const cityWords = words.filter(word => !nonCityWords.includes(word.toLowerCase()) && word.length > 2);
            
            if (cityWords.length > 0) {
              result.city = cityWords.join(' ');
              console.log(`🏙️ Extracted city: ${result.city}`);
              break;
            }
          }
        }
      }
    }

    // Extract artist - look for any artist name in the query
    // Use pattern matching to extract artist names from natural language
    const artistPatterns = [
      /(concerts?|shows?|tickets?) (?:by|for|with) ([a-zA-Z\s]+)/i,
      /([a-zA-Z\s]+) (?:concert|show|performance|tour)/i,
      /(?:find|search|look for) ([a-zA-Z\s]+) (?:concert|show|performance)/i,
      /(?:i want to see|i want to watch) ([a-zA-Z\s]+)/i,
      /([a-zA-Z\s]+) (?:in|at|near) ([a-zA-Z\s]+)/i
    ];
    
    for (const pattern of artistPatterns) {
      const match = query.match(pattern);
      if (match) {
        const potentialArtist = match[1] || match[2];
        if (potentialArtist && potentialArtist.length > 2) {
          // Clean up the artist name
          const cleanArtist = potentialArtist.trim().toLowerCase();
          // Filter out common non-artist words
          const nonArtistWords = ['the', 'and', 'or', 'in', 'at', 'on', 'for', 'with', 'by', 'to', 'a', 'an', 'los', 'angeles', 'costa', 'mesa', 'new', 'york', 'chicago'];
          const words = cleanArtist.split(' ');
          const artistWords = words.filter(word => !nonArtistWords.includes(word) && word.length > 2);
          
          if (artistWords.length > 0) {
            result.artist = artistWords.join(' ');
            console.log(`🎵 Extracted artist: ${result.artist}`);
            break;
          }
        }
      }
    }

    // Extract genre
    const genres: { [key: string]: string } = {
      'rock': 'Rock',
      'jazz': 'Jazz', 
      'pop': 'Pop',
      'country': 'Country',
      'hip hop': 'Hip-Hop/Rap',
      'rap': 'Hip-Hop/Rap',
      'indie': 'Indie',
      'folk': 'Folk',
      'electronic': 'Electronic',
      'dance': 'Dance',
      'comedy': 'Comedy',
      'theater': 'Theater',
      'sports': 'Sports'
    };

    for (const [keyword, genre] of Object.entries(genres)) {
      if (lowerQuery.includes(keyword)) {
        result.genre = genre;
        break;
      }
    }

    // Extract date range - use longer range for artist searches
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // 6 months instead of 30 days
    
    // Format dates properly for Ticketmaster API (YYYY-MM-DDTHH:mm:ssZ)
    const startDate = now.toISOString().split('.')[0] + 'Z';
    const endDate = sixMonthsFromNow.toISOString().split('.')[0] + 'Z';
    
    result.dateRange = {
      startDate: startDate,
      endDate: endDate
    };

    return result;
  }

  private buildSearchUrl(searchParams: any): string {
    let url = `${this.baseUrl}/events.json?apikey=${this.apiKey}&size=50`; // Increased size to get more results
    
    // Add genre/classification filtering
    if (searchParams.genre) {
      // Map common genres to Ticketmaster classification names
      const genreMap: { [key: string]: string } = {
        'rock': 'rock',
        'pop': 'pop',
        'hip hop': 'hip-hop',
        'rap': 'hip-hop',
        'country': 'country',
        'jazz': 'jazz',
        'electronic': 'electronic',
        'dance': 'electronic',
        'indie': 'alternative',
        'folk': 'folk',
        'blues': 'blues',
        'r&b': 'r-n-b',
        'rnb': 'r-n-b'
      };
      
      const genre = searchParams.genre.toLowerCase();
      const classificationName = genreMap[genre] || 'music';
      url += `&classificationName=${classificationName}`;
      console.log(`🎵 Using genre classification: ${classificationName}`);
    } else {
      // Default to music if no specific genre
      url += '&classificationName=music';
    }
    
    // Add location filters - use DMA for better regional coverage
    if (searchParams.city) {
      // Use DMA for major cities, otherwise use city parameter
      const cityLower = searchParams.city.toLowerCase();
      
      // Use DMA for major cities, otherwise use city parameter for any city
      if (cityLower.includes('los angeles') || cityLower.includes('la') || cityLower.includes('costa mesa')) {
        url += '&dmaId=324'; // Los Angeles DMA
        console.log('🔍 Using LA DMA for regional search');
      } else if (cityLower.includes('new york') || cityLower.includes('nyc')) {
        url += '&dmaId=345'; // New York DMA
        console.log('🔍 Using NYC DMA for regional search');
      } else if (cityLower.includes('chicago')) {
        url += '&dmaId=602'; // Chicago DMA
        console.log('🔍 Using Chicago DMA for regional search');
      } else if (cityLower.includes('las vegas') || cityLower.includes('vegas')) {
        url += '&dmaId=839'; // Las Vegas DMA
        console.log('🔍 Using Las Vegas DMA for regional search');
      } else {
        // For ANY other city, use the city parameter directly
        url += `&city=${encodeURIComponent(searchParams.city)}`;
        console.log(`🔍 Using city parameter for: ${searchParams.city}`);
      }
    }
    
    // Add artist keyword search - use keyword parameter for better artist matching
    if (searchParams.artist) {
      // Use keyword parameter for artist name searches
      url += `&keyword=${encodeURIComponent(searchParams.artist)}`;
      
      // For artist-specific searches, also try to find the attraction ID
      // This can provide more precise results
      console.log(`🔍 Searching for artist: ${searchParams.artist}`);
    }
    
    // Always use current dates - start from today, end 1 month from now
    const now = new Date();
    const oneMonthFromNow = new Date(now);
    oneMonthFromNow.setMonth(now.getMonth() + 1);
    
    const startDate = now.toISOString().split('.')[0] + 'Z';
    const endDate = oneMonthFromNow.toISOString().split('.')[0] + 'Z';
    
    url += `&startDateTime=${encodeURIComponent(startDate)}`;
    url += `&endDateTime=${encodeURIComponent(endDate)}`;
    
    // Add sorting and filtering
    url += '&sort=date,asc';
    url += '&includeTBA=no';
    url += '&includeTBD=no';
    
    console.log(`🔍 Ticketmaster URL: ${url}`);
    
    return url;
  }

  formatEventsList(events: TicketmasterEvent[]): string {
    if (events.length === 0) {
      return "No events found.";
    }

    // Filter out SOLD OUT events only - don't filter by date since API already filters
    const availableEvents = events.filter(event => {
      const isNotSoldOut = !event.name.toLowerCase().includes('sold out');
      return isNotSoldOut;
    });

    if (availableEvents.length === 0) {
      return "No upcoming events found.";
    }

    return availableEvents.map((event, index) => {
      const venue = event._embedded?.venues?.[0];
      const venueName = venue ? venue.name : 'Venue TBA';
      
      // Use the exact date from the API without reformatting
      const date = event.dates.start.localDate;
      const formattedDate = new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      return `${event.name}, ${formattedDate}, ${venueName}`;
    }).join('\n');
  }
} 