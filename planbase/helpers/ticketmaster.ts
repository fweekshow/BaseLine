export interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  images: Array<{
    url: string;
    ratio: string;
  }>;
  dates: {
    start: {
      localDate: string;
      localTime: string;
      dateTime: string;
    };
    status: {
      code: string;
    };
  };
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      city: {
        name: string;
      };
      state: {
        name: string;
      };
      address: {
        line1: string;
      };
    }>;
    attractions?: Array<{
      name: string;
      type: string;
      url: string;
      externalLinks?: {
        youtube?: Array<{
          url: string;
        }>;
        twitter?: Array<{
          url: string;
        }>;
        wiki?: Array<{
          url: string;
        }>;
        facebook?: Array<{
          url: string;
        }>;
        spotify?: Array<{
          url: string;
        }>;
        instagram?: Array<{
          url: string;
        }>;
        homepage?: Array<{
          url: string;
        }>;
      };
    }>;
  };
  classifications: Array<{
    segment: {
      name: string;
    };
    genre?: {
      name: string;
    };
    subGenre?: {
      name: string;
    };
  }>;
}

interface TicketmasterResponse {
  _embedded: {
    events: TicketmasterEvent[];
  };
  _links: {
    next: {
      href: string;
    };
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export class TicketmasterService {
  private apiKey: string;
  private baseUrl = 'https://app.ticketmaster.com/discovery/v2';
  private openai: any; // Will be set from constructor
  private lastRequestTime = 0;
  private requestDelay = 200; // 200ms between requests to respect rate limits

  constructor(apiKey: string, openai?: any) {
    this.apiKey = apiKey;
    this.openai = openai;
  }

  async searchEventsByCity(city: string, limit: number = 10, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]> {
    try {
      // Build the URL with proper parameters according to Ticketmaster API docs
      let url = `${this.baseUrl}/events.json?apikey=${this.apiKey}&size=${limit}`;
      
      // Add city parameter
      url += `&city=${encodeURIComponent(city)}`;
      
      // Add date range if provided
      if (startDate) {
        // Format date as YYYY-MM-DDTHH:mm:ssZ (remove milliseconds)
        const startDateObj = new Date(startDate);
        const formattedStartDate = startDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&startDateTime=${encodeURIComponent(formattedStartDate)}`;
      }
      if (endDate) {
        // Format date as YYYY-MM-DDTHH:mm:ssZ (remove milliseconds)
        const endDateObj = new Date(endDate);
        const formattedEndDate = endDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&endDateTime=${encodeURIComponent(formattedEndDate)}`;
      }
      
      // Add additional parameters for better results
      url += '&sort=date,asc'; // Sort by date ascending
      url += '&includeTBA=no'; // Exclude TBA events
      url += '&includeTBD=no'; // Exclude TBD events
      
      console.log('Making Ticketmaster request to:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ticketmaster API error response:', errorText);
        throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
      }

      const data: TicketmasterResponse = await response.json();
      console.log(`Found ${data._embedded?.events?.length || 0} events for ${city}`);
      return data._embedded?.events || [];
    } catch (error) {
      console.error('Error fetching events from Ticketmaster:', error);
      return [];
    }
  }

  async searchWellnessEventsByCity(city: string, limit: number = 10, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]> {
    try {
      // Search for conferences and business events
      const conferenceClassifications = [
        'KZFzniwnSyZfZ7v7n1', // Business
        'KZFzniwnSyZfZ7v7nJ'  // Arts & Theater (includes some conferences)
      ];
      
      const classificationQuery = conferenceClassifications.join(',');
      
      const response = await fetch(
        `${this.baseUrl}/events.json?city=${encodeURIComponent(city)}&classificationId=${classificationQuery}&size=${limit}&apikey=${this.apiKey}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
      }

      const data: TicketmasterResponse = await response.json();
      return data._embedded?.events || [];
    } catch (error) {
      console.error('Error fetching conference events from Ticketmaster:', error);
      return [];
    }
  }

  async searchConcertsByCity(city: string, limit: number = 10, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]> {
    try {
      // Search specifically for music events
      const musicClassifications = [
        'KZFzniwnSyZfZ7v7n1', // Music
        'KZFzniwnSyZfZ7v7nJ'  // Arts & Theater (includes concerts)
      ];
      
      const classificationQuery = musicClassifications.join(',');
      
      let url = `${this.baseUrl}/events.json?city=${encodeURIComponent(city)}&classificationId=${classificationQuery}&size=${limit}&expand=attractions&apikey=${this.apiKey}`;
      
      if (startDate) {
        url += `&startDateTime=${startDate}`;
      }
      if (endDate) {
        url += `&endDateTime=${endDate}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
      }

      const data: TicketmasterResponse = await response.json();
      return data._embedded?.events || [];
    } catch (error) {
      console.error('Error fetching concerts from Ticketmaster:', error);
      return [];
    }
  }

  async searchArtistShows(artistName: string, limit: number = 10, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]> {
    try {
      // Build the URL with proper parameters according to Ticketmaster API docs
      let url = `${this.baseUrl}/events.json?apikey=${this.apiKey}&size=${limit}`;
      
      // Add keyword parameter for artist search
      url += `&keyword=${encodeURIComponent(artistName)}`;
      
      // Add date range if provided
      if (startDate) {
        // Format date as YYYY-MM-DDTHH:mm:ssZ (remove milliseconds)
        const startDateObj = new Date(startDate);
        const formattedStartDate = startDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&startDateTime=${encodeURIComponent(formattedStartDate)}`;
      }
      if (endDate) {
        // Format date as YYYY-MM-DDTHH:mm:ssZ (remove milliseconds)
        const endDateObj = new Date(endDate);
        const formattedEndDate = endDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&endDateTime=${encodeURIComponent(formattedEndDate)}`;
      }
      
      // Add additional parameters for better results
      url += '&sort=date,asc'; // Sort by date ascending
      url += '&includeTBA=no'; // Exclude TBA events
      url += '&includeTBD=no'; // Exclude TBD events
      
      console.log('Making Ticketmaster artist search request to:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ticketmaster API error response:', errorText);
        throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
      }

      const data: TicketmasterResponse = await response.json();
      console.log(`Found ${data._embedded?.events?.length || 0} events for artist: ${artistName}`);
      return data._embedded?.events || [];
    } catch (error) {
      console.error('Error fetching artist shows from Ticketmaster:', error);
      return [];
    }
  }

