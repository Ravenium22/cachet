"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  SUPPORTED_PAYMENT_CHAINS,
  BILLING_PLANS,
  TOKEN_DECIMALS,
} from "@megaeth-verify/shared";
import type {
  SubscriptionTier,
  PaymentChain,
  PaymentToken,
  CryptoInvoice,
} from "@megaeth-verify/shared";

interface CryptoCheckoutProps {
  projectId: string;
  currentTier: SubscriptionTier;
  onSubscriptionActivated: () => void;
}

type CheckoutStep = "configure" | "pay" | "verifying" | "failed";

// Build chain list dynamically — only show chains that have at least one token
const ALL_CHAINS = Object.entries(SUPPORTED_PAYMENT_CHAINS)
  .filter(([, cfg]) => Object.values(cfg.tokens).some(Boolean))
  .map(([key, cfg]) => ({ value: key as PaymentChain, label: cfg.name }));

const ALL_TOKENS: { value: PaymentToken; label: string }[] = [
  { value: "usdc", label: "USDC" },
  { value: "usdt", label: "USDT" },
  { value: "usde", label: "USDe" },
  { value: "usdm", label: "USDm" },
  { value: "honey", label: "HONEY" },
];

function formatTokenAmount(amountToken: string, decimals: number): string {
  const raw = amountToken.padStart(decimals + 1, "0");
  const intPart = raw.slice(0, raw.length - decimals) || "0";
  const decPart = raw.slice(raw.length - decimals);
  return `${intPart}.${decPart}`;
}

