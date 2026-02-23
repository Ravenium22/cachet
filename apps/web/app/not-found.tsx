import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-brand-black text-brand-white p-8">
            <div className="w-full max-w-md rounded-[2px] border border-brand-green bg-brand-void p-8 text-center">
                <p className="font-mono text-7xl font-bold tracking-tighter text-brand-green">404</p>
                <h1 className="mt-4 text-xl font-semibold uppercase tracking-tight text-brand-white">
                    PAGE_NOT_FOUND
                </h1>
                <p className="mt-4 font-mono text-xs uppercase tracking-widest text-brand-gray">
                    THE_REQUESTED_RESOURCE_DOES_NOT_EXIST.
                </p>
                <Link
                    href="/"
                    className="mt-8 flex w-full items-center justify-center rounded-[2px] border border-brand-green bg-brand-black py-3 font-mono text-xs font-bold uppercase tracking-widest text-brand-white transition hover:bg-brand-green/20"
                >
                    RETURN_HOME
                </Link>
            </div>
        </div>
    );
}
