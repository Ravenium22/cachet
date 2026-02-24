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

// ── Crypto Payments ───────────────────────────────────────────────────────

export const CRYPTO_PAYMENT_INVOICE_TTL_SECONDS = 3600; // 1 hour

export const TOKEN_DECIMALS = {
  usdc: 6,
  usdt: 6,
  usde: 18,
  usdm: 18, // MegaETH native stablecoin
  honey: 18, // Berachain native stablecoin
} as const;

/**
 * Alchemy RPC slug → full URL is built as:
 *   https://{alchemySlug}.g.alchemy.com/v2/{ALCHEMY_API_KEY}
 *
 * Per-chain override: set {CHAIN}_RPC_URL env var (e.g. MEGAETH_RPC_URL).
 * Tokens set to null are not yet verified on that chain and hidden in the UI.
 */
export const SUPPORTED_PAYMENT_CHAINS = {
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    alchemySlug: "eth-mainnet",
    rpcEnvVar: "ETHEREUM_RPC_URL",
    blockExplorer: "https://etherscan.io",
    confirmations: 2,
    tokens: {
      usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as string | null,
      usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as string | null,
      usde: null as string | null,
      usdm: null as string | null,
      honey: null as string | null,
    },
  },
  base: {
    chainId: 8453,
    name: "Base",
    alchemySlug: "base-mainnet",
    rpcEnvVar: "BASE_RPC_URL",
    blockExplorer: "https://basescan.org",
    confirmations: 2,
    tokens: {
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as string | null,
      usdt: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as string | null,
      usde: null as string | null,
      usdm: null as string | null,
      honey: null as string | null,
    },
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum",
    alchemySlug: "arb-mainnet",
    rpcEnvVar: "ARBITRUM_RPC_URL",
    blockExplorer: "https://arbiscan.io",
    confirmations: 2,
    tokens: {
      usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as string | null,
      usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as string | null,
      usde: null as string | null,
      usdm: null as string | null,
      honey: null as string | null,
    },
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    alchemySlug: "opt-mainnet",
    rpcEnvVar: "OPTIMISM_RPC_URL",
    blockExplorer: "https://optimistic.etherscan.io",
    confirmations: 2,
    tokens: {
      usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as string | null,
      usdt: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" as string | null,
      usde: null as string | null,
      usdm: null as string | null,
      honey: null as string | null,
    },
  },
  berachain: {
    chainId: 80094,
    name: "Berachain",
    alchemySlug: "berachain-mainnet",
    rpcEnvVar: "BERACHAIN_RPC_URL",
    blockExplorer: "https://berascan.com",
    confirmations: 2,
    tokens: {
      usdc: "0x549943e04f40284185054145c6e4e9568c1d3241" as string | null, // USDC.e bridged via Stargate
      usdt: null as string | null,
      usde: null as string | null,
      usdm: null as string | null,
      honey: "0xFCBD14DC51f0A4d49d5E53C2E0950e0bC26d0Dce" as string | null,
    },
  },
  megaeth: {
    chainId: 4326,
    name: "MegaETH",
    alchemySlug: "megaeth-mainnet",
    rpcEnvVar: "MEGAETH_RPC_URL",
    blockExplorer: "https://megaeth.blockscout.com",
    confirmations: 2,
    tokens: {
      usdc: null as string | null,
      usdt: null as string | null,
      usde: "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34" as string | null,
      usdm: "0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7" as string | null,
      honey: null as string | null,
    },
  },
  hyperevm: {
    chainId: 999,
    name: "HyperEVM",
    alchemySlug: "hyperliquid-mainnet",
    rpcEnvVar: "HYPEREVM_RPC_URL",
    blockExplorer: "https://purrsec.com",
    confirmations: 2,
    tokens: {
      usdc: "0xb88339cb7199b77e23db6e890353e22632ba630f" as string | null, // Native Circle USDC
      usdt: null as string | null,
      usde: null as string | null,
      usdm: null as string | null,
      honey: null as string | null,
    },
  },
} as const;
