export interface MessageContext {
    isGroup: boolean;
    isMentioned: boolean;
    isReply: boolean;
    messageContent: string;
    senderInboxId: string;
}
export declare class WellnessRouter {
    static shouldRespond(context: MessageContext): boolean;
    static parseMessage(message: string): string[];
    static getResponse(context: MessageContext): string;
    static isImInMessage(message: string): boolean;
}
//# sourceMappingURL=router.d.ts.map