  async searchArtistShowsInCity(artistName: string, city: string, limit: number = 10, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]> {
    try {
      // Build the URL with proper parameters according to Ticketmaster API docs
      let url = `${this.baseUrl}/events.json?apikey=${this.apiKey}&size=${limit}`;
      
      // Add keyword parameter for artist search - this is the key parameter from the API docs
      url += `&keyword=${encodeURIComponent(artistName)}`;
      
      // Add city parameter to narrow down results
      url += `&city=${encodeURIComponent(city)}`;
      
      // Add date range if provided
      if (startDate) {
        // Format date as YYYY-MM-DDTHH:mm:ssZ (remove milliseconds)
        const startDateObj = new Date(startDate);
        const formattedStartDate = startDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&startDateTime=${encodeURIComponent(formattedStartDate)}`;
      }
      if (endDate) {
        // Format date as YYYY-MM-DDTHH:mm:ssZ (remove milliseconds)
        const endDateObj = new Date(endDate);
        const formattedEndDate = endDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&endDateTime=${encodeURIComponent(formattedEndDate)}`;
      }
      
      // Add additional parameters for better results
      url += '&sort=date,asc'; // Sort by date ascending
      url += '&includeTBA=no'; // Exclude TBA events
      url += '&includeTBD=no'; // Exclude TBD events
      
      console.log('Making Ticketmaster keyword search request to:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ticketmaster API error response:', errorText);
        throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
      }

      const data: TicketmasterResponse = await response.json();
      console.log(`Found ${data._embedded?.events?.length || 0} events for keyword "${artistName}" in ${city}`);
      return data._embedded?.events || [];
    } catch (error) {
      console.error('Error fetching artist shows from Ticketmaster:', error);
      return [];
    }
  }

  async searchAttractionByName(artistName: string): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/attractions.json?apikey=${this.apiKey}&keyword=${encodeURIComponent(artistName)}&classificationName=Music`;
      
      console.log('Searching for attraction:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ticketmaster API error response:', errorText);
        throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const attractions = data._embedded?.attractions || [];
      
      if (attractions.length > 0) {
        // Find the best match (exact name match)
        const exactMatch = attractions.find((attraction: any) => 
          attraction.name.toLowerCase() === artistName.toLowerCase()
        );
        
        if (exactMatch) {
          console.log(`Found attraction ID: ${exactMatch.id} for ${artistName}`);
          return exactMatch.id;
        }
        
        // Return the first result if no exact match
        console.log(`Found attraction ID: ${attractions[0].id} for ${artistName}`);
        return attractions[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('Error searching for attraction:', error);
      return null;
    }
  }

  async searchEventsByAttractionId(attractionId: string, city: string, limit: number = 10, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]> {
    try {
      let url = `${this.baseUrl}/events.json?apikey=${this.apiKey}&size=${limit}`;
      url += `&attractionId=${attractionId}`;
      url += `&city=${encodeURIComponent(city)}`;
      
      if (startDate) {
        const startDateObj = new Date(startDate);
        const formattedStartDate = startDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&startDateTime=${encodeURIComponent(formattedStartDate)}`;
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        const formattedEndDate = endDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&endDateTime=${encodeURIComponent(formattedEndDate)}`;
      }
      
      url += '&sort=date,asc';
      url += '&includeTBA=no';
      url += '&includeTBD=no';
      
      console.log('Making Ticketmaster attraction ID search request to:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ticketmaster API error response:', errorText);
        throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
      }

      const data: TicketmasterResponse = await response.json();
      console.log(`Found ${data._embedded?.events?.length || 0} events for attraction ID ${attractionId} in ${city}`);
      return data._embedded?.events || [];
    } catch (error) {
      console.error('Error fetching events by attraction ID from Ticketmaster:', error);
      return [];
    }
  }

  async searchEventsByGenre(city: string, genre: string, limit: number = 10, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]> {
    try {
      // Build the URL with proper parameters according to Ticketmaster API docs
      let url = `${this.baseUrl}/events.json?apikey=${this.apiKey}&size=${limit}`;
      
      // Add city parameter
      url += `&city=${encodeURIComponent(city)}`;
      
      // Add genre classification
      url += `&classificationName=${encodeURIComponent(genre)}`;
      
      // Add date range if provided
      if (startDate) {
        // Format date as YYYY-MM-DDTHH:mm:ssZ (remove milliseconds)
        const startDateObj = new Date(startDate);
        const formattedStartDate = startDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&startDateTime=${encodeURIComponent(formattedStartDate)}`;
      }
      if (endDate) {
        // Format date as YYYY-MM-DDTHH:mm:ssZ (remove milliseconds)
        const endDateObj = new Date(endDate);
        const formattedEndDate = endDateObj.toISOString().replace(/\.\d{3}Z$/, 'Z');
        url += `&endDateTime=${encodeURIComponent(formattedEndDate)}`;
      }
      
      // Add additional parameters for better results
      url += '&sort=date,asc'; // Sort by date ascending
      url += '&includeTBA=no'; // Exclude TBA events
      url += '&includeTBD=no'; // Exclude TBD events
      
      console.log('Making Ticketmaster genre search request to:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ticketmaster API error response:', errorText);
        throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
      }

      const data: TicketmasterResponse = await response.json();
      console.log(`Found ${data._embedded?.events?.length || 0} ${genre} events for ${city}`);
      return data._embedded?.events || [];
    } catch (error) {
      console.error('Error fetching genre events from Ticketmaster:', error);
      return [];
    }
  }

  /**
   * AI-powered search that intelligently parses natural language queries
   * and extracts search parameters for the Ticketmaster API
   */
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
      // Use OpenAI to parse the natural language query
      const searchParams = await this.parseSearchQuery(query, userCity);
      
      console.log('🔍 AI Search Parameters:', searchParams);
      
      let events: TicketmasterEvent[] = [];
      let explanation = '';
      
      // Use AI-parsed dates if valid, otherwise fall back to current dates
      const currentDate = new Date();
      const thirtyDaysFromNow = new Date(currentDate);
      thirtyDaysFromNow.setDate(currentDate.getDate() + 30);
      
      // For artist searches, extend the search timeframe to 6 months
      const sixMonthsFromNow = new Date(currentDate);
      sixMonthsFromNow.setMonth(currentDate.getMonth() + 6);
      
      let startDate = currentDate;
      let endDate = searchParams.artist ? sixMonthsFromNow : thirtyDaysFromNow;
      
      // Use AI-parsed dates if provided
      if (searchParams.dateRange?.startDate && searchParams.dateRange.startDate !== 'undefined') {
        startDate = new Date(searchParams.dateRange.startDate);
        console.log(`✅ Using AI-parsed start date: ${startDate.toISOString()}`);
      }
      
      if (searchParams.dateRange?.endDate && searchParams.dateRange.endDate !== 'undefined') {
        endDate = new Date(searchParams.dateRange.endDate);
        console.log(`✅ Using AI-parsed end date: ${endDate.toISOString()}`);
      }

      // Use flexible location search for better results
      events = await this.searchWithFlexibleLocation(searchParams, startDate, endDate);
      
      if (events.length === 0) {
        explanation = `No events found for your search. Try adjusting your criteria or checking a different city.`;
      } else if (!explanation) {
        // Limit to first 3 events for chat response
        const limitedEvents = events.slice(0, 3);
        explanation = `Found ${limitedEvents.length} event${limitedEvents.length > 1 ? 's' : ''} matching your search.`;
        events = limitedEvents;
      }
      
      return {
        events,
        searchParams,
        explanation
      };
      

      
      return {
        events,
        searchParams,
        explanation
      };
      
    } catch (error) {
      console.error('Error in AI search:', error);
      return {
        events: [],
        searchParams: {},
        explanation: 'Sorry, I encountered an error while searching for events. Please try again.'
      };
    }
  }

  /**
   * Use OpenAI to intelligently parse natural language search queries
   */
  private async parseSearchQuery(query: string, userCity?: string): Promise<{
    city?: string;
    artist?: string;
    genre?: string;
    dateRange?: { startDate?: string; endDate?: string };
    keywords?: string[];
  }> {
    if (!this.openai) {
      // Fallback to basic parsing if OpenAI is not available
      return this.basicParseSearchQuery(query, userCity);
    }

    try {
      const prompt = `Parse this event search query and extract search parameters. Return ONLY a valid JSON object with these fields:
- city: the city mentioned (or use "${userCity}" if no city mentioned)
- artist: any artist, band, or performer name mentioned (e.g., "Ludacris", "Taylor Swift", "The Weeknd"). If someone asks for "Ludacris show", the artist is "Ludacris".
- genre: music genre or event type (rock, jazz, pop, country, hip hop, rap, indie, folk, electronic, dance, comedy, theater, sports, etc.)
- dateRange: object with startDate and endDate in ISO format. Use CURRENT DATES:
  * "this weekend" = Friday to Sunday of current week (if today is Friday-Sunday, use this weekend; if today is Monday-Thursday, use upcoming Friday-Sunday)
  * "next week" = next Monday to Sunday  
  * "next month" = next month's first day to last day
  * If no date mentioned, use next 30 days from today
- keywords: array of other relevant search terms

IMPORTANT: Use CURRENT dates (2025), NOT past dates (2023). Today is ${new Date().toISOString().split('T')[0]}.
IMPORTANT: If an artist name is mentioned, extract it exactly as written.
IMPORTANT: For queries like "Ludacris show in Los Angeles", the artist should be "Ludacris".
IMPORTANT: For "this weekend", calculate correctly: if today is Friday-Sunday, use this weekend; if today is Monday-Thursday, use the upcoming Friday-Sunday.

Query: "${query}"

Return ONLY the JSON object, no markdown formatting, no code blocks, no additional text.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: prompt }
        ],
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
          return this.basicParseSearchQuery(query, userCity);
        }
      }
    } catch (error) {
      console.error('Error using OpenAI for search parsing:', error);
    }

    // Fallback to basic parsing
    return this.basicParseSearchQuery(query, userCity);
  }

  private async searchWithFlexibleLocation(searchParams: any, startDate: Date, endDate: Date): Promise<TicketmasterEvent[]> {
    const baseUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${this.apiKey}&size=5&startDateTime=${encodeURIComponent(startDate.toISOString().replace(/\.\d{3}Z$/, 'Z'))}&endDateTime=${encodeURIComponent(endDate.toISOString().replace(/\.\d{3}Z$/, 'Z'))}&sort=date,asc&includeTBA=no&includeTBD=no`;
    
    // Strategy 1: Exact city match
    if (searchParams.city && searchParams.city !== 'undefined') {
      console.log(`🔍 Strategy 1: Searching in exact city: ${searchParams.city}`);
      let url = baseUrl + `&city=${encodeURIComponent(searchParams.city)}`;
      
      if (searchParams.artist && searchParams.artist !== 'undefined') {
        // Use keyword search for better results in flexible location search
        url += `&keyword=${encodeURIComponent(searchParams.artist)}`;
      }
      
      const events = await this.fetchEvents(url);
      if (events.length > 0) {
        console.log(`✅ Found ${events.length} events in exact city`);
        return events;
      }
    }
    
    // Strategy 2: Statewide search (for California)
    if (searchParams.city && (searchParams.city.toLowerCase().includes('los angeles') || searchParams.city.toLowerCase().includes('la') || searchParams.city.toLowerCase().includes('orange county'))) {
      console.log(`🔍 Strategy 2: Searching statewide in California`);
      let url = baseUrl + `&stateCode=CA`;
      
      if (searchParams.artist && searchParams.artist !== 'undefined') {
        // Use keyword search for better results in flexible location search
        url += `&keyword=${encodeURIComponent(searchParams.artist)}`;
      }
      
      const events = await this.fetchEvents(url);
      if (events.length > 0) {
        console.log(`✅ Found ${events.length} events statewide in California`);
        return events;
      }
      
      // Strategy 2b: Try DMA search for Los Angeles area (DMA 324)
      console.log(`🔍 Strategy 2b: Searching Los Angeles DMA (324)`);
      let dmaUrl = baseUrl + `&dmaId=324`;
      
      if (searchParams.artist && searchParams.artist !== 'undefined') {
        dmaUrl += `&keyword=${encodeURIComponent(searchParams.artist)}`;
      }
      
      const dmaEvents = await this.fetchEvents(dmaUrl);
      if (dmaEvents.length > 0) {
        console.log(`✅ Found ${dmaEvents.length} events in Los Angeles DMA`);
        return dmaEvents;
      }
    }
    
    // Strategy 3: Nationwide search
    console.log(`🔍 Strategy 3: Searching nationwide`);
    let url = baseUrl;
    
    if (searchParams.artist && searchParams.artist !== 'undefined') {
      // Use keyword search for better results in flexible location search
      url += `&keyword=${encodeURIComponent(searchParams.artist)}`;
    }
    
    const events = await this.fetchEvents(url);
    console.log(`✅ Found ${events.length} events nationwide`);
    return events;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      const delay = this.requestDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${delay}ms before request`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    this.lastRequestTime = Date.now();
  }

  private async fetchEvents(url: string): Promise<TicketmasterEvent[]> {
    await this.rateLimit();
    const response = await fetch(url);
    const data = await response.json();
    return data._embedded?.events || [];
  }

  /**
   * Basic parsing fallback when OpenAI is not available
   */
  private basicParseSearchQuery(query: string, userCity?: string): {
    city?: string;
    artist?: string;
    genre?: string;
    dateRange?: { startDate?: string; endDate?: string };
    keywords?: string[];
  } {
    const lowerQuery = query.toLowerCase();
    const result: any = {};

    // Extract city
    const cities = ['los angeles', 'new york', 'san francisco', 'chicago', 'miami', 'austin', 'detroit', 'seattle', 'boston', 'atlanta'];
    const mentionedCity = cities.find(city => lowerQuery.includes(city));
    result.city = mentionedCity || userCity;

    // Extract genres
    const genres = {
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

    // Extract date range
    if (lowerQuery.includes('this weekend')) {
      const now = new Date();
      const friday = new Date(now);
      friday.setDate(now.getDate() + (5 - now.getDay() + 7) % 7);
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      
      result.dateRange = {
        startDate: friday.toISOString(),
        endDate: sunday.toISOString()
      };
    } else if (lowerQuery.includes('next week')) {
      const now = new Date();
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7);
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);
      
      result.dateRange = {
        startDate: nextMonday.toISOString(),
        endDate: nextSunday.toISOString()
      };
    } else if (lowerQuery.includes('next month')) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      
      result.dateRange = {
        startDate: nextMonth.toISOString(),
        endDate: endOfNextMonth.toISOString()
      };
    } else if (lowerQuery.includes('this week')) {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - now.getDay() + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      result.dateRange = {
        startDate: monday.toISOString(),
        endDate: sunday.toISOString()
      };
    } else {
      // Default: search for events in the next 30 days
      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      
      result.dateRange = {
        startDate: now.toISOString(),
        endDate: thirtyDaysFromNow.toISOString()
      };
    }

    return result;
  }

  formatEventForDisplay(event: TicketmasterEvent): string {
    const startDate = new Date(event.dates.start.dateTime);
    const dateOptions: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    const dateFormatted = startDate.toLocaleDateString('en-US', dateOptions);
    const eventName = this.formatEventName(event);
    const location = this.getEventVenue(event);
    const priceRange = event.priceRanges?.[0];
    const priceInfo = priceRange ? `💰 From $${priceRange.min}` : '';

    return `🎉 **${eventName}**
📅 ${dateFormatted}
📍 ${location}
${priceInfo}
🔗 ${event.url}`;
  }

  formatEventsList(events: TicketmasterEvent[]): string {
    if (events.length === 0) {
      return "I couldn't find any events in that area right now. Try checking back later or expanding your search area!";
    }

    const eventList = events.map((event, index) => {
      const startDate = new Date(event.dates.start.dateTime);
      const dateStr = startDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      });
      
      const eventName = this.formatEventName(event);
      const location = this.getEventVenue(event);
      const priceRange = event.priceRanges?.[0];
      const priceInfo = priceRange ? ` (tickets from $${priceRange.min})` : '';

      return `${index + 1}. ${eventName} - ${dateStr} at ${location}${priceInfo}`;
    }).join('\n');

    return `Here are some events happening near you:

${eventList}

Want more details on any of these? Just ask!`;
  }

  isWellnessEvent(event: TicketmasterEvent): boolean {
    const wellnessKeywords = [
      'yoga', 'meditation', 'wellness', 'fitness', 'health', 'dance', 'therapy', 
      'mindfulness', 'spiritual', 'healing', 'workshop', 'class', 'session'
    ];
    
    const eventName = event.name.toLowerCase();
    const segmentName = event.classifications[0]?.segment?.name?.toLowerCase() || '';
    
    return wellnessKeywords.some(keyword => 
      eventName.includes(keyword) || segmentName.includes(keyword)
    );
  }

  getEventArtists(event: TicketmasterEvent): string[] {
    if (!event._embedded?.attractions) {
      return [];
    }
    
    return event._embedded.attractions
      .filter(attraction => attraction.type === 'artist' || attraction.type === 'performer')
      .map(attraction => attraction.name);
  }

  getEventVenue(event: TicketmasterEvent): string {
    const venue = event._embedded?.venues?.[0];
    if (!venue) return 'Location TBD';
    
    const venueName = venue.name;
    const city = venue.city?.name;
    const state = venue.state?.name;
    
    if (city && state) {
      return `${venueName}, ${city}, ${state}`;
    } else if (city) {
      return `${venueName}, ${city}`;
    }
    
    return venueName;
  }

  formatEventName(event: TicketmasterEvent): string {
    const artists = this.getEventArtists(event);
    
    if (artists.length > 0) {
      // If we have artist info, use it
      if (artists.length === 1) {
        return `${artists[0]} - ${event.name}`;
      } else {
        return `${artists.join(' & ')} - ${event.name}`;
      }
    }
    
    // Fallback to just the event name
    return event.name;
  }

  parseDateRange(message: string): { startDate?: string; endDate?: string; isFirstWeek: boolean } {
    const lowerMessage = message.toLowerCase();
    
    // Check for specific date ranges
    if (lowerMessage.includes('this weekend')) {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
      
      let friday, sunday;
      
      if (currentDay >= 5) {
        // If today is Friday (5) or Saturday (6), use this weekend
        friday = new Date(now);
        friday.setDate(now.getDate() - (currentDay - 5)); // Go back to Friday
        sunday = new Date(friday);
        sunday.setDate(friday.getDate() + 2); // Sunday
      } else {
        // If today is Sunday (0) through Thursday (4), use upcoming weekend
        friday = new Date(now);
        friday.setDate(now.getDate() + (5 - currentDay + 7) % 7);
        sunday = new Date(friday);
        sunday.setDate(friday.getDate() + 2);
      }
      
      return {
        startDate: friday.toISOString(),
        endDate: sunday.toISOString(),
        isFirstWeek: true
      };
    }
    
    if (lowerMessage.includes('next week')) {
      const now = new Date();
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7);
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);
      
      return {
        startDate: nextMonday.toISOString(),
        endDate: nextSunday.toISOString(),
        isFirstWeek: true
      };
    }
    
    if (lowerMessage.includes('this week')) {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - now.getDay() + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      return {
        startDate: monday.toISOString(),
        endDate: sunday.toISOString(),
        isFirstWeek: true
      };
    }
    
    if (lowerMessage.includes('next month')) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      
      return {
        startDate: nextMonth.toISOString(),
        endDate: endOfNextMonth.toISOString(),
        isFirstWeek: false
      };
    }
    
    // Default: next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    return {
      startDate: now.toISOString(),
      endDate: thirtyDaysFromNow.toISOString(),
      isFirstWeek: false
    };
  }
} 