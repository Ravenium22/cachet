**MegaETH Discord NFT**

**Verification SaaS**

Comprehensive Project Plan

Version 1.0 • February 2026

Multi-tenant SaaS for NFT-gated Discord role verification on MegaETH

# Table of Contents

# 1. Technical Architecture

This section covers the full system architecture, from high-level component design down to folder structure and technology choices.

## 1.1 System Overview

The platform consists of four main components that work together to deliver a seamless NFT verification experience:

|  |  |  |
| --- | --- | --- |
| **Component** | **Technology** | **Responsibility** |
| Discord Bot | Discord.js v14 + TypeScript | Slash commands, button interactions, role management, DM verification links |
| API Server | Express.js + TypeScript | REST API, Discord OAuth, wallet verification, webhook handlers |
| Frontend Dashboard | Next.js 14 (App Router) | Project config UI, analytics, Discord OAuth login, subscription management |
| Background Workers | Bull + Redis | Periodic re-verification (24h), subscription checks, stale data cleanup |
| Database | PostgreSQL 15 | Multi-tenant data, verifications, role mappings, subscription state |
| Cache Layer | Redis 7 | Session store, rate limiting, job queues, RPC response caching |

## 1.2 Verification Flow (Sequence)

The core verification flow is designed to be frictionless for end users while maintaining security:

**Step 1:** User clicks the "Verify" button in the Discord verification channel.

**Step 2:** Bot DMs the user a unique, time-limited verification link (expires in 15 minutes).

**Step 3:** User opens the link in their browser and connects their wallet via MetaMask or WalletConnect.

**Step 4:** User signs a deterministic message (e.g., "Verify Discord: <nonce>") — no gas fees.

**Step 5:** Backend recovers the signer address from the signature using ecrecover.

**Step 6:** Backend queries MegaETH RPC for NFT holdings (balanceOf / tokenOfOwnerByIndex).

**Step 7:** Based on holdings and role mappings, the bot assigns/removes Discord roles.

**Step 8:** User receives a DM confirmation with their assigned roles.

*Security note: Each verification link contains a cryptographically random nonce stored in Redis with a 15-minute TTL. Links are single-use and invalidated after completion or expiry.*

## 1.3 Project Directory Structure

Monorepo structure using npm workspaces:

megaeth-verify/

├── apps/

│ ├── api/ # Express API server

│ │ ├── src/

│ │ │ ├── routes/ # auth, projects, verify, webhooks

│ │ │ ├── services/ # discord, blockchain, verification

│ │ │ ├── middleware/ # auth, rateLimit, errorHandler

│ │ │ ├── jobs/ # reverify, cleanup workers

│ │ │ ├── db/ # migrations, queries, schema

│ │ │ └── index.ts

│ │ └── package.json

│ ├── bot/ # Discord bot process

│ │ ├── src/

│ │ │ ├── commands/ # slash command handlers

│ │ │ ├── events/ # guildCreate, interactionCreate

│ │ │ ├── buttons/ # button interaction handlers

│ │ │ └── index.ts

│ │ └── package.json

│ └── web/ # Next.js dashboard

│ ├── app/

│ │ ├── dashboard/ # project config pages

│ │ ├── verify/[token]/ # wallet verification page

│ │ └── api/ # Next.js API routes (auth)

│ └── package.json

├── packages/

│ ├── shared/ # types, constants, utils

│ └── db/ # Drizzle ORM schema + migrations

├── docker-compose.yml

├── package.json # workspace root

└── turbo.json # Turborepo config

## 1.4 Tech Stack Deep Dive

**Runtime & Language**

Node.js 20 LTS with TypeScript 5.x throughout. Strict mode enabled with path aliases. Shared types between all packages via the shared workspace package.

**Database: PostgreSQL + Drizzle ORM**

PostgreSQL is ideal for this multi-tenant workload: strong relational integrity, JSONB for flexible trait data, row-level security potential for future isolation. Drizzle ORM provides type-safe queries with minimal overhead and excellent migration tooling.

**Caching & Jobs: Redis + BullMQ**

Redis serves three purposes: (1) session storage for JWT refresh tokens, (2) rate limiting via sliding window counters, and (3) BullMQ job queues for background re-verification. The re-verification worker runs every 24 hours per project, processing verifications in batches of 50 to avoid RPC rate limits.

**Blockchain: viem**

