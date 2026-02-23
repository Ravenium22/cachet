import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Pricing — Cachet NFT Verification for Discord",
    description:
        "Free, Growth, Pro, and Enterprise plans for NFT-gated Discord verification on MegaETH. Start free with 100 verified members. No credit card required.",
    alternates: {
        canonical: "/pricing",
    },
    openGraph: {
        title: "Pricing — Cachet NFT Verification",
        description:
            "Simple pricing tiers built for NFT communities. Start free, scale as you grow.",
        url: "https://usecachet.com/pricing",
    },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
