"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api-production-d6be.up.railway.app";

type Step = "connect" | "sign" | "submitting" | "success" | "error";

interface VerifyResult {
  walletAddress: string;
  rolesGranted: string[];
  rolesRemoved: string[];
}

// Known connector icon mapping
const CONNECTOR_ICONS: Record<string, string> = {
  metamask: "\u{1F98A}",
  walletconnect: "\u{1F517}",
  coinbasewallet: "\u{1F7E6}",
  "coinbase wallet": "\u{1F7E6}",
  brave: "\u{1F981}",
  phantom: "\u{1F47B}",
  rabby: "\u{1F430}",
  rainbow: "\u{1F308}",
  trust: "\u{1F6E1}",
  "trust wallet": "\u{1F6E1}",
};

function getConnectorIcon(name: string): string {
  const key = name.toLowerCase();
  return CONNECTOR_ICONS[key] ?? "\u{1F4B0}";
}

function getConnectorSubtitle(name: string): string {
  const key = name.toLowerCase();
  if (key.includes("walletconnect")) return "MOBILE_AND_DESKTOP";
  if (key.includes("coinbase")) return "COINBASE_WALLET";
  if (key.includes("injected")) return "BROWSER_EXTENSION";
  return "BROWSER_EXTENSION";
}

export function VerifyClient({
  token,
  projectName,
  message,
}: {
  token: string;
  projectName: string;
  message: string;
}) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [step, setStep] = useState<Step>(isConnected ? "sign" : "connect");
  const [error, setError] = useState<string | null>(null);
  const [isNoNftError, setIsNoNftError] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [closeCountdown, setCloseCountdown] = useState<number | null>(null);

  const handleConnect = useCallback(
    (connectorId: string) => {
      const connector = connectors.find((c) => c.uid === connectorId);
      if (!connector) return;
      connect(
        { connector },
        {
          onSuccess: () => setStep("sign"),
          onError: (err) => {
            setError(err.message);
            setIsNoNftError(false);
            setStep("error");
          },
        },
      );
    },
    [connect, connectors],
  );

  const handleSign = useCallback(async () => {
    if (!address) return;

    setStep("submitting");
    setError(null);
    setIsNoNftError(false);

    try {
      const signature = await signMessageAsync({ message });

      const res = await fetch(`${API_URL}/api/v1/verify/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          walletAddress: address,
        }),
      });

      const body = (await res.json()) as {
        success: boolean;
        data?: VerifyResult;
        error?: string;
        details?: {
          suggestedTier?: string;
        };
      };

      if (!res.ok || !body.success) {
        if (res.status === 402) {
          const suggested = body.details?.suggestedTier;
          const upgradeHint = suggested ? ` Upgrade to ${suggested} to continue.` : "";
          throw new Error((body.error ?? "Verification limit reached.") + upgradeHint);
        }
        throw new Error(body.error ?? `Verification failed (${res.status})`);
      }

      setResult(body.data!);
      setStep("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("User rejected") || msg.includes("denied")) {
        setStep("sign");
        return;
      }
      setError(msg);
      const nftRelated = /nft|hold|balance|token|not eligible/i.test(msg);
      setIsNoNftError(nftRelated);
      setStep("error");
    }
  }, [address, message, signMessageAsync, token]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsNoNftError(false);
    setStep(isConnected ? "sign" : "connect");
  }, [isConnected]);

  // Auto-close countdown on success
  useEffect(() => {
    if (step !== "success") return;
    setCloseCountdown(10);
    const interval = setInterval(() => {
      setCloseCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          try {
            window.close();
          } catch {
            // Can't close if not opened by script
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  return (
    <div className="w-full max-w-md rounded-[2px] border border-brand-green bg-brand-void p-8 font-sans text-brand-white shadow-none">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold uppercase tracking-tight">VERIFY FOR {projectName}</h1>
        <p className="mt-2 font-mono text-xs tracking-wide text-brand-gray">
          CONNECT_WALLET_AND_SIGN_MESSAGE
        </p>
      </div>

      {/* Step: Connect Wallet — show ALL connectors dynamically */}
      {step === "connect" && (
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-brand-gray">CHOOSE_A_WALLET:</p>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector.uid)}
              className="flex w-full items-center gap-3 rounded-[2px] border border-brand-green bg-brand-black px-4 py-3 text-left transition hover:bg-brand-green/10"
            >
              <span className="text-2xl">{getConnectorIcon(connector.name)}</span>
              <div>
                <div className="font-semibold uppercase tracking-wider text-brand-white">{connector.name}</div>
                <div className="font-mono text-xs uppercase text-brand-gray">{getConnectorSubtitle(connector.name)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step: Sign Message */}
      {step === "sign" && (
        <div className="space-y-4">
          <div className="rounded-[2px] border border-brand-green bg-brand-black p-4">
            <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-widest text-brand-gray">
              CONNECTED_WALLET
            </p>
            <p className="font-mono text-sm break-all text-brand-white">{address}</p>
            <button
              onClick={() => {
                disconnect();
                setStep("connect");
              }}
              className="mt-2 font-mono text-xs uppercase tracking-wider text-brand-green transition hover:text-brand-white"
            >
              [DISCONNECT]
            </button>
          </div>

          <div className="rounded-[2px] border border-brand-green bg-brand-black p-4">
            <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-widest text-brand-gray">
              MESSAGE_TO_SIGN
            </p>
            <pre className="whitespace-pre-wrap font-mono text-xs text-brand-gray">
              {message}
            </pre>
          </div>

          <button
            onClick={handleSign}
            className="w-full rounded-[2px] bg-brand-white py-3 font-semibold uppercase tracking-widest text-brand-black transition hover:bg-brand-gray"
          >
            SIGN_AND_VERIFY
          </button>
          <p className="text-center font-mono text-xs uppercase text-brand-gray">
            NO_GAS_FEES. PROVES_OWNERSHIP_ONLY.
          </p>
        </div>
      )}

      {/* Step: Submitting */}
      {step === "submitting" && (
        <div className="py-8 text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          <p className="font-mono text-sm uppercase tracking-widest text-brand-white">VERIFYING_HOLDINGS...</p>
          <p className="mt-2 font-mono text-xs uppercase text-brand-gray">
            CHECKING_ON_CHAIN_BALANCES
          </p>
        </div>
      )}

      {/* Step: Success — show actual role names */}
      {step === "success" && result && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">&#x2705;</div>
          <h2 className="text-xl font-bold uppercase tracking-widest text-brand-green">
            VERIFICATION_COMPLETE!
          </h2>
          <div className="rounded-[2px] border border-brand-green bg-brand-black p-4 text-left font-mono text-xs text-brand-gray uppercase">
            <p>
              WALLET: <span className="text-brand-white">{result.walletAddress}</span>
            </p>
            {result.rolesGranted.length > 0 ? (
              <div className="mt-2">
                <p className="text-brand-gray">ROLES_GRANTED:</p>
                <ul className="mt-1 space-y-1">
                  {result.rolesGranted.map((role, i) => (
                    <li key={i} className="text-brand-green">+ {role}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-brand-red">
                NO ROLES WERE ASSIGNED. YOU MAY NOT HOLD THE REQUIRED NFTS.
              </p>
            )}
            {result.rolesRemoved.length > 0 && (
              <div className="mt-2">
                <p className="text-brand-gray">ROLES_REMOVED:</p>
                <ul className="mt-1 space-y-1">
                  {result.rolesRemoved.map((role, i) => (
                    <li key={i} className="text-brand-red">- {role}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="font-mono text-xs uppercase text-brand-gray">
            {closeCountdown !== null && closeCountdown > 0
              ? `THIS TAB WILL CLOSE IN ${closeCountdown}S...`
              : "YOU CAN CLOSE THIS PAGE AND RETURN TO DISCORD."}
          </p>
        </div>
      )}

      {/* Step: Error — differentiate no-NFT warning from actual errors */}
      {step === "error" && (
        <div className="space-y-4 text-center">
          {isNoNftError ? (
            <>
              <div className="text-5xl">&#x26A0;</div>
              <h2 className="text-xl font-bold uppercase tracking-widest text-yellow-500">
                NO_NFTS_FOUND
              </h2>
              <p className="font-mono text-xs uppercase text-brand-gray">{error}</p>
            </>
          ) : (
            <>
              <div className="text-5xl">&#x274C;</div>
              <h2 className="text-xl font-bold uppercase tracking-widest text-brand-red">
                VERIFICATION_FAILED
              </h2>
              <p className="font-mono text-xs uppercase text-brand-gray">{error}</p>
            </>
          )}
          <button
            onClick={handleRetry}
            className="w-full rounded-[2px] border border-brand-green bg-brand-black py-3 font-semibold uppercase tracking-widest text-brand-white transition hover:bg-brand-green/10"
          >
            TRY_AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
