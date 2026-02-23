"use client";

import { useState, useEffect } from "react";

type DemoStep = "idle" | "connecting" | "signing" | "success";

export function InteractiveDemo() {
    const [step, setStep] = useState<DemoStep>("idle");

    useEffect(() => {
        if (step === "connecting") {
            const timer = setTimeout(() => setStep("signing"), 1500);
            return () => clearTimeout(timer);
        }
        if (step === "signing") {
            const timer = setTimeout(() => setStep("success"), 2000);
            return () => clearTimeout(timer);
        }
        if (step === "success") {
            const timer = setTimeout(() => setStep("idle"), 4000); // Reset after 4 seconds
            return () => clearTimeout(timer);
        }
    }, [step]);

    return (
        <div className="relative mx-auto w-full max-w-2xl rounded-[2px] border border-brand-green bg-brand-void p-6 sm:p-10 font-mono shadow-2xl overflow-hidden">
            {/* Background design elements */}
            <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(10,143,84,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(10,143,84,0.3)_1px,transparent_1px)] [background-size:20px_20px]" />

            <div className="relative flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-brand-green bg-brand-black shadow-[0_0_15px_rgba(10,143,84,0.3)]">
                    <svg className="h-8 w-8 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>

                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-brand-green mb-2">
                    {step === "idle" && "VERIFICATION REQUIRED"}
                    {step === "connecting" && "CONNECTING WALLET..."}
                    {step === "signing" && "AWAITING SIGNATURE"}
                    {step === "success" && "VERIFICATION SUCCESSFUL"}
                </h3>

                <p className="max-w-md text-xs uppercase text-brand-gray mb-8 h-8">
                    {step === "idle" && "Please verify your MegaETH wallet to access the exclusive community roles."}
                    {step === "connecting" && "Securely communicating with your web3 provider."}
                    {step === "signing" && "Please sign the message in your wallet to prove ownership."}
                    {step === "success" && "Assets verified. Your Discord role has been granted."}
                </p>

                <div className="w-full relative h-16 flex items-center justify-center">
                    {step === "idle" && (
                        <button
                            onClick={() => setStep("connecting")}
                            className="rounded-[2px] bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-brand-black transition hover:bg-brand-white focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-brand-black"
                        >
                            CONNECT WALLET
                        </button>
                    )}

                    {(step === "connecting" || step === "signing") && (
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-brand-green animate-ping" />
                                <span className="h-2 w-2 rounded-full bg-brand-green animate-ping" style={{ animationDelay: "0.2s" }} />
                                <span className="h-2 w-2 rounded-full bg-brand-green animate-ping" style={{ animationDelay: "0.4s" }} />
                            </div>
                            {step === "signing" && (
                                <div className="mt-4 rounded border border-brand-green/30 bg-brand-black px-4 py-2 text-[10px] text-brand-gray uppercase">
                                    Simulating Signature Request...
                                </div>
                            )}
                        </div>
                    )}

                    {step === "success" && (
                        <div className="flex animate-fade-in-up items-center gap-3 rounded-[2px] border border-brand-green bg-brand-green/10 px-6 py-3">
                            <svg className="h-5 w-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-white">Role Granted: @MegaETH Maxi</span>
                        </div>
                    )}
                </div>

                {/* Progress Indicator */}
                <div className="mt-10 flex w-full max-w-xs items-center justify-between gap-2">
                    <div className={`h-1 flex-1 rounded-full transition-colors duration-500 ${step !== "idle" ? "bg-brand-green" : "bg-brand-gray/30"}`} />
                    <div className={`h-1 flex-1 rounded-full transition-colors duration-500 ${step === "signing" || step === "success" ? "bg-brand-green" : "bg-brand-gray/30"}`} />
                    <div className={`h-1 flex-1 rounded-full transition-colors duration-500 ${step === "success" ? "bg-brand-green" : "bg-brand-gray/30"}`} />
                </div>
            </div>
        </div>
    );
}
