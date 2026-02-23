import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Cachet — NFT Verification for Discord",
  description:
    "Strict NFT verification for MegaETH communities. Connect wallets, verify on-chain holdings, and automate Discord role management. Frictionless structure, zero compromise.",
  metadataBase: new URL(process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://usecachet.com"),
  openGraph: {
    title: "Cachet — Strict NFT Verification",
    description:
      "Automate Discord roles based on on-chain NFT holdings on MegaETH. Built for serious communities.",
    siteName: "Cachet",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cachet — NFT Verification for Discord",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cachet — Strict NFT Verification",
    description:
      "Automate Discord roles based on on-chain NFT holdings on MegaETH.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#09090b', // brand-void / black
              border: '1px solid #0a8f54', // brand-green
              color: '#ffffff', // brand-white
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              fontSize: '12px',
              borderRadius: '2px',
            },
            className: 'tracking-widest'
          }}
        />
      </body>
    </html>
  );
}