viem over ethers.js for MegaETH RPC calls. viem provides better TypeScript support, tree-shaking, and a more modern API. Key operations: balanceOf (ERC-721), balanceOf with tokenId (ERC-1155), and tokenURI for future trait lookups.

**Frontend: Next.js 14 with App Router**

Server components for the dashboard reduce client-side JavaScript. The wallet verification page uses client components for MetaMask/WalletConnect integration via wagmi + viem. Tailwind CSS for styling, shadcn/ui for component library.

# 2. Database Design

The database schema is designed around multi-tenancy with projects as the primary isolation boundary. All tables reference project\_id for scoping.

## 2.1 Entity Relationship Overview

The core entities are: projects (tenants), contracts (NFT collections per project), role\_mappings (which NFTs map to which Discord roles), verifications (user wallet-to-Discord links), and subscriptions (billing state).

## 2.2 Table Definitions

**projects**

Central tenant table. One row per Discord server using the service.

|  |  |  |  |
| --- | --- | --- | --- |
| **Column** | **Type** | **Constraints** | **Description** |
| id | UUID | PK, DEFAULT gen\_random\_uuid() | Internal project identifier |
| discord\_guild\_id | VARCHAR(20) | UNIQUE, NOT NULL | Discord server ID |
| owner\_discord\_id | VARCHAR(20) | NOT NULL | Discord ID of project owner |
| name | VARCHAR(100) | NOT NULL | Display name (pulled from guild) |
| verification\_channel\_id | VARCHAR(20) | NULLABLE | Channel where verify button lives |
| settings | JSONB | DEFAULT '{}' | Custom messages, branding, etc. |
| created\_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated\_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**subscriptions**

Tracks billing state per project. Decoupled from projects for cleaner subscription lifecycle management.

|  |  |  |  |
| --- | --- | --- | --- |
| **Column** | **Type** | **Constraints** | **Description** |
| id | UUID | PK | Subscription identifier |
| project\_id | UUID | FK → projects.id, UNIQUE | One subscription per project |
| tier | ENUM | NOT NULL | 'free', 'growth', 'pro', 'enterprise' |
| status | ENUM | NOT NULL | 'active', 'past\_due', 'cancelled' |
| stripe\_customer\_id | VARCHAR(50) | NULLABLE | Stripe customer reference |
| stripe\_subscription\_id | VARCHAR(50) | NULLABLE | Stripe subscription reference |
| current\_period\_end | TIMESTAMPTZ | NOT NULL | When current billing period ends |
| verification\_count | INTEGER | DEFAULT 0 | Active verified members this period |

**contracts**

NFT contract addresses associated with a project. Supports multiple contracts per project.

|  |  |  |  |
| --- | --- | --- | --- |
| **Column** | **Type** | **Constraints** | **Description** |
| id | UUID | PK | Contract record identifier |
| project\_id | UUID | FK → projects.id | Parent project |
| contract\_address | VARCHAR(42) | NOT NULL | 0x-prefixed contract address |
| chain | VARCHAR(20) | DEFAULT 'megaeth' | Chain identifier |
| contract\_type | ENUM | NOT NULL | 'erc721' or 'erc1155' |
| name | VARCHAR(100) | NULLABLE | Human-readable collection name |
| is\_active | BOOLEAN | DEFAULT true | Soft-disable without deleting |

*Index: UNIQUE(project\_id, contract\_address, chain) — prevents duplicate contract entries per project.*

**role\_mappings**

Maps NFT ownership criteria to Discord roles. A project can have multiple mappings per contract.

|  |  |  |  |
| --- | --- | --- | --- |
| **Column** | **Type** | **Constraints** | **Description** |
| id | UUID | PK | Mapping identifier |
| project\_id | UUID | FK → projects.id | Parent project |
| contract\_id | UUID | FK → contracts.id | Which contract to check |
| discord\_role\_id | VARCHAR(20) | NOT NULL | Role to assign on match |
| min\_nft\_count | INTEGER | DEFAULT 1 | Minimum NFTs required |
| token\_ids | INTEGER[] | NULLABLE | Specific token IDs (ERC-1155) |
| required\_traits | JSONB | NULLABLE | Future: trait-based filtering |

**verifications**

Links Discord users to verified wallet addresses per project. Tracks verification state for re-checks.

