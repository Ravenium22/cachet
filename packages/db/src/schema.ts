import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────────

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "growth",
  "pro",
  "enterprise",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "cancelled",
]);

export const contractTypeEnum = pgEnum("contract_type", [
  "erc721",
  "erc1155",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "active",
  "expired",
  "revoked",
]);

export const verificationEventEnum = pgEnum("verification_event", [
  "verified",
  "reverified",
  "roles_updated",
  "expired",
]);

export const cryptoPaymentStatusEnum = pgEnum("crypto_payment_status", [
  "pending",
  "submitted",
  "verifying",
  "confirmed",
  "expired",
  "failed",
]);

export const paymentChainEnum = pgEnum("payment_chain", [
  "ethereum",
  "base",
  "arbitrum",
]);

export const paymentTokenEnum = pgEnum("payment_token", [
  "usdc",
  "usdt",
]);

// ── Tables ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordGuildId: varchar("discord_guild_id", { length: 20 }).unique().notNull(),
    ownerDiscordId: varchar("owner_discord_id", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    verificationChannelId: varchar("verification_channel_id", { length: 20 }),
    settings: jsonb("settings").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_deleted_at_idx").on(table.deletedAt),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .unique()
      .notNull(),
    tier: subscriptionTierEnum("tier").notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 50 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 50 }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    verificationCount: integer("verification_count").default(0).notNull(),
  },
  (table) => [
    index("subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
    uniqueIndex("subscriptions_stripe_subscription_unique").on(table.stripeSubscriptionId),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    contractAddress: varchar("contract_address", { length: 42 }).notNull(),
    chain: varchar("chain", { length: 20 }).default("megaeth").notNull(),
    contractType: contractTypeEnum("contract_type").notNull(),
    name: varchar("name", { length: 100 }),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    uniqueIndex("contracts_project_address_chain_idx").on(
      table.projectId,
      table.contractAddress,
      table.chain,
    ),
  ],
);

export const roleMappings = pgTable(
  "role_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    contractId: uuid("contract_id")
      .references(() => contracts.id, { onDelete: "cascade" })
      .notNull(),
    discordRoleId: varchar("discord_role_id", { length: 20 }).notNull(),
    minNftCount: integer("min_nft_count").default(1).notNull(),
    tokenIds: integer("token_ids").array(),
    requiredTraits: jsonb("required_traits").$type<Record<string, unknown> | null>(),
    order: integer("order").default(0).notNull(),
  },
  (table) => [
    index("role_mappings_project_id_idx").on(table.projectId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userDiscordId: varchar("user_discord_id", { length: 20 }).notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    rolesGranted: varchar("roles_granted", { length: 20 }).array().default([]),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).defaultNow().notNull(),
    lastChecked: timestamp("last_checked", { withTimezone: true }).defaultNow().notNull(),
    status: verificationStatusEnum("status").notNull(),
  },
  (table) => [
    uniqueIndex("verifications_project_user_idx").on(
      table.projectId,
      table.userDiscordId,
    ),
    index("verifications_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    index("verifications_project_last_checked_idx").on(
      table.projectId,
      table.lastChecked,
    ),
  ],
);

export const verificationLogs = pgTable(
  "verification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    verificationId: uuid("verification_id")
      .references(() => verifications.id, { onDelete: "cascade" })
      .notNull(),
    eventType: verificationEventEnum("event_type").notNull(),
    details: jsonb("details").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("verification_logs_event_created_idx").on(table.eventType, table.createdAt),
  ],
);

export const cryptoPayments = pgTable(
  "crypto_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    tier: subscriptionTierEnum("tier").notNull(),
    billingPeriod: varchar("billing_period", { length: 10 }).notNull(),
    amountUsdCents: integer("amount_usd_cents").notNull(),
    token: paymentTokenEnum("token").notNull(),
    chain: paymentChainEnum("chain").notNull(),
    recipientAddress: varchar("recipient_address", { length: 42 }).notNull(),
    amountToken: varchar("amount_token", { length: 78 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }),
    senderAddress: varchar("sender_address", { length: 42 }),
    status: cryptoPaymentStatusEnum("status").default("pending").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("crypto_payments_project_id_idx").on(table.projectId),
    index("crypto_payments_status_idx").on(table.status),
    uniqueIndex("crypto_payments_tx_hash_unique").on(table.txHash),
    index("crypto_payments_expires_at_idx").on(table.expiresAt),
  ],
);
