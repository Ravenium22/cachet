import type { Metadata } from "next";
import Link from "next/link";
import { StaticHeader } from "@/components/StaticHeader";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
    title: "Documentation — Cachet",
    description: "Setup instructions, bot commands, and getting started guide for Cachet NFT verification.",
};

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-brand-black text-brand-white flex flex-col font-sans">
            <StaticHeader />

            <main className="flex-1">
                <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
                    <h1 className="text-3xl font-semibold uppercase tracking-tight text-brand-white">
                        Documentation
                    </h1>
                    <p className="mt-4 font-mono text-sm uppercase tracking-widest text-brand-gray">
                        SETUP_INSTRUCTIONS_AND_BOT_COMMANDS
                    </p>

                    {/* Getting Started */}
                    <section id="getting-started" className="mt-12">
                        <h2 className="text-xl font-semibold uppercase tracking-tight text-brand-green">
                            Getting Started
                        </h2>
                        <div className="mt-4 space-y-4 font-mono text-sm text-brand-gray leading-relaxed">
                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white">1. ADD THE BOT</p>
                                <p className="mt-2">
                                    Invite Cachet to your Discord server using the login button on the{" "}
                                    <Link href="/" className="text-brand-green hover:text-brand-white transition underline">
                                        homepage
                                    </Link>
                                    . You&apos;ll authenticate via Discord OAuth and be redirected to your dashboard.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white">2. RUN /SETUP</p>
                                <p className="mt-2">
                                    In your Discord server, use the <code className="text-brand-green">/setup</code> command.
                                    This creates a <code className="text-brand-green">#verify</code> channel with a verification
                                    button. Only server administrators can run this command.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white">3. ADD NFT CONTRACTS</p>
                                <p className="mt-2">
                                    Go to your{" "}
                                    <Link href="/dashboard" className="text-brand-green hover:text-brand-white transition underline">
                                        dashboard
                                    </Link>
                                    , select your project, and navigate to the <strong className="text-brand-white">Contracts</strong> tab.
                                    Add the ERC-721 or ERC-1155 contract addresses you want to verify against.
                                    The bot will auto-detect the contract type.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white">4. CREATE ROLE MAPPINGS</p>
                                <p className="mt-2">
                                    In the <strong className="text-brand-white">Role Mappings</strong> tab, map your NFT contracts
                                    to Discord roles. Set the minimum NFT count required and, for ERC-1155,
                                    specify which token IDs qualify.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white">5. MEMBERS VERIFY</p>
                                <p className="mt-2">
                                    Community members click the <strong className="text-brand-white">Verify</strong> button in
                                    your #verify channel, receive a DM with a verification link, connect their wallet,
                                    sign a message (no gas fees), and roles are assigned automatically based on their holdings.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white">6. AUTOMATIC RE-VERIFICATION</p>
                                <p className="mt-2">
                                    Cachet automatically re-checks on-chain balances every 24 hours. If a member
                                    sells their NFTs, their roles are revoked. If they acquire new qualifying NFTs,
                                    roles are granted.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Bot Commands */}
                    <section id="commands" className="mt-16">
                        <h2 className="text-xl font-semibold uppercase tracking-tight text-brand-green">
                            Bot Commands
                        </h2>
                        <div className="mt-4 space-y-3">
                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <div className="flex items-baseline gap-3">
                                    <code className="font-mono text-sm font-semibold text-brand-white">/setup</code>
                                    <span className="rounded-[2px] border border-brand-gray/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-brand-gray">
                                        ADMIN ONLY
                                    </span>
                                </div>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    Creates a #verify channel with a verification button. Automatically creates
                                    a project in the Cachet dashboard and provisions a free-tier subscription.
                                    If a project already exists for this server, it will be reactivated.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <code className="font-mono text-sm font-semibold text-brand-white">/status</code>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    Shows verification statistics for the current server: total verifications,
                                    active verified members, verifications in the last 7 days, and the current
                                    subscription tier.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <code className="font-mono text-sm font-semibold text-brand-white">/ping</code>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    Health check. Returns bot latency and WebSocket ping to verify the bot is
                                    running and responsive.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <code className="font-mono text-sm font-semibold text-brand-white">/help</code>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    Lists all available commands with descriptions and links to the dashboard,
                                    pricing page, and terms.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* FAQ */}
                    <section id="faq" className="mt-16">
                        <h2 className="text-xl font-semibold uppercase tracking-tight text-brand-green">
                            FAQ
                        </h2>
                        <div className="mt-4 space-y-3">
                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white font-mono text-sm">DOES VERIFICATION COST GAS?</p>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    No. Verification only requires signing a message with your wallet, which is
                                    free. No on-chain transactions are made during verification.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white font-mono text-sm">WHICH CHAINS ARE SUPPORTED?</p>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    Currently MegaETH only (chain ID 6342). Support for additional EVM chains
                                    may be added in the future.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white font-mono text-sm">WHAT WALLETS ARE SUPPORTED?</p>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    Any wallet that supports WalletConnect or browser injection — MetaMask,
                                    Coinbase Wallet, Rainbow, Rabby, Trust Wallet, Phantom, Brave, and more.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white font-mono text-sm">HOW OFTEN ARE HOLDINGS RE-CHECKED?</p>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    Every 24 hours via a background worker. If a member no longer holds the
                                    required NFTs, their roles are automatically revoked.
                                </p>
                            </div>

                            <div className="rounded-[2px] border border-brand-green bg-brand-void p-4">
                                <p className="font-semibold text-brand-white font-mono text-sm">CAN I DELETE MY DATA?</p>
                                <p className="mt-2 font-mono text-sm text-brand-gray">
                                    Yes. You can delete your project from the dashboard settings page. For full
                                    account data deletion, email{" "}
                                    <a href="mailto:support@usecachet.com" className="text-brand-green hover:text-brand-white transition underline">
                                        support@usecachet.com
                                    </a>.
                                    See our{" "}
                                    <Link href="/privacy" className="text-brand-green hover:text-brand-white transition underline">
                                        Privacy Policy
                                    </Link>{" "}
                                    for details.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <Footer activePage="docs" />
        </div>
    );
}