|  |  |  |  |
| --- | --- | --- | --- |
| **Column** | **Type** | **Constraints** | **Description** |
| id | UUID | PK | Verification record identifier |
| project\_id | UUID | FK → projects.id | Which project this verification is for |
| user\_discord\_id | VARCHAR(20) | NOT NULL | User's Discord ID |
| wallet\_address | VARCHAR(42) | NOT NULL | Verified wallet address |
| roles\_granted | VARCHAR(20)[] | DEFAULT '{}' | Currently assigned role IDs |
| verified\_at | TIMESTAMPTZ | DEFAULT NOW() | Initial verification time |
| last\_checked | TIMESTAMPTZ | DEFAULT NOW() | Last re-verification check |
| status | ENUM | NOT NULL | 'active', 'expired', 'revoked' |

*Index: UNIQUE(project\_id, user\_discord\_id) — one verification per user per project.*

*Index: (project\_id, last\_checked) — for efficient re-verification batch queries.*

**verification\_logs**

Audit trail for all verification events. Append-only for debugging and analytics.

|  |  |  |  |
| --- | --- | --- | --- |
| **Column** | **Type** | **Constraints** | **Description** |
| id | UUID | PK | Log entry identifier |
| verification\_id | UUID | FK → verifications.id | Parent verification |
| event\_type | ENUM | NOT NULL | 'verified', 'reverified', 'roles\_updated', 'expired' |
| details | JSONB | DEFAULT '{}' | Event-specific data (holdings, roles changed) |
| created\_at | TIMESTAMPTZ | DEFAULT NOW() | Event timestamp |

# 3. API Endpoints

All API routes are prefixed with /api/v1. Authentication is via JWT (access + refresh tokens). Project-scoped routes require the authenticated user to be the project owner.

## 3.1 Authentication

|  |  |  |  |
| --- | --- | --- | --- |
| **Method** | **Endpoint** | **Auth** | **Description** |
| GET | /auth/discord | None | Redirect to Discord OAuth2 authorize URL |
| GET | /auth/discord/callback | None | Handle OAuth callback, create/update user, return JWT pair |
| POST | /auth/refresh | Refresh Token | Exchange refresh token for new access token |
| POST | /auth/logout | JWT | Invalidate refresh token in Redis |

## 3.2 Projects

|  |  |  |  |
| --- | --- | --- | --- |
| **Method** | **Endpoint** | **Auth** | **Description** |
| GET | /projects | JWT | List all projects owned by authenticated user |
| POST | /projects | JWT | Create project (requires guild\_id, bot must be in server) |
| GET | /projects/:id | JWT + Owner | Get project details with contracts and role mappings |
| PATCH | /projects/:id | JWT + Owner | Update project settings |
| DELETE | /projects/:id | JWT + Owner | Soft-delete project (preserves data for 30 days) |
| POST | /projects/:id/setup-channel | JWT + Owner | Create verification channel with embed + button |

## 3.3 Contracts & Role Mappings

|  |  |  |  |
| --- | --- | --- | --- |
| **Method** | **Endpoint** | **Auth** | **Description** |
| POST | /projects/:id/contracts | JWT + Owner | Add NFT contract to project |
| DELETE | /projects/:id/contracts/:cid | JWT + Owner | Remove contract (cascades to role mappings) |
| POST | /projects/:id/roles | JWT + Owner | Create role mapping (contract + role + criteria) |
| PATCH | /projects/:id/roles/:rid | JWT + Owner | Update role mapping criteria |
| DELETE | /projects/:id/roles/:rid | JWT + Owner | Delete role mapping |
| GET | /projects/:id/roles | JWT + Owner | List all role mappings with contract details |

## 3.4 Verification

|  |  |  |  |
| --- | --- | --- | --- |
| **Method** | **Endpoint** | **Auth** | **Description** |
| POST | /verify/initiate | Bot Internal | Bot calls this when user clicks verify button; returns unique link |
| GET | /verify/:token | None | Validate token, return project info for verification page |
| POST | /verify/:token/complete | None | Submit signed message + wallet address; triggers NFT check |
| GET | /projects/:id/verifications | JWT + Owner | List all verifications for a project (paginated) |
| POST | /verify/reverify/:id | JWT + Owner | Manually trigger re-verification for a specific user |

## 3.5 Subscriptions & Billing

