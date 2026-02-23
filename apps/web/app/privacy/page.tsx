import type { Metadata } from "next";
import Link from "next/link";
import { StaticHeader } from "@/components/StaticHeader";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
    title: "Privacy Policy — Cachet",
    description: "Privacy Policy for Cachet, the NFT verification platform for Discord communities on MegaETH.",
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-brand-black text-brand-white flex flex-col font-sans">
            <StaticHeader />

            <main className="relative flex-1 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(10,143,84,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(10,143,84,0.3)_1px,transparent_1px)] [background-size:34px_34px]" />

                <article className="relative mx-auto w-full max-w-3xl px-5 py-20 sm:px-8 lg:px-12">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">LEGAL</p>
                    <h1 className="mt-2 text-3xl font-semibold uppercase tracking-tight text-brand-white sm:text-4xl">PRIVACY POLICY</h1>
                    <p className="mt-4 font-mono text-xs uppercase text-brand-gray">LAST UPDATED: FEBRUARY 21, 2026</p>

                    <div className="mt-12 space-y-10">
                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">1. INTRODUCTION</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Cachet (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the usecachet.com website and Discord bot. This Privacy Policy describes how we collect, use, and protect your information when you use our Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">2. INFORMATION WE COLLECT</h2>
                            <div className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed space-y-4">
                                <div>
                                    <p className="text-brand-white">2.1 INFORMATION FROM DISCORD</p>
                                    <p className="mt-1">When you log in via Discord OAuth, we receive your Discord user ID, username, and avatar. We do not receive or store your Discord password.</p>
                                </div>
                                <div>
                                    <p className="text-brand-white">2.2 WALLET ADDRESSES</p>
                                    <p className="mt-1">When you verify NFT ownership, you connect your Ethereum-compatible wallet and sign a message. We store your public wallet address to perform on-chain verification checks. We never have access to your private keys.</p>
                                </div>
                                <div>
                                    <p className="text-brand-white">2.3 PROJECT CONFIGURATION DATA</p>
                                    <p className="mt-1">Project owners provide Discord server IDs, contract addresses, role mapping configurations, and project names. This data is stored to operate the verification service.</p>
                                </div>
                                <div>
                                    <p className="text-brand-white">2.4 BILLING INFORMATION</p>
                                    <p className="mt-1">Payment processing is handled entirely by Paddle (our Merchant of Record). We do not store credit card numbers, bank details, or other payment credentials. Paddle may share your email, transaction ID, and subscription status with us.</p>
                                </div>
                                <div>
                                    <p className="text-brand-white">2.5 TECHNICAL DATA</p>
                                    <p className="mt-1">We collect IP addresses, browser user agents, and request timestamps for rate limiting, security, and abuse prevention. Server logs are retained for up to 30 days.</p>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">3. HOW WE USE YOUR INFORMATION</h2>
                            <ul className="mt-3 list-inside list-disc font-mono text-xs uppercase text-brand-gray leading-relaxed space-y-1 pl-2">
                                <li>To authenticate your identity via Discord.</li>
                                <li>To verify on-chain NFT ownership and assign Discord roles.</li>
                                <li>To manage subscriptions and billing through Paddle.</li>
                                <li>To enforce rate limits and prevent abuse.</li>
                                <li>To send transactional communications (billing receipts, plan changes).</li>
                                <li>To improve and maintain the Service.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">4. DATA SHARING</h2>
                            <div className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed space-y-2">
                                <p>We do not sell your personal data. We share data only with:</p>
                                <ul className="list-inside list-disc space-y-1 pl-2">
                                    <li><span className="text-brand-white">Paddle</span> — Payment processing and tax compliance.</li>
                                    <li><span className="text-brand-white">Discord</span> — Role assignments via the Discord API.</li>
                                    <li><span className="text-brand-white">MegaETH RPC Providers</span> — On-chain data queries (public blockchain data only).</li>
                                    <li><span className="text-brand-white">Sentry</span> — Error monitoring (anonymized technical data).</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">5. DATA RETENTION</h2>
                            <div className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed space-y-2">
                                <ul className="list-inside list-disc space-y-1 pl-2">
                                    <li>Account data is retained while your account is active.</li>
                                    <li>Verification records are retained for the lifetime of the project.</li>
                                    <li>Deleted projects and associated data are purged after 30 days.</li>
                                    <li>Server logs are retained for up to 30 days.</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">6. DATA SECURITY</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                We employ industry-standard security measures including encrypted connections (TLS), hashed tokens, rate limiting, and secure credential management. Database access is restricted and encrypted at rest.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">7. YOUR RIGHTS</h2>
                            <div className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed space-y-2">
                                <p>Depending on your jurisdiction, you may have the right to:</p>
                                <ul className="list-inside list-disc space-y-1 pl-2">
                                    <li>Access the personal data we hold about you.</li>
                                    <li>Request correction of inaccurate data.</li>
                                    <li>Request deletion of your data.</li>
                                    <li>Object to processing of your data.</li>
                                    <li>Data portability.</li>
                                </ul>
                                <p className="mt-2">
                                    To exercise these rights, contact us at{" "}
                                    <a href="mailto:privacy@usecachet.com" className="text-brand-green hover:underline">privacy@usecachet.com</a>.
                                </p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">8. COOKIES</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Cachet uses essential cookies and local storage for authentication (JWT tokens). We do not use tracking cookies, advertising cookies, or third-party analytics trackers.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">9. CHILDREN&apos;S PRIVACY</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                The Service is not intended for individuals under the age of 18. We do not knowingly collect data from minors. If we learn that we have collected data from a child, we will delete it promptly.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">10. CHANGES TO THIS POLICY</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                We may update this Privacy Policy at any time. Changes will be posted on this page with an updated &quot;Last Updated&quot; date. Continued use of the Service after changes constitutes acceptance.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">11. CONTACT</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                For privacy-related questions or requests, contact us at{" "}
                                <a href="mailto:privacy@usecachet.com" className="text-brand-green hover:underline">privacy@usecachet.com</a>.
                            </p>
                        </section>
                    </div>
                </article>
            </main>

            <Footer activePage="privacy" />
        </div>
    );
}
