export interface InboundMessage {
  id: string;
  channel: string;
  userId: string;
  chatId: string;
  text: string;
  receivedAt: string;
  raw: unknown;
}

export interface OutboundMessage {
  channel: string;
  chatId: string;
  text: string;
  editMessageId?: string;
  isFinal: boolean;
}

export type SessionKey = string;

export interface ConversationTurn {
  role: "user" | "assistant" | "tool";
  content: any;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
  createdAt: string;
}

export interface SessionData {
  key: SessionKey;
  channel: string;
  userId: string;
  chatId: string;
  turns: ConversationTurn[];
  createdAt: string;
  updatedAt: string;
}