|  |  |  |  |
| --- | --- | --- | --- |
| **Method** | **Endpoint** | **Auth** | **Description** |
| GET | /billing/plans | None | List available subscription tiers and pricing |
| POST | /billing/checkout | JWT | Create Stripe Checkout session for plan upgrade |
| POST | /billing/portal | JWT | Create Stripe Customer Portal session |
| POST | /webhooks/stripe | Stripe Sig | Handle subscription events (created, updated, cancelled) |

## 3.6 Analytics (Dashboard)

|  |  |  |  |
| --- | --- | --- | --- |
| **Method** | **Endpoint** | **Auth** | **Description** |
| GET | /projects/:id/stats | JWT + Owner | Verification counts, success rate, active holders |
| GET | /projects/:id/activity | JWT + Owner | Recent verification events (last 50) |

# 4. Development Roadmap

8-week development timeline, structured in 2-week sprints. Each sprint has clear deliverables and a definition of done.

## Sprint 1: Foundation (Weeks 1–2)

**Goal:** Repository setup, database schema, basic Discord bot, and core API scaffolding.

|  |  |  |  |
| --- | --- | --- | --- |
| **Task** | **Est. Hours** | **Priority** | **Notes** |
| Monorepo setup (npm workspaces, Turbo, TS config) | 4h | P0 | Shared tsconfig, path aliases, ESLint |
| PostgreSQL schema + Drizzle ORM setup | 6h | P0 | All tables, migrations, seed data |
| Redis setup + connection pooling | 2h | P0 | ioredis with reconnection strategy |
| Discord bot scaffolding (Discord.js v14) | 6h | P0 | Login, slash command registration, event handlers |
| Bot: /setup command (creates verification channel) | 4h | P0 | Embed with verify button, stores channel ID |
| Express API scaffolding + error handling | 4h | P0 | Middleware stack, validation (Zod), CORS |
| Discord OAuth flow (login) | 6h | P0 | JWT pair generation, refresh token in Redis |
| Docker Compose (Postgres + Redis + dev services) | 3h | P1 | Hot reload with volume mounts |

**Sprint 1 Deliverable:** Bot can join a server, create a verification channel with a clickable button, and the API accepts Discord OAuth logins.

## Sprint 2: Core Verification Flow (Weeks 3–4)

**Goal:** End-to-end wallet verification with NFT checking and role assignment.

|  |  |  |  |
| --- | --- | --- | --- |
| **Task** | **Est. Hours** | **Priority** | **Notes** |
| Verification link generation (nonce + Redis TTL) | 4h | P0 | Crypto-random token, 15min expiry |
| Bot: button interaction handler (DM verification link) | 3h | P0 | Error handling for closed DMs |
| Next.js verification page (wallet connect UI) | 8h | P0 | wagmi + WalletConnect, message signing |
| /verify/complete endpoint (signature verification) | 4h | P0 | ecrecover via viem, nonce validation |
| MegaETH RPC service (balanceOf, ERC-721/1155) | 6h | P0 | viem public client, retry logic, caching |
| Role assignment service (Discord API) | 4h | P0 | Add/remove roles, handle permission errors |
| Verification storage + logging | 3h | P0 | Write to verifications + verification\_logs tables |
| Bot: DM confirmation to user | 2h | P1 | Show assigned roles, link to dashboard |

**Sprint 2 Deliverable:** A user can click Verify in Discord, connect their wallet, prove NFT ownership, and receive Discord roles automatically.

## Sprint 3: Dashboard & Configuration (Weeks 5–6)

**Goal:** Full project management dashboard for NFT project owners.

|  |  |  |  |
| --- | --- | --- | --- |
| **Task** | **Est. Hours** | **Priority** | **Notes** |
| Dashboard layout (Next.js app router, sidebar nav) | 6h | P0 | Auth guard, project selector |
| Project overview page (stats, recent activity) | 6h | P0 | Verification counts, charts (recharts) |
| Contract management UI (add/remove NFT contracts) | 6h | P0 | Address validation, auto-detect type |
| Role mapping configuration UI | 8h | P0 | Fetch Discord roles via API, drag-and-drop mapping |
| Settings page (custom messages, branding) | 4h | P1 | Verification embed text, success/fail messages |
| Verification list (paginated, searchable) | 4h | P1 | Filter by status, wallet, date range |
| Manual re-verify action from dashboard | 3h | P1 | Single user or bulk re-verify trigger |

