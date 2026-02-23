"use client";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-brand-black text-brand-white p-8">
            <div className="w-full max-w-md rounded-[2px] border border-brand-red bg-brand-void p-8 text-center">
                <div className="mb-4 text-5xl text-brand-red">&#x26A0;</div>
                <h1 className="text-2xl font-semibold uppercase tracking-tight text-brand-red">
                    SOMETHING_WENT_WRONG
                </h1>
                <p className="mt-4 font-mono text-xs uppercase tracking-widest text-brand-gray">
                    {error.message || "AN_UNEXPECTED_ERROR_OCCURRED."}
                </p>
                {error.digest && (
                    <p className="mt-2 font-mono text-xs text-brand-gray/60">
                        DIGEST: {error.digest}
                    </p>
                )}
                <button
                    onClick={reset}
                    className="mt-8 w-full rounded-[2px] border border-brand-green bg-brand-black py-3 font-mono text-xs font-bold uppercase tracking-widest text-brand-white transition hover:bg-brand-green/20"
                >
                    TRY_AGAIN
                </button>
            </div>
        </div>
    );
}
