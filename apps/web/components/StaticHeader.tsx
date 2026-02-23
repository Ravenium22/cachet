import Link from "next/link";

export function StaticHeader() {
    return (
        <header className="flex w-full items-center justify-between border-b border-brand-green bg-brand-void px-6 py-4">
            <Link href="/" className="text-xl font-bold tracking-tight text-brand-white">cachet.</Link>
            <nav className="flex items-center gap-6">
                <Link href="/docs" className="font-mono text-sm uppercase tracking-widest text-brand-gray hover:text-brand-white transition">DOCS</Link>
                <Link href="/pricing" className="font-mono text-sm uppercase tracking-widest text-brand-gray hover:text-brand-white transition">PRICING</Link>
            </nav>
        </header>
    );
}
