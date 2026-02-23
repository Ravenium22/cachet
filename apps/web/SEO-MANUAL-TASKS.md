# Cachet SEO — Manual Tasks Walkthrough

These are the remaining SEO tasks that require manual action outside the codebase.

---

## 1. Submit to Google Search Console

Google currently has **zero pages indexed** for usecachet.com. This is the highest priority task.

### Steps

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click **Add Property**
3. Choose **URL prefix** and enter `https://usecachet.com`
4. Verify ownership using one of these methods:
   - **DNS TXT record** (recommended) — add a TXT record to your domain's DNS settings
   - **HTML file upload** — download the verification file and place it in `apps/web/public/`
   - **HTML meta tag** — add the provided meta tag to `apps/web/app/layout.tsx` inside metadata
5. Once verified:
   - Go to **Sitemaps** in the left sidebar
   - Enter `sitemap.xml` and click **Submit**
   - Go to **URL Inspection** at the top
   - Enter `https://usecachet.com/` and click **Request Indexing**
   - Repeat for `/pricing`, `/docs`, `/terms`, `/privacy`, `/refund-policy`

### DNS Verification Example

If using Cloudflare, Railway, or your DNS provider:

```
Type: TXT
Name: @
Value: google-site-verification=XXXXXXXXXXXXXXX   (provided by GSC)
```

---

## 2. Submit to Bing Webmaster Tools

Bing powers search for DuckDuckGo and other engines too.

### Steps

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Sign in with a Microsoft account
3. Click **Add your site** and enter `https://usecachet.com`
4. You can import directly from Google Search Console (easiest) or verify via DNS
5. Once verified, go to **Sitemaps** and submit `https://usecachet.com/sitemap.xml`

---

## 3. Build Initial Backlinks

Google needs external signals to discover and trust your domain. Target these categories:

### Web3 / MegaETH Ecosystem (High Priority)

- [ ] Get listed on the MegaETH ecosystem page or community resources
- [ ] Reach out to MegaETH team for a mention in their docs or tools section
- [ ] Submit to MegaETH-focused directories or community wikis

### Discord Bot Directories

- [ ] [top.gg](https://top.gg) — submit Cachet as a Discord bot
- [ ] [discord.bots.gg](https://discord.bots.gg) — another popular bot listing
- [ ] [discordbotlist.com](https://discordbotlist.com) — submit with NFT verification category
- [ ] [bots.ondiscord.xyz](https://bots.ondiscord.xyz)

### Web3 Tool Directories

- [ ] [alchemy.com/ecosystem](https://www.alchemy.com/ecosystem) — apply for listing
- [ ] [dappradar.com](https://dappradar.com) — submit as a tool/dapp
- [ ] [web3-tools](https://github.com/nicholasgriffintn/awesome-web3) — contribute to awesome-web3 lists on GitHub

### General Strategies

- [ ] Create a GitHub repository or open-source component and link back to usecachet.com
- [ ] Write a guest post on a crypto/web3 blog about NFT-gated communities
- [ ] Engage in relevant Discord servers and forums with your link in profile/signature

---

## 4. Content Strategy (Long-Term SEO Growth)

The site currently has 6 pages. To capture organic traffic in the NFT/Discord verification niche, you need more content surface.

### Blog (High Priority)

Create a `/blog` route and write articles targeting these keywords:

| Article Topic | Target Keywords | Priority |
|---|---|---|
| What is NFT Gating? A Complete Guide | `nft gating`, `token gated discord` | HIGH |
| How to Set Up NFT Verification on Discord | `nft verification discord`, `discord nft bot setup` | HIGH |
| Cachet vs Collab.Land: Which NFT Bot is Better? | `collab.land alternative`, `nft discord bot comparison` | HIGH |
| How MegaETH Communities Use Token Gating | `megaeth nft`, `megaeth discord` | MEDIUM |
| The Guide to Discord Role Management with NFTs | `discord role nft`, `automated discord roles` | MEDIUM |
| Why Gasless Verification Matters for Your Community | `gasless nft verification`, `free nft verification` | LOW |

### Comparison Pages

Create standalone pages comparing Cachet to competitors:

- [ ] `/compare/collab-land` — Cachet vs Collab.Land
- [ ] `/compare/vulcan` — Cachet vs Vulcan
- [ ] `/compare/guild-xyz` — Cachet vs Guild.xyz

These are high-intent pages. People searching for alternatives are ready to switch.

### Changelog

- [ ] Create `/changelog` — shows product updates, builds trust, creates recurring indexed content

---

## 5. Monitor & Iterate

### Weekly

- [ ] Check Google Search Console for indexing status and crawl errors
- [ ] Monitor impressions and clicks in GSC Performance report

### Monthly

- [ ] Review which pages are indexed vs expected (should be 6+)
- [ ] Check for any crawl errors or coverage issues
- [ ] Review keyword positions and identify new opportunities
- [ ] Update sitemap if new pages are added (blog posts, comparison pages)

### Tools to Set Up

| Tool | Purpose | URL |
|---|---|---|
| Google Search Console | Indexing, crawl errors, keyword data | search.google.com/search-console |
| Bing Webmaster Tools | Bing/DuckDuckGo indexing | bing.com/webmasters |
| Google Analytics 4 | Traffic tracking | analytics.google.com |
| Ahrefs Webmaster Tools | Free backlink monitoring | ahrefs.com/webmaster-tools |

---

## Summary Checklist

- [ ] Verify domain in Google Search Console
- [ ] Submit sitemap to Google Search Console
- [ ] Request indexing for all 6 pages
- [ ] Verify domain in Bing Webmaster Tools
- [ ] Submit sitemap to Bing
- [ ] Submit bot to top.gg
- [ ] Submit bot to discordbotlist.com
- [ ] Get listed on MegaETH ecosystem page
- [ ] Set up Google Analytics 4
- [ ] Plan first 3 blog articles
- [ ] Create at least 1 comparison page