**Sprint 3 Deliverable:** Project owners can fully configure their verification setup through a web dashboard without touching Discord.

## Sprint 4: Billing, Re-verification & Launch (Weeks 7–8)

**Goal:** Monetization, background re-verification, hardening, and production deployment.

|  |  |  |  |
| --- | --- | --- | --- |
| **Task** | **Est. Hours** | **Priority** | **Notes** |
| Stripe integration (Checkout, Portal, Webhooks) | 8h | P0 | Product/price creation, webhook handler |
| Subscription enforcement middleware | 4h | P0 | Check tier limits on API routes |
| BullMQ re-verification worker | 6h | P0 | 24h cycle, batch processing, role updates |
| Rate limiting (per-project, per-IP) | 3h | P0 | Redis sliding window, configurable per tier |
| Error monitoring (Sentry) + structured logging | 3h | P0 | Winston/Pino, correlation IDs |
| Production Dockerfiles + CI/CD pipeline | 6h | P0 | Multi-stage builds, GitHub Actions |
| Infrastructure provisioning (Railway/Render) | 4h | P0 | Postgres, Redis, bot + API + web services |
| Landing page (marketing site) | 6h | P1 | Feature overview, pricing table, CTA |
| Load testing + security audit | 4h | P1 | k6 scripts, dependency audit, CORS review |

**Sprint 4 Deliverable:** Production-ready SaaS with billing, automatic re-verification, monitoring, and a marketing landing page.

## 4.1 Post-Launch Roadmap

Features planned for after initial launch, prioritized by user demand:

|  |  |  |  |
| --- | --- | --- | --- |
| **Feature** | **Timeline** | **Complexity** | **Description** |
| Trait-based role filtering | Month 2 | Medium | Parse tokenURI metadata, JSONB trait matching in role\_mappings |
| Multi-chain support | Month 2–3 | Medium | Abstract chain config, add ETH/Base/Arbitrum RPC providers |
| Webhook notifications | Month 3 | Low | Notify project owners on verification events via Discord webhook |
| Bulk import (CSV) | Month 3 | Low | Import pre-verified wallets for migration from other tools |
| White-label verification page | Month 4 | High | Custom domain, branding, CSS for enterprise tier |
| API access for projects | Month 4 | Medium | REST API keys for programmatic access to verification data |

# 5. Deployment & Infrastructure

## 5.1 Deployment Architecture

The recommended deployment strategy prioritizes simplicity and cost-effectiveness for launch, with a clear path to scale.

**Recommended: Railway (or Render)**

Railway provides the best developer experience for this stack. It supports Docker deployments, managed Postgres and Redis, automatic SSL, and preview environments per PR. Cost is usage-based, which aligns well with SaaS economics.

|  |  |  |  |
| --- | --- | --- | --- |
| **Service** | **Platform** | **Specs (Launch)** | **Est. Cost/mo** |
| API Server | Railway | 1 vCPU, 512MB RAM | $5–10 |
| Discord Bot | Railway | 1 vCPU, 512MB RAM | $5–10 |
| Next.js Web | Vercel (free tier) | Serverless | $0 |
| PostgreSQL | Railway (managed) | 1GB storage | $5–10 |
| Redis | Railway (managed) | 25MB | $5 |
| Domain + SSL | Cloudflare | DNS + proxy | $0 |

**Estimated launch cost:** $20–45/month before revenue. This comfortably handles 50–100 projects and thousands of verifications.

**Scale-Up Path**

When you outgrow Railway (roughly 500+ active projects or 100k+ verifications/month), the migration path is straightforward: containerize everything with Docker, deploy to AWS ECS or Fly.io, switch to RDS for Postgres and ElastiCache for Redis. The monorepo structure and Docker Compose setup make this transition smooth.

## 5.2 Environment Configuration

All configuration via environment variables. No secrets in code or config files.

