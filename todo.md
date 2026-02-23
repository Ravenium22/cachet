# Cachet — Remaining TODO

## A. LANDING PAGE (`/`)

- [x] **Add "How it works" section** — 3-step visual flow: (1) Add the bot, (2) Configure contracts & roles, (3) Users verify. Makes the value proposition immediately clear to new visitors.
- [x] **Add a hero animation or visual** — The landing page is text-heavy. A subtle animation (e.g., wallet connecting → role assigned) or a screenshot/mockup of the dashboard would break up the wall of uppercase text.
- [x] **Add a FAQ section to the landing page** — The `/pricing` page has one, but the homepage does not. Common questions like "How does it work?" and "Is it free?" help convert visitors.
- [x] **Consider adding a demo video or GIF** — A short screen recording of the verify flow (click button → connect wallet → role assigned) would demonstrate the product better than text alone.

## E. CONTRACTS

- [x] **Contract cards don't show verification count** — "This contract has verified X members" would add context. Requires a per-contract verification count API endpoint.

## F. ROLE MAPPINGS

- [x] **No drag-and-drop reordering** — If a user has many mappings, they may want to reorder them for clarity. Requires a DnD library.

## K. GLOBAL

- [x] **No toast notification system** — Every page manages its own `error`/`success` state strings. A global toast provider (e.g., `sonner`) would centralize notifications but requires a new dependency and refactoring all pages.

## L. PERFORMANCE

- [x] **Optimize the Cachet_logo.png** — 1 MB is large. Recommend compressing or converting to WebP/SVG outside of code.
- [x] **No bundle analysis** — Recommend running `@next/bundle-analyzer` as a dev-time check.

## M. DISCORD BOT

- [x] **Bot "About Me" section** — Must be set manually in the Discord Developer Portal (not a code change).
