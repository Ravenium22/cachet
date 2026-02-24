// Subscription tiers
export type SubscriptionTier = "free" | "growth" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "past_due" | "cancelled";

export interface TierLimits {
  maxVerifiedMembers: number;
  maxServers: number;
  maxContracts: number;
  maxRoleMappings: number;
  maxAdminChecksPerMonth: number;
}

export interface BillingPlan {
  tier: SubscriptionTier;
  label: string;
  priceMonthlyUsd: number | null;
  priceAnnualUsd: number | null;
  description: string;
}

// Contracts
export type ContractType = "erc721" | "erc1155";

// Verification
export type VerificationStatus = "active" | "expired" | "revoked";
export type VerificationEvent = "verified" | "reverified" | "roles_updated" | "expired";

// JWT
export interface JwtAccessPayload {
  sub: string; // Discord user ID
  username: string;
  type: "access";
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string; // unique token ID for revocation
  type: "refresh";
}

// Discord OAuth
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// API responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Verification flow
/** Stored in Redis under vn:{token} during the 15-minute verification window. */
export interface VerifyTokenData {
  projectId: string;
  projectName: string;
  guildId: string;
  userDiscordId: string;
  nonce: string;
  createdAt: number; // epoch ms
}

/** Returned by GET /verify/:token to the frontend. */
export interface VerifyTokenInfo {
  projectName: string;
  message: string;
}

/** Returned by POST /verify/:token/complete. */
export interface VerifyCompleteResult {
  walletAddress: string;
  rolesGranted: string[];
  rolesRemoved: string[];
}

// ── Crypto Payments ───────────────────────────────────────────────────────

export type PaymentProvider = "crypto" | "paddle";
export type CryptoPaymentStatus = "pending" | "submitted" | "verifying" | "confirmed" | "expired" | "failed";
export type PaymentChain = "ethereum" | "base" | "arbitrum";
export type PaymentToken = "usdc" | "usdt";

export interface CryptoInvoice {
  id: string;
  projectId: string;
  tier: SubscriptionTier;
  billingPeriod: "monthly" | "annual";
  amountUsdCents: number;
  token: PaymentToken;
  chain: PaymentChain;
  recipientAddress: string;
  amountToken: string;
  txHash: string | null;
  senderAddress: string | null;
  status: CryptoPaymentStatus;
  periodStart: string | null;
  periodEnd: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Result of checking one role mapping against on-chain balance. */
export interface RoleMappingCheck {
  roleMappingId: string;
  discordRoleId: string;
  /** "qualified" = meets threshold, "not_qualified" = below threshold, "unknown" = RPC error */
  status: "qualified" | "not_qualified" | "unknown";
  balance: string; // stringified bigint, "0" for unknown
  required: number;
  error?: string; // populated when status === "unknown"
}
