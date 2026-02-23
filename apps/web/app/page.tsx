"use client";

import Link from "next/link";
import { BILLING_PLANS, TIER_LIMITS } from "@megaeth-verify/shared";
import { Header } from "@/components/Header";
import { HeroCTA, PricingCTA } from "@/components/AuthCTA";
import { InteractiveDemo } from "@/components/InteractiveDemo";

function formatLimit(value: number): string {
    if (!Number.isFinite(value)) {
        return "Unlimited";
    }

    return value.toLocaleString();
}

export default function HomePage() {
    return (
        <div className="min-h-screen bg-brand-black text-brand-white flex flex-col font-sans">
            <Header showAuth />

            <main className="relative flex-1 overflow-hidden">
                {/* Absolute void structured by thin, muted green lines */}
                <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(10,143,84,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(10,143,84,0.3)_1px,transparent_1px)] [background-size:34px_34px]" />

                <section className="relative mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:px-12">
                    <div className="rounded-[2px] border border-brand-green bg-brand-void p-8 lg:p-12 overflow-hidden relative">
                        {/* subtle gradient glow behind everything */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-green/20 rounded-full blur-[120px] pointer-events-none opacity-50"></div>

                        <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
                            <div>
                                <p className="inline-flex items-center rounded-[2px] border border-brand-green bg-brand-black px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-green">
                                    DISCORD VERIFICATION FOR MEGAETH
                                </p>

                                <h1 className="mt-8 text-4xl font-semibold uppercase leading-tight tracking-tight sm:text-5xl lg:text-6xl text-brand-white">
                                    STRICT NFT VERIFICATION. <br /> AUTOMATED ROLES.
                                </h1>

                                <p className="mt-6 max-w-xl font-mono text-xs sm:text-sm uppercase tracking-widest text-brand-gray leading-relaxed">
                                    Cachet connects wallets, checks on-chain ownership, and manages Discord roles. Frictionless structure. Zero compromise.
                                </p>

                                <div className="mt-10 flex flex-wrap items-center gap-4">
                                    <HeroCTA />

                                    <a
                                        href="#pricing"
                                        className="rounded-[2px] border border-brand-green bg-brand-black px-8 py-4 font-mono text-sm font-semibold tracking-widest text-brand-white transition hover:bg-brand-green/20 hover:text-brand-white uppercase"
                                    >
                                        VIEW PRICING
                                    </a>

                                    <a
                                        href="https://discord.com/oauth2/authorize?client_id=1328080644336189562"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-[2px] border border-brand-green bg-brand-black px-8 py-4 font-mono text-sm font-semibold tracking-widest text-[#5865F2] transition hover:bg-[#5865F2]/10 uppercase"
                                    >
                                        ADD BOT TO DISCORD
                                    </a>
                                </div>
                            </div>

                            {/* Hero Visual Mockup */}
                            <div className="hidden lg:block relative">
                                <div className="rounded-[2px] border border-brand-green bg-brand-black p-4 shadow-2xl skew-y-2 transform transition hover:skew-y-0 duration-500">
                                    <div className="flex items-center gap-2 mb-4 border-b border-brand-green/30 pb-4">
                                        <div className="h-3 w-3 rounded-full bg-red-500/80 border border-red-500"></div>
                                        <div className="h-3 w-3 rounded-full bg-yellow-500/80 border border-yellow-500"></div>
                                        <div className="h-3 w-3 rounded-full bg-brand-green/80 border border-brand-green"></div>
                                        <div className="ml-4 font-mono text-[10px] text-brand-gray uppercase tracking-widest">Dashboard // Cachet Protocol</div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center rounded-[2px] bg-brand-void p-4 border border-brand-green/30">
                                            <div>
                                                <div className="text-sm font-bold text-brand-white uppercase">MegaETH Founders Pass</div>
                                                <div className="text-[10px] font-mono text-brand-gray mt-1 uppercase tracking-wider">Contract: 0x742...d44e</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse"></span>
                                                <span className="text-[10px] text-brand-green uppercase font-bold tracking-widest">Active</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center rounded-[2px] bg-brand-void p-4 border border-brand-green/30">
                                            <div>
                                                <div className="text-sm font-bold text-brand-white uppercase">MegaETH Genesis</div>
                                                <div className="text-[10px] font-mono text-brand-gray mt-1 uppercase tracking-wider">Contract: 0x19a...2b91</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" style={{ animationDelay: "1s" }}></span>
                                                <span className="text-[10px] text-brand-green uppercase font-bold tracking-widest">Active</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-brand-green/30 flex justify-between tracking-widest">
                                        <div className="text-[10px] text-brand-gray font-mono uppercase">Verified Members</div>
                                        <div className="text-[10px] text-brand-green font-mono uppercase">1,492 / 5,000</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-16 grid gap-4 sm:grid-cols-3 relative z-10">
                            <div className="rounded-[2px] border border-brand-green bg-brand-black p-6 hover:bg-brand-green/5 transition">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gray">VERIFICATION FLOW</p>
                                <p className="mt-3 font-mono text-xs uppercase text-brand-white leading-relaxed">Bot button → signed wallet proof → role assignment in seconds.</p>
                            </div>
                            <div className="rounded-[2px] border border-brand-green bg-brand-black p-6 hover:bg-brand-green/5 transition">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gray">RE-VERIFICATION</p>
                                <p className="mt-3 font-mono text-xs uppercase text-brand-white leading-relaxed">BullMQ worker rechecks holders every 24h in safe RPC batches.</p>
                            </div>
                            <div className="rounded-[2px] border border-brand-green bg-brand-black p-6 hover:bg-brand-green/5 transition">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gray">BILLING CONTROLS</p>
                                <p className="mt-3 font-mono text-xs uppercase text-brand-white leading-relaxed">Secure checkout, portal, and webhooks with grace-period handling.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* HOW IT WORKS SECTION */}
                <section className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 lg:px-12">
                    <div className="mb-12 text-center">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">THE PROTOCOL</p>
                        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-tight text-brand-white">HOW IT WORKS</h2>
                    </div>

                    <div className="grid gap-8 md:grid-cols-3">
                        <div className="relative flex flex-col items-center text-center">
                            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[2px] border border-brand-green bg-brand-black text-xl font-bold font-mono text-brand-green shadow-[0_0_15px_rgba(10,143,84,0.2)] z-10">1</div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-white">ADD THE BOT</h3>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Invite the Cachet Discord bot to your server. It takes 10 seconds and requires minimal permissions to assign roles.
                            </p>
                            <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[1px] bg-brand-green/30 -z-10"></div>
                        </div>

                        <div className="relative flex flex-col items-center text-center">
                            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[2px] border border-brand-green bg-brand-black text-xl font-bold font-mono text-brand-green shadow-[0_0_15px_rgba(10,143,84,0.2)] z-10">2</div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-white">CONFIGURE CONTRACTS</h3>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Link your MegaETH NFT contracts to your Discord roles through our secure dashboard. Set minimum token thresholds.
                            </p>
                            <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[1px] bg-brand-green/30 -z-10"></div>
                        </div>

                        <div className="relative flex flex-col items-center text-center">
                            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[2px] border border-brand-green bg-brand-black text-xl font-bold font-mono text-brand-green shadow-[0_0_15px_rgba(10,143,84,0.2)] z-10">3</div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-white">USERS VERIFY</h3>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Members click the verify button in Discord, sign a gasless message, and instantly receive their roles.
                            </p>
                        </div>
                    </div>
                </section>

                {/* INTERACTIVE DEMO SECTION */}
                <section className="relative mx-auto w-full px-5 py-24 sm:px-8 lg:px-12 bg-brand-void border-y border-brand-green/30 shadow-[inset_0_0_100px_rgba(10,143,84,0.05)]">
                    <div className="max-w-6xl mx-auto">
                        <div className="mb-12 text-center">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">SEE IT IN ACTION</p>
                            <h2 className="mt-2 text-3xl font-semibold uppercase tracking-tight text-brand-white">INTERACTIVE VERIFICATION</h2>
                            <p className="mt-4 max-w-2xl mx-auto font-mono text-sm uppercase tracking-widest text-brand-gray leading-relaxed">
                                Experience the seamless flow your community members will see when verifying.
                            </p>
                        </div>

                        <InteractiveDemo />
                    </div>
                </section>

                <section id="pricing" className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 lg:px-12">
                    <div className="mb-8">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">PRICING</p>
                        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-tight text-brand-white">SIMPLE TIERS BUILT FOR NFT COMMUNITIES</h2>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-4">
                        {BILLING_PLANS.map((plan) => {
                            const limits = TIER_LIMITS[plan.tier];
                            const isGrowth = plan.tier === "growth";

                            return (
                                <article
                                    key={plan.tier}
                                    className={`rounded-[2px] border p-6 bg-brand-void ${isGrowth
                                        ? "border-brand-white"
                                        : "border-brand-green"
                                        }`}
                                >
                                    {isGrowth && (
                                        <p className="mb-3 inline-block rounded-[2px] border border-brand-white bg-brand-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-white">
                                            MOST POPULAR
                                        </p>
                                    )}
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray">{plan.label}</p>
                                    <div className="mt-4 flex items-baseline gap-1">
                                        <span className="text-4xl font-semibold text-brand-white tracking-tight">
                                            {plan.priceMonthlyUsd === null ? "CONTACT" : `$${plan.priceMonthlyUsd}`}
                                        </span>
                                        {plan.priceMonthlyUsd !== null && <span className="text-sm font-mono text-brand-gray uppercase">/MO</span>}
                                    </div>
                                    <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">{plan.description}</p>

                                    <ul className="font-mono mt-6 space-y-3 text-xs uppercase text-brand-white">
                                        <li className="flex justify-between border-b border-brand-green/30 pb-2">
                                            <span className="text-brand-gray">VERIFIED_MEMBERS:</span> <span>{formatLimit(limits.maxVerifiedMembers)}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-brand-green/30 pb-2">
                                            <span className="text-brand-gray">NFT_CONTRACTS:</span> <span>{formatLimit(limits.maxContracts)}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-brand-green/30 pb-2">
                                            <span className="text-brand-gray">ROLE_MAPPINGS:</span> <span>{formatLimit(limits.maxRoleMappings)}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-brand-green/30 pb-2">
                                            <span className="text-brand-gray">SERVERS:</span> <span>{formatLimit(limits.maxServers)}</span>
                                        </li>
                                        <li className="flex justify-between pb-2">
                                            <span className="text-brand-gray">ADMIN_CHECKS:</span>
                                            <span>{limits.maxAdminChecksPerMonth <= 0 ? "NONE" : `${formatLimit(limits.maxAdminChecksPerMonth)}/MO`}</span>
                                        </li>
                                    </ul>

                                    <div className="mt-8">
                                        <PricingCTA />
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                {/* FAQ SECTION */}
                <section className="relative mx-auto w-full max-w-4xl px-5 pb-24 sm:px-8 lg:px-12">
                    <div className="mb-12 text-center">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">SUPPORT</p>
                        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-tight text-brand-white">FREQUENTLY ASKED QUESTIONS</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-[2px] border border-brand-green bg-brand-void p-6 relative overflow-hidden group">
                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-green transform scale-x-0 origin-left transition-transform group-hover:scale-x-100"></div>
                            <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-brand-white">How does Cachet work?</h3>
                            <p className="mt-4 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Cachet is a Discord bot and dashboard platform. You invite the bot, create mappings between your MegaETH NFT contracts and Discord roles in our dashboard. When a user clicks your verify button in Discord, they are directed to a secure Cachet page to connect their wallet and sign a gasless message. If they own the required NFT, the bot assigns them the role immediately.
                            </p>
                        </div>
                        <div className="rounded-[2px] border border-brand-green bg-brand-void p-6 relative overflow-hidden group">
                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-green transform scale-x-0 origin-left transition-transform group-hover:scale-x-100"></div>
                            <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-brand-white">Is there a free tier?</h3>
                            <p className="mt-4 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Yes! We offer a generous free tier that supports up to 100 verified members across your servers, perfect for small communities or testing out the protocol before upgrading.
                            </p>
                        </div>
                        <div className="rounded-[2px] border border-brand-green bg-brand-void p-6 relative overflow-hidden group">
                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-green transform scale-x-0 origin-left transition-transform group-hover:scale-x-100"></div>
                            <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-brand-white">Which blockchains are supported?</h3>
                            <p className="mt-4 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                We are exclusively focused on MegaETH. We connect directly to MegaETH RPC nodes to verify ownership safely, securely, and with incredibly low latency.
                            </p>
                        </div>
                        <div className="rounded-[2px] border border-brand-green bg-brand-void p-6 relative overflow-hidden group">
                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-green transform scale-x-0 origin-left transition-transform group-hover:scale-x-100"></div>
                            <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-brand-white">Do users need to pay gas fees?</h3>
                            <p className="mt-4 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                No. The verification process requires an off-chain cryptographic signature proving they own the wallet address. Executing this signature costs zero gas and is 100% free for your community members.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-brand-green bg-brand-void py-8 text-center mt-auto relative z-10">
                <div className="mx-auto max-w-6xl px-5 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-gray">
                        &copy; {new Date().getFullYear()} CACHET. ALL RIGHTS RESERVED.
                    </p>
                    <nav className="flex items-center gap-8">
                        <Link href="/terms" className="font-mono text-xs uppercase tracking-widest text-brand-gray hover:text-brand-white transition">TERMS</Link>
                        <Link href="/privacy" className="font-mono text-xs uppercase tracking-widest text-brand-gray hover:text-brand-white transition">PRIVACY</Link>
                        <Link href="/refund-policy" className="font-mono text-xs uppercase tracking-widest text-brand-gray hover:text-brand-white transition">REFUNDS</Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
}
