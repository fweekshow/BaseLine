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
export declare class TicketmasterService {
    private apiKey;
    private baseUrl;
    private openai;
    private lastRequestTime;
    private requestDelay;
    constructor(apiKey: string, openai?: any);
    searchEventsByCity(city: string, limit?: number, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]>;
    searchWellnessEventsByCity(city: string, limit?: number, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]>;
    searchConcertsByCity(city: string, limit?: number, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]>;
    searchArtistShows(artistName: string, limit?: number, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]>;
    searchArtistShowsInCity(artistName: string, city: string, limit?: number, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]>;
    searchAttractionByName(artistName: string): Promise<string | null>;
    searchEventsByAttractionId(attractionId: string, city: string, limit?: number, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]>;
    searchEventsByGenre(city: string, genre: string, limit?: number, startDate?: string, endDate?: string): Promise<TicketmasterEvent[]>;
    /**
     * AI-powered search that intelligently parses natural language queries
     * and extracts search parameters for the Ticketmaster API
     */
    aiSearch(query: string, userCity?: string): Promise<{
        events: TicketmasterEvent[];
        searchParams: {
            city?: string;
            artist?: string;
            genre?: string;
            dateRange?: {
                startDate?: string;
                endDate?: string;
            };
            keywords?: string[];
        };
        explanation: string;
    }>;
    /**
     * Use OpenAI to intelligently parse natural language search queries
     */
    private parseSearchQuery;
    private searchWithFlexibleLocation;
    private rateLimit;
    private fetchEvents;
    /**
     * Basic parsing fallback when OpenAI is not available
     */
    private basicParseSearchQuery;
    formatEventForDisplay(event: TicketmasterEvent): string;
    formatEventsList(events: TicketmasterEvent[]): string;
    isWellnessEvent(event: TicketmasterEvent): boolean;
    getEventArtists(event: TicketmasterEvent): string[];
    getEventVenue(event: TicketmasterEvent): string;
    formatEventName(event: TicketmasterEvent): string;
    parseDateRange(message: string): {
        startDate?: string;
        endDate?: string;
        isFirstWeek: boolean;
    };
}
//# sourceMappingURL=ticketmaster.d.ts.map