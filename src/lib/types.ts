export type RateLimitType = "unlimited" | "daily" | "monthly";

export interface ClientKey {
  id: string;
  key: string;                 // the secret client key
  name: string;
  createdAt: string;
  isActive: boolean;
  // usage tracking
  requestCount: number;
  lastResetAt: string;         // for daily/monthly reset
  // limits (copied from parent API or overridden)
  rateLimitType: RateLimitType;
  rateLimitValue: number | null; // null = unlimited
}

export interface MaskedApi {
  id: string;
  name: string;                // unique key name
  slug: string;                // used in masked URL
  realUrl: string;             // the real endpoint
  realApiKey?: string;         // optional real key (stored server-side only)
  realApiKeyHeader?: string;   // e.g. "Authorization" or "x-api-key"
  validityType: "days" | "permanent";
  validityDays?: number;
  expiresAt: string | null;    // ISO date or null
  rateLimitType: RateLimitType;
  rateLimitValue: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalRequests: number;
  clientKeys: ClientKey[];
  // health
  lastHealthCheck?: string;
  lastHealthStatus?: "up" | "down" | "unknown";
}

export interface UsageLog {
  id: string;
  apiId: string;
  clientKeyId?: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  error?: string;
}

export interface Database {
  adminPasswordHash: string;
  apis: MaskedApi[];
  logs: UsageLog[];           // keep last 500
  settings: {
    panelName: string;
    createdAt: string;
  };
}

export interface SessionPayload {
  isAdmin: boolean;
  exp: number;
}
