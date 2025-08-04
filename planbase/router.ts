export interface MessageContext {
  isGroup: boolean;
  isMentioned: boolean;
  isReply: boolean;
  messageContent: string;
  senderInboxId: string;
}

export class WellnessRouter {
  static shouldRespond(context: MessageContext): boolean {
    // In direct messages, always respond
    if (!context.isGroup) {
      return true;
    }
    
    // In groups, only respond if mentioned or if it's a reply to our message
    return context.isMentioned || context.isReply;
  }

  static parseMessage(message: string): string[] {
    const commands: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Check for wellness-related keywords
    if (lowerMessage.includes('wellness') || lowerMessage.includes('health')) {
      commands.push('wellness');
    }
    
    if (lowerMessage.includes('dance') || lowerMessage.includes('therapy') || lowerMessage.includes('bianca')) {
      commands.push('dance');
    }
    
    if (lowerMessage.includes('summit') || lowerMessage.includes('onchain')) {
      commands.push('summit');
    }
    
    if (lowerMessage.includes('nearby') || lowerMessage.includes('local') || lowerMessage.includes('around')) {
      commands.push('nearby');
    }
    
    if (lowerMessage.includes("i'm in") || lowerMessage.includes('im in') || lowerMessage.includes('interested')) {
      commands.push('interested');
    }
    
    return commands;
  }

  static getResponse(context: MessageContext): string {
    const commands = this.parseMessage(context.messageContent);
    
    if (commands.includes('dance')) {
      return "💃 I'd love to connect you with Bianca's Flow for dance therapy sessions in Echo Park! They offer amazing movement-based wellness sessions. Would you like me to send you the details?";
    }
    
    if (commands.includes('summit')) {
      return `🎉 **Onchain Summit 2025**

📅 **Date**: August 21st-24th, 2025
📍 **Location**: San Francisco, CA
🎯 **What**: Wellness and tech event
🌐 **Website**: https://www.onchainsummit.io

**Schedule Highlights:**
• Thursday 8/21: Base artist show and mint (4PM-7PM)
• Friday 8/22: Welcome happy hour (4PM-9PM), Founder's poker tournament (6PM-9PM), Hella Bays'd concert (10PM-2AM)
• Saturday 8/23: Demo day and main stage (10AM-5PM), Casino night (7PM-11PM)
• Sunday 8/24: Brunch (10AM-2PM)

Check out the full details at https://www.onchainsummit.io! 🚀`;
    }
    
    if (commands.includes('nearby')) {
      return "📍 I can help you find wellness activities nearby! I know of dance therapy sessions with Bianca's Flow in Echo Park, and there's the Onchain Summit 2025 in San Francisco from August 21st-24th. What interests you most?";
    }
    
    if (commands.includes('interested')) {
      return "🎯 Great! I'll send you the full details in a DM. Check your messages!";
    }
    
    // Default response
    return "Hi! I'm your wellness concierge. I can help you find dance therapy sessions with Bianca's Flow in Echo Park or tell you about the Onchain Summit 2025 in San Francisco from August 21st-24th. What would you like to know?";
  }

  static isImInMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return lowerMessage.includes("i'm in") || lowerMessage.includes('im in') || lowerMessage.includes('interested');
  }
} 