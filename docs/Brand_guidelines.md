# Cachet: Brand Guidelines
**Version:** 1.0
**Project:** Multi-tenant SaaS for NFT-gated Discord role verification on MegaETH

## 1. Brand Identity
**Name:** Cachet (pronounced *ka-shay*)
**Meaning:** A distinguishing mark or seal of approval; prestige.
**Vibe:** Sleek, minimalist, authoritative, and frictionless. 

The brand communicates trust and technical precision without relying on flashy Web3 tropes. We do not use gradients, neon glows, or heavy shadows. The aesthetic is strictly flat, high-contrast, and utilitarian.

## 2. Logo Constraints
Since the brand relies heavily on minimalism:
* **Wordmark:** The primary logo should be a simple, heavy-weight wordmark in the primary sans-serif font, strictly in lowercase (`cachet.`).
* **Icon (The "Seal"):** A sharp, geometric monogram or an abstract representation of a seal/stamp. 
* **Rules:**
    * No 3D effects.
    * No gradients.
    * Must be legible at 16x16px (favicon size).
    * Primary logo color is White (`#FFFFFF`) or Brand Green (`#0A8F54`) on a True Black (`#000000`) background.

## 3. Color Palette
The interface relies on extreme contrast. The background is an absolute void, structured by thin, muted green lines and stark white typography. No neon, no gradients.

| Usage | Color Name | Hex Code | Description |
| :--- | :--- | :--- | :--- |
| **Background** | True Black | `#000000` | The base canvas for the entire application. |
| **Surface** | Dark Void | `#0A0A0A` | Used sparingly for slight elevation (e.g., dropdowns). |
| **Primary Accent** | Standard Green | `#0A8F54` | The core brand color. Used for primary buttons, active states, and 1px structural borders. |
| **Text (Primary)** | Pure White | `#FFFFFF` | Main headings and high-emphasis body text. |
| **Text (Muted)** | Ash Gray | `#A3A3A3` | Secondary text, table headers, and inactive states. |
| **Error** | Flat Red | `#DC2626` | Used strictly for destructive actions or failed verifications. |

## 4. Typography
A dual-font system that balances sleek, modern SaaS readability with technical precision. 

**1. Primary Font: Geist (or Inter)**
* **Role:** Used for headings, UI elements (buttons, nav), and standard body copy. 
* **Style:** Clean, geometric sans-serif.
* **Weights:** Regular (400) for body, Medium (500) for UI components, Semibold (600) for headings.

**2. Secondary Font: Geist Mono (or JetBrains Mono)**
* **Role:** Used strictly for technical data.
* **Usage:** Wallet addresses, Discord IDs, token IDs, code snippets, and transaction hashes. 
* **Weights:** Regular (400).

## 5. UI Geometry & Spacing (px)
The UI should feel like a precision instrument. We avoid the heavily rounded "bubbly" look of standard consumer apps.

* **Border Radius:** * Global rule: `0px` (sharp corners) or `2px` (micro-rounding to take the digital edge off). 
    * Do not use standard `0.5rem` (8px) rounding.
* **Borders:** * Use `1px solid #0A8F54` (Brand Green) to separate layout sections or outline input fields instead of using background fills.
* **Shadows:** * **None.** Rely entirely on 1px borders to separate elements on the black background. 
* **Spacing System (Base-4):**
    * Micro: `4px` (gap between icon and text)
    * Tight: `8px` (padding inside inputs)
    * Base: `16px` (standard container padding)
    * Loose: `32px` (spacing between major dashboard sections)
    * Macro: `64px` (page margins)

## 6. Tone of Voice
* **Direct:** "Connect your wallet." (Not "Please go ahead and connect your crypto wallet!")
* **Professional:** You are serving project owners and community managers. Speak like an enterprise tool.
* **Confident:** Do not over-explain. The UI should be intuitive enough that the text can remain brief.