# Cachet — Roadmap & TODO

> Last updated: February 2026

---

## 1. MULTI-CHAIN SUPPORT

Extend beyond MegaETH to support any EVM chain. The DB already has a `chain` column on `contracts`.

- [ ] **Chain registry in shared constants** — Add a `SUPPORTED_CHAINS` map with chain ID, name, RPC URL env var, block explorer URL, and native currency info. Start with: MegaETH, Ethereum, Polygon, Base, Arbitrum, Optimism, Avalanche, BSC.
- [ ] **Refactor `blockchain.ts` to multi-client** — Replace the singleton `PublicClient` with a `Map<string, PublicClient>` keyed by chain slug. Each function (`getERC721Balance`, `getERC1155Balance`, `detectContractType`, `checkRoleMappingBalance`) gets a `chain` parameter.
- [ ] **Thread `chain` through verification pipeline** — `verification.ts` and `reverify.ts` must pass `contract.chain` into every balance check call.
- [ ] **Update contracts route** — Add `chain` field to `addContractSchema` in `/projects/:id/contracts` (default: `"megaeth"` for backwards compat). Validate against `SUPPORTED_CHAINS`.
- [ ] **Update contract detect endpoint** — `/projects/:id/contracts/detect` needs a `chain` query param to know which RPC to call.
- [ ] **Prefix Redis cache keys with chain** — Change `rpc:721:{contract}:{owner}` → `rpc:{chain}:721:{contract}:{owner}`.
- [ ] **Frontend: multi-chain wagmi config** — Add supported chains to `wagmiConfig` in `wagmi.ts`. Wagmi handles chain switching natively.
- [ ] **Dashboard: chain selector on "Add Contract"** — Dropdown in the add-contract form. Show chain icon + name.
- [ ] **Dashboard: show chain badge on contract cards** — Small pill/badge (e.g., "Ethereum", "Base") next to each contract.
- [ ] **Per-chain RPC health monitoring** — Log RPC latency per chain; alert if a chain's RPC is consistently failing.

---

## 2. GIVEAWAY SYSTEM

Let server admins run NFT-gated or role-gated giveaways directly through the bot.

- [ ] **`/giveaway create` command** — Args: prize description, number of winners, duration (e.g., `1h`, `3d`), required role (optional), required contract+min holdings (optional). Creates an embed with a "Enter Giveaway" button. also creator should decide if giveaway is nft-weighted or not.
- [ ] **Giveaway entry button handler** — On click, verify the user meets eligibility (role gate or on-chain balance check). Store entry in DB.
- [ ] **DB schema: `giveaways` table** — Columns: `id`, `project_id`, `channel_id`, `message_id`, `prize`, `winner_count`, `ends_at`, `required_role_id`, `required_contract_id`, `min_holdings`, `status` (active/ended/cancelled), `created_by`, `created_at`.
- [ ] **DB schema: `giveaway_entries` table** — Columns: `id`, `giveaway_id`, `user_discord_id`, `entered_at`.
- [ ] **`/giveaway end` command** — Manually end early. Picks random winners, announces in channel, DMs winners.
- [ ] **`/giveaway reroll` command** — Re-pick a new winner if someone doesn't claim.
- [ ] **`/giveaway list` command** — Show active giveaways in the server.
- [ ] **Scheduled auto-end worker** — BullMQ job that ends giveaways when `ends_at` is reached.
- [ ] **Dashboard: giveaway management page** — View active/past giveaways, entries, winners. Create giveaways from web UI.

---

## 3. TOKEN-GATED CHANNELS

Allow admins to lock entire channels behind NFT ownership (not just roles).

- [ ] **`/gate channel` command** — Args: `#channel`, contract, min holdings. Bot manages channel permission overwrites.
- [ ] **Auto-revoke on re-verify failure** — If a user loses holdings during the 24h re-check, bot removes their channel access.
- [ ] **DB schema: `channel_gates` table** — `id`, `project_id`, `channel_id`, `contract_id`, `min_nft_count`, `token_ids`.
- [ ] **Dashboard: channel gate management** — Configure which channels are gated and with what requirements.

---

## 4. HOLDER SNAPSHOTS & ANALYTICS

- [ ] **`/snapshot` command** — Export a list of all verified holders and their wallet addresses for a specific contract. Output as CSV or paste. Also a diffrent command for snapshot on-chain and export that not only discord users. add options like pro-rata etc..
- [ ] **Dashboard: holder analytics page** — Charts showing verification trends over time, top holders, role distribution, chain breakdown.
- [ ] **Scheduled snapshot worker** — Nightly job that records holder counts per contract for historical trending.
- [ ] **DB schema: `snapshots` table** — `id`, `project_id`, `contract_id`, `holder_count`, `snapshot_date`.
- [ ] **Export to CSV** — Download button on the dashboard for holder lists.

