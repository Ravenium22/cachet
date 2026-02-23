// JWT
export const JWT_ACCESS_EXPIRY = "1h";
export const JWT_REFRESH_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const JWT_REFRESH_EXPIRY = "7d";

// Redis key prefixes
export const REDIS_PREFIX = {
  REFRESH_TOKEN: "rt:",
  OAUTH_STATE: "oauth:",
  VERIFICATION_NONCE: "vn:",
  RATE_LIMIT: "rl:",
  RPC_CACHE: "rpc:",
  STRIPE_EVENT: "se:",
  PADDLE_EVENT: "pe:",
  WORKER_LOCK: "wl:",
} as const;

// Verification
export const VERIFICATION_NONCE_TTL_SECONDS = 15 * 60; // 15 minutes

// Billing
export const BILLING_GRACE_PERIOD_DAYS = 7;
export const OAUTH_STATE_TTL_SECONDS = 5 * 60;
export const STRIPE_WEBHOOK_IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60;
export const PADDLE_WEBHOOK_IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60;

export const TIER_LIMITS = {
  free: {
    maxVerifiedMembers: 100,
    maxServers: 1,
    maxContracts: 1,
    maxRoleMappings: 3,
    maxAdminChecksPerMonth: 0,
  },
  growth: {
    maxVerifiedMembers: 1500,
    maxServers: 1,
    maxContracts: 5,
    maxRoleMappings: Infinity,
    maxAdminChecksPerMonth: 5,
  },
  pro: {
    maxVerifiedMembers: 10000,
    maxServers: 3,
    maxContracts: Infinity,
    maxRoleMappings: Infinity,
    maxAdminChecksPerMonth: Infinity,
  },
  enterprise: {
    maxVerifiedMembers: Infinity,
    maxServers: Infinity,
    maxContracts: Infinity,
    maxRoleMappings: Infinity,
    maxAdminChecksPerMonth: Infinity,
  },
} as const;

export const BILLING_PLANS = [
  {
    tier: "free",
    label: "Free",
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
    description: "For early communities getting started.",
  },
  {
    tier: "growth",
    label: "Growth",
    priceMonthlyUsd: 14.99,
    priceAnnualUsd: 143.90,
    description: "Best for active NFT projects scaling to 1.5k verified members.",
  },
  {
    tier: "pro",
    label: "Pro",
    priceMonthlyUsd: 39.99,
    priceAnnualUsd: 383.90,
    description: "For large projects with multi-server and high-volume verification.",
  },
  {
    tier: "enterprise",
    label: "Enterprise",
    priceMonthlyUsd: null,
    priceAnnualUsd: null,
    description: "Custom SLAs, white-label, and dedicated support.",
  },
] as const;

export const RATE_LIMIT_RULES = {
  verificationInitiation: {
    requests: 5,
    windowSeconds: 15 * 60,
  },
  verificationCompletion: {
    requests: 3,
    windowSeconds: 15 * 60,
  },
  authenticatedApi: {
    requests: 100,
    windowSeconds: 60,
  },
  publicApi: {
    requests: 20,
    windowSeconds: 60,
  },
  authCallback: {
    requests: 10,
    windowSeconds: 15 * 60,
  },
  authRefresh: {
    requests: 30,
    windowSeconds: 15 * 60,
  },
} as const;

export const TIER_RATE_LIMITS = {
  free: {
    verificationInitiationRequests: RATE_LIMIT_RULES.verificationInitiation.requests,
  },
  growth: {
    verificationInitiationRequests: RATE_LIMIT_RULES.verificationInitiation.requests,
  },
  pro: {
    verificationInitiationRequests: RATE_LIMIT_RULES.verificationInitiation.requests,
  },
  enterprise: {
    verificationInitiationRequests: RATE_LIMIT_RULES.verificationInitiation.requests,
  },
} as const;

// Verification message
/**
 * EIP-191 personal_sign message template.
 * Deterministic per-project to prevent cross-project signature reuse.
 */
export function buildVerificationMessage(projectName: string, nonce: string): string {
  return `Verify Discord account for ${projectName}\nNonce: ${nonce}`;
}

// RPC
export const RPC_CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
export const RPC_MAX_RETRIES = 3;

// Discord
export const DISCORD_API_BASE = "https://discord.com/api/v10";
export const DISCORD_OAUTH_SCOPES = ["identify", "guilds"];