export function CryptoCheckout({ projectId, currentTier, onSubscriptionActivated }: CryptoCheckoutProps) {
  const [step, setStep] = useState<CheckoutStep>("configure");
  const [tier, setTier] = useState<"growth" | "pro">("growth");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [chain, setChain] = useState<PaymentChain>(ALL_CHAINS[0]?.value ?? "base");
  const [token, setToken] = useState<PaymentToken>("usdc");
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<CryptoInvoice | null>(null);
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState<"address" | "amount" | false>(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = BILLING_PLANS.find((p) => p.tier === tier);
  const price = billingPeriod === "annual" ? plan?.priceAnnualUsd : plan?.priceMonthlyUsd;

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (!invoice || step !== "pay") return;
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(invoice.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setStep("configure");
        setInvoice(null);
        toast.error("Invoice expired. Please create a new one.");
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [invoice, step]);

  // Poll for verification result
  const startPolling = useCallback((invoiceId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.fetch<CryptoInvoice>(`/api/v1/billing/crypto/invoice/${invoiceId}`);
        if (data.status === "confirmed") {
          if (pollRef.current) clearInterval(pollRef.current);
          toast.success("Payment confirmed! Your plan is now active.");
          onSubscriptionActivated();
          setStep("configure");
          setInvoice(null);
        } else if (data.status === "failed" || data.status === "expired") {
          if (pollRef.current) clearInterval(pollRef.current);
          toast.error(
            data.status === "expired"
              ? "Invoice expired. Please create a new one."
              : "Payment verification failed. The transaction did not match the invoice.",
          );
          setStep("failed");
        }
      } catch {
        // Ignore poll errors
      }
    }, 5000);
  }, [onSubscriptionActivated]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCreateInvoice = async () => {
    setLoading(true);
    try {
      const data = await api.fetch<CryptoInvoice>("/api/v1/billing/crypto/checkout", {
        method: "POST",
        body: JSON.stringify({ projectId, tier, billingPeriod, token, chain }),
      });
      setInvoice(data);
      setStep("pay");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTx = async () => {
    if (!invoice || !txHash) return;
    setLoading(true);
    try {
      await api.fetch("/api/v1/billing/crypto/submit-tx", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id, txHash }),
      });
      setStep("verifying");
      startPolling(invoice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, kind: "address" | "amount") => {
    navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(false), 2000);
  };

  const minutesLeft = Math.floor(timeLeft / 60);
  const secondsLeft = timeLeft % 60;

  // ── Configure step ────────────────────────────────────────────────────

  if (step === "configure") {
    return (
      <div className="space-y-4">
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">
          CRYPTO_CHECKOUT
        </h3>

        {/* Tier selector */}
        <div>
          <label className="block font-mono text-xs text-brand-gray">PLAN</label>
          <div className="mt-1 flex gap-2">
            {(["growth", "pro"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                disabled={t === currentTier}
                className={`rounded-[2px] border px-3 py-1.5 font-mono text-xs uppercase transition ${
                  tier === t
                    ? "border-brand-white bg-brand-white text-brand-black"
                    : "border-brand-green text-brand-gray hover:text-brand-white"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {t === currentTier ? `${t} (CURRENT)` : t}
              </button>
            ))}
          </div>
        </div>

        {/* Billing period */}
        <div>
          <label className="block font-mono text-xs text-brand-gray">BILLING_PERIOD</label>
          <div className="mt-1 flex gap-2">
            {(["monthly", "annual"] as const).map((bp) => (
              <button
                key={bp}
                onClick={() => setBillingPeriod(bp)}
                className={`rounded-[2px] border px-3 py-1.5 font-mono text-xs uppercase transition ${
                  billingPeriod === bp
                    ? "border-brand-white bg-brand-white text-brand-black"
                    : "border-brand-green text-brand-gray hover:text-brand-white"
                }`}
              >
                {bp}{bp === "annual" ? " (SAVE 20%)" : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Chain selector */}
        <div>
          <label className="block font-mono text-xs text-brand-gray">CHAIN</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {ALL_CHAINS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setChain(c.value);
                  // Auto-switch token if current one isn't available on new chain
                  const cfg = SUPPORTED_PAYMENT_CHAINS[c.value];
                  if (!cfg.tokens[token]) {
                    const firstAvailable = (Object.entries(cfg.tokens) as [PaymentToken, string | null][])
                      .find(([, addr]) => addr !== null);
                    if (firstAvailable) setToken(firstAvailable[0]);
                  }
                }}
                className={`rounded-[2px] border px-3 py-1.5 font-mono text-xs uppercase transition ${
                  chain === c.value
                    ? "border-brand-white bg-brand-white text-brand-black"
                    : "border-brand-green text-brand-gray hover:text-brand-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Token selector — only show tokens available on selected chain */}
        <div>
          <label className="block font-mono text-xs text-brand-gray">TOKEN</label>
          <div className="mt-1 flex gap-2">
            {ALL_TOKENS.filter((t) => SUPPORTED_PAYMENT_CHAINS[chain].tokens[t.value]).map((t) => (
              <button
                key={t.value}
                onClick={() => setToken(t.value)}
                className={`rounded-[2px] border px-3 py-1.5 font-mono text-xs uppercase transition ${
                  token === t.value
                    ? "border-brand-white bg-brand-white text-brand-black"
                    : "border-brand-green text-brand-gray hover:text-brand-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price preview */}
        {price !== null && price !== undefined && (
          <p className="font-mono text-sm text-brand-white">
            TOTAL: ${price} {token.toUpperCase()} ON {SUPPORTED_PAYMENT_CHAINS[chain].name.toUpperCase()}
          </p>
        )}

        <button
          onClick={handleCreateInvoice}
          disabled={loading || tier === currentTier}
          className="w-full rounded-[2px] bg-brand-green px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-brand-black transition hover:bg-brand-green/80 disabled:opacity-50"
        >
          {loading ? "CREATING_INVOICE..." : "CREATE INVOICE"}
        </button>
      </div>
    );
  }

  // ── Pay step ──────────────────────────────────────────────────────────

  if (step === "pay" && invoice) {
    const chainConfig = SUPPORTED_PAYMENT_CHAINS[invoice.chain as PaymentChain];
    const tokenDecimals = TOKEN_DECIMALS[invoice.token as PaymentToken];
    const displayAmount = formatTokenAmount(invoice.amountToken, tokenDecimals);

    return (
      <div className="space-y-4">
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">
          SEND_PAYMENT
        </h3>

        <div className="rounded-[2px] border border-brand-green bg-brand-black p-3 space-y-3">
          <div>
            <p className="font-mono text-[10px] text-brand-gray">RECIPIENT_ADDRESS</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all font-mono text-xs text-brand-white">
                {invoice.recipientAddress}
              </code>
              <button
                onClick={() => handleCopy(invoice.recipientAddress, "address")}
                className="shrink-0 rounded-[2px] border border-brand-green px-2 py-1 font-mono text-[10px] text-brand-gray transition hover:text-brand-white"
              >
                {copied === "address" ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <p className="font-mono text-[10px] text-brand-gray">EXACT_AMOUNT</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm font-bold text-brand-white">
                  {displayAmount} {invoice.token.toUpperCase()}
                </p>
                <button
                  onClick={() => handleCopy(displayAmount, "amount")}
                  className="shrink-0 rounded-[2px] border border-brand-green px-1.5 py-0.5 font-mono text-[9px] text-brand-gray transition hover:text-brand-white"
                >
                  {copied === "amount" ? "COPIED" : "COPY"}
                </button>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] text-brand-gray">CHAIN</p>
              <p className="font-mono text-sm text-brand-white">{chainConfig.name}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-brand-gray">EXPIRES_IN</p>
              <p className={`font-mono text-sm ${timeLeft < 300 ? "text-brand-red" : "text-brand-white"}`}>
                {minutesLeft}:{String(secondsLeft).padStart(2, "0")}
              </p>
            </div>
          </div>

          <div className="rounded-[2px] border border-yellow-500/40 bg-yellow-500/5 px-3 py-2">
            <p className="font-mono text-[10px] text-yellow-400">
              SEND THE EXACT AMOUNT SHOWN ABOVE. PAYMENTS WITH A DIFFERENT AMOUNT, WRONG TOKEN, OR WRONG CHAIN WILL BE REJECTED. DO NOT INCLUDE EXTRA GAS FEES IN THE TOKEN AMOUNT.
            </p>
          </div>
        </div>

        <div>
          <label className="block font-mono text-xs text-brand-gray">TRANSACTION_HASH</label>
          <input
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x..."
            className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 font-mono text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
          />
        </div>

        <button
          onClick={handleSubmitTx}
          disabled={loading || !txHash.match(/^0x[a-fA-F0-9]{64}$/)}
          className="w-full rounded-[2px] bg-brand-green px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-brand-black transition hover:bg-brand-green/80 disabled:opacity-50"
        >
          {loading ? "SUBMITTING..." : "VERIFY PAYMENT"}
        </button>

        <button
          onClick={() => { setStep("configure"); setInvoice(null); setTxHash(""); }}
          className="w-full rounded-[2px] border border-brand-green px-4 py-2 font-mono text-xs text-brand-gray transition hover:text-brand-white"
        >
          CANCEL
        </button>
      </div>
    );
  }

  // ── Failed step ──────────────────────────────────────────────────────

  if (step === "failed") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-red">
          <span className="text-lg text-brand-red">X</span>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-brand-red">
          VERIFICATION_FAILED
        </p>
        <p className="font-mono text-[10px] text-brand-gray">
          THE TRANSACTION DID NOT MATCH THE INVOICE REQUIREMENTS.<br />
          CHECK THAT YOU SENT THE EXACT AMOUNT, CORRECT TOKEN, AND TO THE RIGHT ADDRESS.
        </p>
        {invoice?.txHash && (
          <p className="font-mono text-[10px] text-brand-gray break-all">
            TX: {invoice.txHash}
          </p>
        )}
        <button
          onClick={() => {
            setStep("configure");
            setInvoice(null);
            setTxHash("");
          }}
          className="w-full rounded-[2px] bg-brand-green px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-brand-black transition hover:bg-brand-green/80"
        >
          TRY AGAIN WITH NEW INVOICE
        </button>
      </div>
    );
  }

  // ── Verifying step ────────────────────────────────────────────────────

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
      <p className="font-mono text-xs uppercase tracking-widest text-brand-gray">
        VERIFYING_ON_CHAIN...
      </p>
      <p className="font-mono text-[10px] text-brand-gray">
        THIS MAY TAKE A FEW MINUTES. DO NOT CLOSE THIS PAGE.
      </p>
    </div>
  );
}