|  |  |  |
| --- | --- | --- |
| **Variable** | **Service** | **Description** |
| DATABASE\_URL | API, Workers | PostgreSQL connection string |
| REDIS\_URL | API, Bot, Workers | Redis connection string |
| DISCORD\_BOT\_TOKEN | Bot | Discord bot authentication token |
| DISCORD\_CLIENT\_ID | API, Web | OAuth2 application client ID |
| DISCORD\_CLIENT\_SECRET | API | OAuth2 application client secret |
| MEGAETH\_RPC\_URL | API, Workers | MegaETH JSON-RPC endpoint |
| JWT\_SECRET | API | Signing key for access tokens |
| JWT\_REFRESH\_SECRET | API | Signing key for refresh tokens |
| STRIPE\_SECRET\_KEY | API | Stripe API key |
| STRIPE\_WEBHOOK\_SECRET | API | Stripe webhook signing secret |
| NEXT\_PUBLIC\_API\_URL | Web | API base URL for frontend |
| SENTRY\_DSN | All | Error monitoring endpoint |

## 5.3 CI/CD Pipeline

GitHub Actions workflow with three stages:

**1. Validate:** TypeScript compilation, ESLint, unit tests (Vitest), and Drizzle schema validation run on every PR.

**2. Build:** Multi-stage Docker builds for api, bot, and web. Images tagged with git SHA and pushed to GitHub Container Registry.

**3. Deploy:** Automatic deployment to Railway on merge to main. Preview deployments on PRs via Railway's GitHub integration.

## 5.4 Monitoring & Observability

|  |  |  |
| --- | --- | --- |
| **Layer** | **Tool** | **What It Tracks** |
| Error Tracking | Sentry | Unhandled exceptions, failed verifications, RPC errors |
| Logging | Pino + Railway Logs | Structured JSON logs with correlation IDs |
| Uptime | BetterStack (free) | HTTP endpoint monitoring, bot heartbeat |
| Metrics | Stripe Dashboard + custom | Revenue, churn, verification volume |
| Alerts | Sentry + Discord webhook | Error spikes, bot disconnect, RPC failures |

# 6. Monetization & Pricing Strategy

## 6.1 Competitive Analysis: Collab.Land

Collab.Land is the primary competitor in Discord NFT verification. Their pricing has significant gaps that we can exploit. Below is their current tier structure:

|  |  |  |  |
| --- | --- | --- | --- |
| **Tier** | **Price** | **Verified Members** | **Key Limitations** |
| Starter | Free | 25 | No custom messages, no priority support, basic only |
| Basic | $17.99/mo | 100 | No multi-wallet, no priority support |
| Premium | $35/mo | 1,000 | No custom messages, no admin-initiated checks |
| Exclusive | $149/mo | 2,500 | Admin checks limited to 5/mo |
| Elite | $449/mo | 7,500 | Still no white-label, no API access |
| Enterprise | Contact | Unlimited | Custom pricing, full feature set |

*Source: Collab.Land pricing page, February 2026. They also charge for add-ons like SmartTag and PRO miniapp bundles.*

**Key Weaknesses to Exploit**

**1. Overpriced mid-tier:** $35/mo for just 1,000 members with no custom messages is steep. Most growing communities hit 1K members quickly.

**2. Massive jump to 2,500+ members:** Going from 1,000 to 2,500 members requires jumping from $35 to $149 — a 4x price increase for 2.5x the capacity.

**3. Premium features gated too high:** Custom verification messages, admin-initiated checks, and dedicated support are locked behind $149+. These should be standard features.

**4. No MegaETH specialization:** Collab.Land supports 50+ chains generically. We can offer a superior MegaETH-native experience with faster RPC integration and ecosystem partnerships.

## 6.2 Our Pricing Model

Three clear tiers plus a contact-based enterprise option. Per-server monthly subscription. Designed to undercut Collab.Land at every comparison point while maintaining healthy margins.

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
| **Feature** | **Free** | **Growth ($14.99/mo)** | **Pro ($39.99/mo)** | **Enterprise** |
| Verified Members | 100 | 1,500 | 10,000 | Unlimited |
| Discord Servers | 1 | 1 | 3 | Unlimited |
| NFT Contracts | 1 | 5 | Unlimited | Unlimited |
| Role Mappings | 3 | Unlimited | Unlimited | Unlimited |
| Re-verification | 24h | 24h auto | Configurable (1h–24h) | Real-time listener |
| Multi-wallet Support | No | Yes | Yes | Yes |
| Custom Verify Message | No | Yes | Yes | Yes |
| Dashboard Analytics | Basic | Full | Full + CSV Export | Full + API |
| Admin-initiated Checks | No | 5/mo | Unlimited | Unlimited |
| Priority Support | Community | Email | Email + Discord | Dedicated human |
| Trait-based Roles | No | No | Yes (future) | Yes |
| White-label Page | No | No | No | Yes |
| API Access | No | No | No | Yes |

