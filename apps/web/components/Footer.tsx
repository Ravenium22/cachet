import Link from "next/link";

interface FooterProps {
    activePage?: "docs" | "terms" | "privacy" | "refund-policy";
}

export function Footer({ activePage }: FooterProps) {
    return (
        <footer className="border-t border-brand-green bg-brand-void py-8 mt-auto relative z-10">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 sm:flex-row sm:justify-between sm:px-8 lg:px-12">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-gray text-center sm:text-left">
                    &copy; {new Date().getFullYear()} CACHET. ALL RIGHTS RESERVED.
                </p>
                <nav className="flex flex-wrap justify-center gap-8 sm:gap-12">
                    <Link
                        href="/docs"
                        className={`font-mono text-xs uppercase tracking-widest transition ${activePage === "docs" ? "text-brand-white" : "text-brand-gray hover:text-brand-white"}`}
                    >
                        DOCS
                    </Link>
                    <Link
                        href="/terms"
                        className={`font-mono text-xs uppercase tracking-widest transition ${activePage === "terms" ? "text-brand-white" : "text-brand-gray hover:text-brand-white"}`}
                    >
                        TERMS
                    </Link>
                    <Link
                        href="/privacy"
                        className={`font-mono text-xs uppercase tracking-widest transition ${activePage === "privacy" ? "text-brand-white" : "text-brand-gray hover:text-brand-white"}`}
                    >
                        PRIVACY
                    </Link>
                    <Link
                        href="/refund-policy"
                        className={`font-mono text-xs uppercase tracking-widest transition ${activePage === "refund-policy" ? "text-brand-white" : "text-brand-gray hover:text-brand-white"}`}
                    >
                        REFUNDS
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