---

## 5. ALLOWLIST / WHITELIST MANAGEMENT

- [ ] **`/allowlist create` command** — Create a named allowlist for a project (e.g., "Mint Allowlist Phase 1").
- [ ] **`/allowlist add` command** — Manually add wallet addresses or auto-populate from verified holders meeting criteria.
- [ ] **`/allowlist export` command** — Export the allowlist as a Merkle root (for on-chain mints) or CSV.
- [ ] **Dashboard: allowlist builder** — Filter verified holders by contract, min balance, role, etc. Generate Merkle tree.
- [ ] **DB schema: `allowlists` + `allowlist_entries` tables**.

---

## 6. WELCOME & ONBOARDING FLOW

- [x] **Custom welcome message on verify** — Let admins configure a welcome DM or channel post when someone successfully verifies. Supports embed templates with `{username}`, `{roles}`, `{wallet}` placeholders.
- [x] **`/welcome set` command** — Configure the welcome message template (done via dashboard settings instead of bot command).
- [ ] **Post-verify redirect** — After wallet verification on the web, optionally redirect to a custom URL (e.g., project website, claim page).

---

## 7. MODERATION UTILITIES

- [x] **`/lookup` command** — Look up a Discord user's linked wallet, verification status, roles granted, and last check time. Admin only.
- [x] **`/revoke` command** — Manually revoke a user's verification and remove all granted roles. Logs the action.
- [x] **`/reverify` command** — Force an immediate re-check of a specific user's holdings without waiting for the 24h cycle.
- [x] **`/audit` command** — Show recent verification activity (last 25 events: verified, revoked, roles changed).
- [ ] **Suspicious activity alerts** — If a wallet is linked to multiple Discord accounts across projects, flag it in logs.

---

## 8. LEADERBOARD & GAMIFICATION

- [ ] **`/leaderboard` command** — Show top holders by NFT count for a specific contract. Optionally across all contracts in the project.
- [ ] **Dashboard: public leaderboard embed** — Shareable link/widget showing top holders.
- [ ] **Achievement roles** — Auto-assign bonus roles based on thresholds (e.g., "Whale" for 10+ NFTs, "OG" for verified before a date).
- [ ] **DB schema: `achievement_rules` table** — `id`, `project_id`, `name`, `discord_role_id`, `condition_type`, `condition_value`.

---

## 9. POLLS & VOTING (NFT-WEIGHTED)

- [ ] **`/poll create` command** — Create a poll where votes are weighted by NFT holdings (1 NFT = 1 vote, or custom weight).
- [ ] **Poll embed with reaction/button voting** — Users click to vote; bot checks their on-chain balance at vote time.
- [ ] **`/poll results` command** — Show final tallied results with holder-weighted counts.
- [ ] **DB schema: `polls` + `poll_votes` tables**.

---

## 10. CROSS-SERVER AUTO-VERIFICATION

If a user already verified their wallet on Server A (which uses Cachet), they shouldn't have to sign again on Server B. Cachet knows who they are — skip the signature, go straight to balance checks, assign roles instantly. Zero friction, massive UX win.

- [ ] **Global wallet identity layer** — New `user_wallets` table: `id`, `user_discord_id`, `wallet_address`, `signature_hash`, `verified_at`, `last_used_at`. Decoupled from any single project. Populated on every successful verification.
- [ ] **Auto-verify on button click** — When a user clicks "Verify" on a new server, check `user_wallets` for an existing verified wallet. If found, skip the sign-message flow entirely — jump straight to on-chain balance checks for the new server's contracts and assign roles.
- [ ] **Auto-verify on guild join** — Listen to `guildMemberAdd` event. If the joining user has a verified wallet in `user_wallets` AND the guild has a Cachet project configured, immediately run balance checks and assign roles. User gets roles before they even open the channel.
- [ ] **Multi-wallet support** — Allow users to link multiple wallets to their Discord account (each requires one-time signature). Sum balances across all linked wallets for role qualification. Commands: `/wallet add`, `/wallet list`, `/wallet remove`.
- [ ] **Wallet chooser on verify page** — If the user has multiple verified wallets, show a picker: "Use an existing wallet" (instant) or "Connect a new wallet" (sign flow).
- [ ] **Project opt-out flag** — Let admins require a fresh signature per server via a `requireFreshSignature` toggle in project settings. Default: off (auto-verify enabled). Some projects may want stricter proof of liveness.
- [ ] **Cross-server trust indicator** — Show "Auto-verified via wallet 0xAB…CD (verified on 3 servers)" in the bot DM confirmation so the user understands what happened.
- [ ] **Stale wallet invalidation** — If a wallet hasn't been used in 90 days, mark it as stale and require a fresh signature on next verify. Prevents indefinite trust on old signatures.
- [ ] **Dashboard: linked wallets view** — Users can see all their linked wallets, when each was verified, and which servers they're active on. Admins can see wallet-to-user mappings for their project.

