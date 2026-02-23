import type { Metadata } from "next";
import Link from "next/link";
import { StaticHeader } from "@/components/StaticHeader";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
    title: "Refund Policy — Cachet",
    description: "Refund Policy for Cachet, the NFT verification platform for Discord communities on MegaETH.",
};

export default function RefundPolicyPage() {
    return (
        <div className="min-h-screen bg-brand-black text-brand-white flex flex-col font-sans">
            <StaticHeader />

            <main className="relative flex-1 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(10,143,84,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(10,143,84,0.3)_1px,transparent_1px)] [background-size:34px_34px]" />

                <article className="relative mx-auto w-full max-w-3xl px-5 py-20 sm:px-8 lg:px-12">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">LEGAL</p>
                    <h1 className="mt-2 text-3xl font-semibold uppercase tracking-tight text-brand-white sm:text-4xl">REFUND POLICY</h1>
                    <p className="mt-4 font-mono text-xs uppercase text-brand-gray">LAST UPDATED: FEBRUARY 21, 2026</p>

                    <div className="mt-12 space-y-10">
                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">1. ALL SALES ARE FINAL</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                All purchases of Cachet subscription plans are final. We do not offer refunds, credits, or exchanges for any subscription fees once payment has been processed. By subscribing to any paid plan, you acknowledge and agree that all sales are final.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">2. FREE TIER AVAILABLE</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Cachet offers a free tier that allows you to evaluate the core features of the platform before committing to a paid plan. We encourage all users to use the free tier to determine whether the Service meets their needs before upgrading.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">3. CANCELLATION</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                You may cancel your subscription at any time from the dashboard settings page. Cancellation stops future charges but does not entitle you to a refund for the current or any prior billing period. Your paid features remain active until the end of the current billing cycle.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">4. PAYMENT PROCESSING</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                All payments are processed by Paddle, our Merchant of Record. Paddle handles billing, tax compliance, and payment processing on our behalf. Any billing disputes should be directed to us first at{" "}
                                <a href="mailto:support@usecachet.com" className="text-brand-green hover:underline">support@usecachet.com</a>.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">5. FAILED PAYMENTS</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                If a payment fails, we provide a 7-day grace period during which your subscription remains active. You will be notified and can update your payment method. If payment is not resolved within the grace period, your subscription will be downgraded to the Free tier.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">6. STATUTORY RIGHTS</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                Nothing in this policy affects any statutory rights that may apply to you under your local consumer protection laws. Where mandatory consumer protection legislation provides refund rights that cannot be excluded by contract, those rights are preserved.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-white">7. CONTACT</h2>
                            <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                For billing questions, contact us at{" "}
                                <a href="mailto:support@usecachet.com" className="text-brand-green hover:underline">support@usecachet.com</a>.
                            </p>
                        </section>
                    </div>
                </article>
            </main>

            <Footer activePage="refund-policy" />
        </div>
    );
}
