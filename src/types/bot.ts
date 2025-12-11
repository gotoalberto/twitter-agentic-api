export interface ConnectedBot {
  userId: string;
  username: string;
  accessToken: string;        // Encrypted in Redis
  accessTokenSecret: string;  // Encrypted in Redis
  connectedAt: string;        // ISO timestamp
}

export interface WebhookRegistration {
  webhookId: string;
  url: string;
  botUserId: string;
  botUsername: string;
  subscribed: boolean;
  registeredAt: string;
  lastCrcCheck: string | null;
}