---

## 11. TRAIT-BASED ROLE ASSIGNMENT

The `roleMappings` table already has a `requiredTraits` JSONB column — wire it up. Huge for PFP projects where rarity matters.

- [ ] **On-chain metadata fetching** — For ERC-721, call `tokenURI()`, fetch the JSON metadata, and extract trait attributes. Cache metadata in Redis.
- [ ] **Trait filter on role mappings** — Let admins say "assign Diamond Hands role if user holds an NFT with `background = gold`" via the dashboard. Multiple trait conditions with AND/OR logic.
- [ ] **Dashboard: trait picker UI** — After adding a contract, auto-index available traits from metadata. Show dropdowns for trait_type and value when configuring a role mapping.
- [ ] **Trait-based balance counting** — `checkRoleMappingBalance` should filter: instead of just `balanceOf`, iterate `tokenOfOwnerByIndex` and check metadata traits against required traits.

---

## 12. ERC-20 TOKEN GATING

Not just NFTs — support fungible token balance requirements. "Hold 1,000 $TOKEN to get this role."

- [ ] **Add `erc20` to `contractTypeEnum`** — New contract type alongside `erc721` and `erc1155`.
- [ ] **ERC-20 `balanceOf` check** — Simpler than NFTs: just `balanceOf(owner)` and compare against a `minTokenAmount` (stored as string to handle large numbers / decimals).
- [ ] **Decimals-aware threshold** — Fetch `decimals()` on contract add, store it. Dashboard input shows human-readable amounts (e.g., "1000 USDC" not "1000000000").
- [ ] **Dashboard: token amount input** — When contract type is ERC-20, show a token amount field instead of NFT count.

---

## 13. DELEGATION SUPPORT (delegate.xyz / warm.xyz)

Let users verify with a hot wallet while their NFTs sit safely in a cold wallet or vault. Critical for whale retention.

- [ ] **Integrate delegate.xyz registry** — Check the on-chain delegation registry: if `hotWallet` is delegated by `coldWallet`, count `coldWallet`'s holdings when `hotWallet` signs.
- [ ] **warm.xyz support** — Same pattern — check warm.xyz's link contract.
- [ ] **Verification flow update** — On the verify page, after signature, check both the signer's direct holdings AND any vaults that have delegated to the signer. Sum them.
- [ ] **Dashboard: delegation toggle** — Per-project setting to enable/disable delegation support (some projects may want direct-hold only).

## 14. ANTI-SYBIL & WALLET REPUTATION

Detect and flag suspicious activity to protect community integrity.

- [ ] **Multi-account detection** — If the same wallet address tries to verify on multiple Discord accounts, flag it and optionally block.
- [ ] **Wallet age check** — Reject wallets younger than N days (configurable per project). Filters out freshly-created sybil wallets.
- [ ] **Contract wallet detection** — Check if the "wallet" is actually a smart contract (via `getCode`). Optionally block contract wallets.
- [ ] **Transfer recency check** — Flag if NFTs were transferred to the wallet within the last X hours (possible borrowing/wash).
- [ ] **Dashboard: flagged wallets view** — List of flagged wallets with reasons, admin can approve/block.
- [ ] **DB schema: `wallet_flags` table** — `id`, `wallet_address`, `flag_type`, `details`, `project_id`, `created_at`.

---

## 15. INFRASTRUCTURE & DEVOPS

- [ ] **Horizontal scaling for the worker** — Partition re-verify jobs by project ID so multiple worker instances don't overlap.
- [ ] **Health check endpoints** — `/health` and `/ready` for all services (API, bot, worker) for container orchestration.
- [ ] **Structured JSON logging** — Already have `logger.ts` but ensure all services output structured JSON for log aggregation.
- [ ] **Rate limit dashboard metrics** — Track and expose rate limit hit counts per endpoint.
- [ ] **Staging environment** — Separate Railway project for staging with seed data.



