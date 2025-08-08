# Structured XMTP Data Organization

This document outlines the new structured approach to organizing XMTP data in the Wellness Connections agent.

## Overview

The previous implementation had scattered data storage across multiple files and in-memory maps. The new structure provides:

- **Centralized Data Management**: All data is managed through a single `DataManager` class
- **Type Safety**: Comprehensive TypeScript interfaces for all data structures
- **Persistence**: Automatic saving/loading of data to JSON files
- **Structured Processing**: Clean separation between data storage and message processing

## Data Structure

### Core Types (`types/index.ts`)

#### User Data
- `UserProfile`: Complete user information including preferences and metadata
- `NotificationSettings`: User notification preferences
- `PrivacySettings`: User privacy preferences

#### Event Data
- `EventData`: Structured event information with venue, pricing, and metadata
- `VenueData`: Venue information
- `PriceData`: Pricing information
- `EventMetadata`: Event metadata including creation dates and search queries

#### RSVP System
- `RsvpData`: RSVP information with status tracking
- `PendingAction`: Pending user actions (RSVP requests, etc.)

#### Search & Query
- `SearchQuery`: Search history with parsed parameters
- `SearchParams`: Structured search parameters
- `DateRange`: Date range for searches

#### Quick Actions (Base App Integration)
- `QuickAction`: Individual action button
- `QuickActionSet`: Complete set of actions for a context

#### Message Processing
- `MessageContext`: Context for message processing
- `MessageResponse`: Structured response with optional actions

## Data Manager (`data-manager.ts`)

The `DataManager` class provides:

### User Management
- `getUserProfile(inboxId)`: Get user profile
- `createUserProfile(inboxId, address?)`: Create new user profile
- `updateUserProfile(inboxId, updates)`: Update user profile
- `updateUserActivity(inboxId)`: Update user activity timestamp

### Event Management
- `addEvent(event)`: Add new event
- `getEvent(eventId)`: Get event by ID
- `updateEvent(eventId, updates)`: Update event

### RSVP Management
- `createRsvp(eventId, userId, status, notes?)`: Create RSVP
- `getRsvp(rsvpId)`: Get RSVP by ID
- `getUserRsvps(userId)`: Get all RSVPs for user

### Search History
- `addSearchQuery(userId, query)`: Add search to history
- `getUserSearchHistory(userId)`: Get user's search history

### Conversation Management
- `getConversationContext(conversationId)`: Get conversation context
- `createConversationContext(conversationId, participants, type)`: Create conversation context
- `updateConversationActivity(conversationId)`: Update conversation activity

### Pending Actions
- `addPendingAction(userId, action)`: Add pending action
- `getPendingActions(userId)`: Get user's pending actions
- `removePendingAction(userId, actionId)`: Remove pending action

### Utility Methods
- `convertTicketmasterEvent(tmEvent)`: Convert Ticketmaster event to structured format
- `cleanupExpiredActions()`: Clean up expired pending actions
- `getStats()`: Get data statistics

## Message Processor (`message-processor.ts`)

The `MessageProcessor` class handles:

### Message Processing
- `processMessage(message, conversation)`: Main message processing
- `handleRsvpFlow(messageContent, senderInboxId, context)`: Handle RSVP commands
- `handlePendingActions(messageContent, senderInboxId, pendingActions, context)`: Handle pending actions
- `detectEventQuery(messageContent)`: Detect if message is event-related
- `handleEventSearch(messageContent, senderInboxId, context)`: Handle event searches
- `generateDefaultResponse(messageContent, context)`: Generate default responses

### Quick Action Handling
- `handleQuickAction(actionId, userId)`: Process quick action responses

## Data Storage

Data is automatically persisted to JSON files in the `./data` directory:

- `users.json`: User profiles and preferences
- `events.json`: Event data
- `rsvps.json`: RSVP data
- `search-history.json`: Search history
- `conversations.json`: Conversation contexts
- `pending-actions.json`: Pending actions

## Benefits of New Structure

1. **Type Safety**: All data structures are properly typed with TypeScript
2. **Centralized Management**: Single point of control for all data operations
3. **Automatic Persistence**: Data is automatically saved and loaded
4. **Clean Separation**: Message processing is separated from data management
5. **Extensibility**: Easy to add new data types and operations
6. **Debugging**: Better error handling and logging
7. **Performance**: Efficient data access patterns

## Migration from Old Structure

The old structure used:
- In-memory maps (`userCities`, `userAddresses`, `pendingAddressRequests`)
- Hardcoded responses in `data.ts`
- Scattered data in `user-data.json`

The new structure:
- Centralized data management through `DataManager`
- Structured types for all data
- Automatic persistence
- Clean message processing pipeline

## Usage Example

```typescript
// Initialize data manager
const dataManager = new DataManager('./data');

// Create user profile
const user = dataManager.createUserProfile('user123', '0x123...');

// Add event
const event = dataManager.addEvent({
  id: 'event1',
  name: 'Concert',
  date: new Date(),
  venue: { name: 'Venue', city: 'City' },
  // ... other fields
});

// Process message
const messageProcessor = new MessageProcessor(dataManager, ticketmasterService, openai);
const response = await messageProcessor.processMessage(message, conversation);
```

This structured approach provides a solid foundation for scaling the XMTP agent with proper data organization and type safety. 