## 6.3 Head-to-Head Comparison

Direct comparison showing how our pricing beats Collab.Land at every level:

|  |  |  |  |
| --- | --- | --- | --- |
| **Comparison Point** | **MegaVerify** | **Collab.Land** | **Our Advantage** |
| Free tier members | 100 | 25 | 4x more members on free |
| 1,000+ members | $14.99/mo (1,500) | $35/mo (1,000) | 57% cheaper, 50% more members |
| Custom verify messages | $14.99/mo | $149/mo | Available 10x cheaper |
| Unlimited role mappings | $14.99/mo | $149/mo | Available 10x cheaper |
| 10,000 members | $39.99/mo | $449+/mo (7,500 cap) | 91% cheaper, 33% more members |
| Admin-initiated checks | Unlimited @ $39.99 | 5/mo @ $149 | Unlimited vs rationed |
| MegaETH optimization | Native, built for it | Generic multi-chain | Faster, purpose-built |

**Bottom line:** A community with 10,000 members saves $4,908/year by choosing us over Collab.Land ($39.99 vs $449/mo). This is the core sales pitch.

## 6.4 Pricing Rationale

**Free ($0) — Adoption Driver**

100 verified members (4x Collab.Land's 25) creates a genuinely useful free tier. Small projects can fully operate here, which drives word-of-mouth. The 100-member cap is high enough to be useful but low enough that any growing community will need to upgrade within 2–3 months.

**Growth ($14.99/mo) — Conversion Target**

This is the bread-and-butter tier. At $14.99, it undercuts Collab.Land's $35 Premium while offering 50% more members (1,500 vs 1,000) and features they gate at $149 (custom messages, unlimited role mappings). Most projects will land here. Target conversion: 15–20% of free tier users within 3 months.

**Pro ($39.99/mo) — The Killer Deal**

10,000 verified members for under $40/mo is the headline number. Collab.Land charges $449/mo for 7,500 members. This tier targets established projects and makes the ROI argument trivially easy: switch to us and save $400+/month. Multi-server support (up to 3) and configurable re-verification intervals are additional differentiators.

**Enterprise (Contact Us) — High-Margin Custom**

No listed price. Targets DAOs, gaming studios, and large ecosystem projects. White-label verification pages, unlimited servers, real-time event listeners, dedicated support, and API access. Pricing based on needs, typically $99–299/mo depending on volume and customization. This tier has the highest margins because the incremental infrastructure cost is minimal.

## 6.5 Why This Pricing Is Sustainable

Our cost structure allows aggressive pricing that Collab.Land cannot easily match:

**Low marginal cost per member:** Re-verification is one balanceOf RPC call per member per 24h cycle. At 10,000 members, that's ~10K RPC calls/day — well within free/low-cost RPC limits on MegaETH.

**Single-chain focus:** Supporting only MegaETH (for now) eliminates the complexity and cost of maintaining 50+ chain integrations. This keeps our infrastructure lean.

**Modern stack efficiency:** BullMQ batch processing means re-verification runs efficiently in background workers, not blocking API servers. Redis caching of RPC responses reduces duplicate calls.

**Infrastructure cost:** At $20–45/mo for hosting (see Section 5), we only need 2–3 Growth subscribers to break even. Everything beyond that is margin.

## 6.6 Revenue Projections

Conservative projections based on MegaETH ecosystem growth and competitive positioning:

|  |  |  |  |
| --- | --- | --- | --- |
| **Metric** | **Month 3** | **Month 6** | **Month 12** |
| Free projects | 40 | 120 | 350 |
| Growth subscribers ($14.99) | 8 | 30 | 80 |
| Pro subscribers ($39.99) | 2 | 10 | 30 |
| Enterprise subscribers | 0 | 1 | 3 |
| Monthly Revenue | $200 | $849 | $2,697 |
| Annual Run Rate | $2,400 | $10,188 | $32,364 |
| Infrastructure Cost | $35/mo | $60/mo | $120/mo |
| Net Margin | 83% | 93% | 96% |

*Assumes 15–20% free-to-paid conversion, 2-month average time to convert, and 5% monthly churn on paid tiers. Enterprise revenue estimated at $199/mo average.*

## 6.7 Billing Implementation

Stripe handles all billing complexity. Implementation details:

**Checkout:** Stripe Checkout Sessions for initial subscription. Redirects to success/cancel URLs. Free tier requires no payment method.

**Management:** Stripe Customer Portal for plan changes, payment method updates, and cancellation. No custom billing UI needed at launch.

**Webhooks:** Listen for checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, and invoice.payment\_failed events.

**Enforcement:** Middleware checks subscription tier and verified\_member\_count on protected routes. When a project hits their member cap, new verifications return a 402 with an upgrade prompt. Existing verified members are never removed due to billing limits.

**Grace period:** Failed payments get a 7-day grace period before downgrade. Bot continues functioning during grace period to avoid disrupting communities.

## 6.8 Growth Strategies

**1. MegaETH ecosystem partnerships:** Reach out to early MegaETH NFT projects directly. Offer free Pro tier for the first 3 months in exchange for testimonials and case studies.

**2. Competitive migration campaigns:** Target Collab.Land users on MegaETH with direct comparison landing pages. Offer one-click migration tooling that imports their existing contract addresses and role mappings.

**3. Discord bot directories:** List on top.gg, Discord.bots.gg, and similar directories. The generous free tier drives organic discovery and install volume.

**4. Content marketing:** Write guides on MegaETH NFT development, token-gating strategies, and community management. Position as the MegaETH community infrastructure expert.

**5. Referral program (Month 3+):** Give existing customers 20% revenue share on referred paid subscriptions for 12 months. Low CAC growth channel.

# 7. Security Considerations

Security is critical for a service handling wallet verification and Discord access. Key areas:

## 7.1 Authentication & Authorization

**JWT tokens:** Short-lived access tokens (15min) with long-lived refresh tokens (7 days) stored in Redis. Refresh token rotation on every use.

**Project ownership:** All project-scoped API routes verify the authenticated user's Discord ID matches the project's owner\_discord\_id.

**Bot permissions:** Bot uses internal API authentication (shared secret) for verification initiation. Never exposed to end users.

## 7.2 Wallet Verification Security

**Nonce management:** Verification nonces are cryptographically random (32 bytes), stored in Redis with 15-minute TTL, and deleted immediately after use. Prevents replay attacks.

**Signature verification:** Messages follow EIP-191 personal\_sign format. The exact message template is deterministic: "Verify Discord account for [Project Name]\nNonce: [nonce]". This prevents signature reuse across projects.

**Address validation:** Wallet addresses are checksummed (EIP-55) before storage. All RPC queries use the checksummed address.

## 7.3 Rate Limiting

|  |  |  |
| --- | --- | --- |
| **Endpoint** | **Limit** | **Window** |
| Verification initiation | 5 requests | per user per 15 minutes |
| Verification completion | 3 attempts | per token (then invalidate) |
| API routes (authenticated) | 100 requests | per minute per user |
| API routes (public) | 20 requests | per minute per IP |
| Stripe webhooks | No limit | Verified by signature |

## 7.4 Data Protection

**Wallet addresses** are stored in plaintext (they're public on-chain anyway). Discord IDs are also inherently public.

**No private keys** are ever handled by the service. Wallet verification uses message signing only.

**Stripe tokens** are stored as references only (customer\_id, subscription\_id). No payment card data touches your servers.

**GDPR compliance:** Users can request data deletion. The soft-delete on projects preserves billing records while removing PII.

# 8. Quick Start Checklist

Use this checklist to get started on day one:

**Pre-development setup:**

☐ Create Discord Application at discord.com/developers (bot + OAuth2 scopes)

☐ Set up MegaETH RPC endpoint (check MegaETH docs for public/private RPC)

☐ Create Stripe account + test mode API keys

☐ Set up GitHub repository with branch protection rules

☐ Create Railway account and link to GitHub

**Development environment:**

☐ Clone monorepo, run npm install at root

☐ Copy .env.example to .env and fill in credentials

☐ docker compose up -d (Postgres + Redis)

☐ Run Drizzle migrations: npx drizzle-kit push

☐ Start all services: turbo dev

**First milestone (end of day 1):**

☐ Bot is online and responds to /ping

☐ API server starts and connects to database

☐ Next.js dev server runs at localhost:3000

☐ Discord OAuth login works end-to-end

*This document is a living plan. Revisit and update it as requirements evolve during development.*
