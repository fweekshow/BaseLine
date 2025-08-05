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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const eventName = this.formatEventName(event);
      const location = this.getEventVenue(event);
      const priceRange = event.priceRanges?.[0];
      const priceInfo = priceRange ? ` (from $${priceRange.min})` : '';

      return `${index + 1}. **${eventName}** - ${dateStr} at ${location}${priceInfo}`;
    }).join('\n');

    return `🎪 **Events near you:**

${eventList}

💡 Want more details on any event? Just ask!`;
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
      const friday = new Date(now);
      friday.setDate(now.getDate() + (5 - now.getDay() + 7) % 7);
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      
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