import type { Metadata } from "next";
import Link from "next/link";
import { StaticHeader } from "@/components/StaticHeader";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
    title: "Terms of Service — Cachet",
    description: "Terms of Service for Cachet, the NFT verification platform for Discord communities on MegaETH.",
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-brand-black text-brand-white flex flex-col font-sans">
            <StaticHeader />

            <main className="relative flex-1 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(10,143,84,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(10,143,84,0.3)_1px,transparent_1px)] [background-size:34px_34px]" />

                <article className="relative mx-auto w-full max-w-3xl px-5 py-20 sm:px-8 lg:px-12">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">LEGAL</p>
                    <h1 className="mt-2 text-3xl font-semibold uppercase tracking-tight text-brand-white sm:text-4xl">TERMS OF SERVICE</h1>
                    <p className="mt-4 font-mono text-xs uppercase text-brand-gray">LAST UPDATED: FEBRUARY 21, 2026</p>

                    <div className="mt-12 space-y-10">
                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">1. ACCEPTANCE OF TERMS</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                By accessing or using Cachet (&quot;the Service&quot;), operated at usecachet.com, you agree to be bound by these Terms of Service. If you do not agree you must discontinue use immediately.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">2. SERVICE DESCRIPTION</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Cachet provides automated NFT verification and Discord role management for communities on the MegaETH blockchain. The Service includes a web dashboard, Discord bot, and API for managing verification workflows, role mappings, and subscription billing.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">3. ELIGIBILITY</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                You must be at least 18 years old and have the legal capacity to enter into a binding agreement to use the Service. By using Cachet, you represent that you meet these requirements.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">4. ACCOUNTS</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                You authenticate via Discord OAuth. You are responsible for maintaining the security of your Discord account. You agree to notify us immediately of any unauthorized access. We are not liable for losses caused by unauthorized use of your account.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">5. SUBSCRIPTIONS AND BILLING</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Paid plans are billed monthly through Paddle, our Merchant of Record. By subscribing, you authorize recurring charges. Prices are listed in USD. Paddle handles all payment processing, tax collection, invoicing, and currency conversion. You may cancel at any time; cancellation takes effect at the end of your current billing period.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">6. REFUND POLICY</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Refunds are governed by our{" "}
                                <Link href="/refund-policy" className="text-brand-green hover:underline">Refund Policy</Link>.
                                In summary: you may request a refund within 14 days of your initial purchase if substantially dissatisfied with the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">7. ACCEPTABLE USE</h2>
                            <div className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed space-y-2">
                                <p>You agree not to:</p>
                                <ul className="list-inside list-disc space-y-1 pl-2">
                                    <li>Use the Service for unlawful purposes.</li>
                                    <li>Attempt to reverse-engineer, exploit, or disrupt the Service infrastructure.</li>
                                    <li>Automate access beyond the documented API rate limits.</li>
                                    <li>Assign fraudulent wallet addresses or Discord roles.</li>
                                    <li>Resell or sub-license access to the Service without written permission.</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">8. INTELLECTUAL PROPERTY</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                All content, branding, and software comprising the Service are owned by Cachet. You retain ownership of any data you provide (e.g., contract addresses, server configurations). You grant us a limited license to process your data solely to operate the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">9. BLOCKCHAIN AND WALLET DATA</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Cachet reads publicly available on-chain data from the MegaETH blockchain. We never request or store your private keys. Wallet verification is performed via EIP-191 signature verification. You acknowledge that blockchain data is inherently public and immutable.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">10. DISCLAIMER OF WARRANTIES</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE UNINTERRUPTED ACCESS, ERROR-FREE OPERATION, OR SPECIFIC RESULTS FROM USE OF THE SERVICE. BLOCKCHAIN NETWORKS AND DISCORD&apos;S API ARE THIRD-PARTY SERVICES OUTSIDE OUR CONTROL.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">11. LIMITATION OF LIABILITY</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CACHET SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. OUR TOTAL LIABILITY IS LIMITED TO THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">12. TERMINATION</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                We may suspend or terminate your access at any time for violation of these Terms. Upon termination, your right to use the Service ceases immediately. Data associated with your projects may be deleted after a 30-day grace period.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">13. CHANGES TO TERMS</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance. We will notify you of material changes via the email associated with your Discord account or through in-app notification.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">14. GOVERNING LAW</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                These Terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved through binding arbitration or in the courts of competent jurisdiction.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">15. CONTACT</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                For questions about these Terms, contact us at{" "}
                                <a href="mailto:legal@usecachet.com" className="text-brand-green hover:underline">legal@usecachet.com</a>.
                            </p>
                        </section>
                    </div>
                </article>
            </main>

            <Footer activePage="terms" />
        </div>
    );
}
