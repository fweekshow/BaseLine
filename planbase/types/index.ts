// XMTP Message Types
export interface XmtpMessage {
  id: string;
  content: string;
  contentType: string;
  senderInboxId: string;
  conversationId: string;
  sentAt: Date;
  isFromSelf: boolean;
}

export interface XmtpConversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  lastMessage?: XmtpMessage;
}

// User Data Types
export interface UserProfile {
  inboxId: string;
  address?: string;
  city?: string;
  preferences: {
    eventTypes: string[];
    notificationSettings: NotificationSettings;
    privacySettings: PrivacySettings;
  };
  metadata: {
    createdAt: Date;
    lastActive: Date;
    messageCount: number;
  };
}

export interface NotificationSettings {
  eventReminders: boolean;
  newEvents: boolean;
  rsvpUpdates: boolean;
  directMessages: boolean;
}

export interface PrivacySettings {
  shareLocation: boolean;
  sharePreferences: boolean;
  allowTracking: boolean;
}

// Event Data Types
export interface EventData {
  id: string;
  name: string;
  description?: string;
  date: Date;
  venue: VenueData;
  artist?: string;
  genre?: string;
  ticketUrl?: string;
  price?: PriceData;
  status: 'upcoming' | 'sold-out' | 'cancelled';
  source: 'ticketmaster' | 'manual' | 'onchain';
  metadata: EventMetadata;
}

export interface VenueData {
  name: string;
  city: string;
  state?: string;
  address?: string;
  capacity?: number;
}

export interface PriceData {
  min: number;
  max: number;
  currency: string;
}

export interface EventMetadata {
  createdAt: Date;
  updatedAt: Date;
  searchQueries: string[];
  rsvpCount?: number;
  externalId?: string;
}

// RSVP Types
export interface RsvpData {
  id: string;
  eventId: string;
  userId: string;
  status: 'yes' | 'maybe' | 'no';
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

// Search and Query Types
export interface SearchQuery {
  id: string;
  userId: string;
  query: string;
  parsedParams: SearchParams;
  results: EventData[];
  createdAt: Date;
}

export interface SearchParams {
  city?: string;
  artist?: string;
  genre?: string;
  dateRange?: DateRange;
  keywords?: string[];
  radius?: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Quick Actions Types (for Base App integration)
export interface QuickAction {
  id: string;
  label: string;
  style: 'primary' | 'secondary' | 'danger';
  action: string;
  data?: any;
}

export interface QuickActionSet {
  id: string;
  description: string;
  actions: QuickAction[];
  expiresAt: Date;
  context: 'event_search' | 'rsvp' | 'general';
}

// Conversation Context Types
export interface ConversationContext {
  conversationId: string;
  participants: string[];
  type: 'direct' | 'group';
  lastActivity: Date;
  pendingActions: PendingAction[];
  userPreferences: Map<string, UserProfile>;
}

export interface PendingAction {
  id: string;
  type: 'rsvp_request' | 'event_search' | 'location_request';
  userId: string;
  data: any;
  createdAt: Date;
  expiresAt: Date;
}

// Data Storage Types
export interface DataStore {
  users: Map<string, UserProfile>;
  events: Map<string, EventData>;
  rsvps: Map<string, RsvpData>;
  searchHistory: Map<string, SearchQuery[]>;
  conversations: Map<string, ConversationContext>;
  pendingActions: Map<string, PendingAction[]>;
}

// API Response Types
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

export interface SearchResult {
  events: EventData[];
  searchParams: SearchParams;
  explanation: string;
  totalResults: number;
  hasMore: boolean;
}

// Message Processing Types
export interface MessageContext {
  isGroup: boolean;
  isMentioned: boolean;
  isReply: boolean;
  messageContent: string;
  senderInboxId: string;
  conversationId: string;
  timestamp: Date;
}

export interface MessageResponse {
  content: string;
  quickActions?: QuickActionSet;
  shouldSendDM?: boolean;
  dmContent?: string;
} 