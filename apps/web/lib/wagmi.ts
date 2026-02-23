import { http, createConfig, type CreateConnectorFn } from "wagmi";
import { type Chain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";

// ── MegaETH chain definition ───────────────────────────────────────────────

const megaethChainId = parseInt(
  process.env.NEXT_PUBLIC_MEGAETH_CHAIN_ID ?? "6342",
  10,
);

export const megaeth = {
  id: megaethChainId,
  name: "MegaETH",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MEGAETH_RPC_URL ?? "https://rpc.megaeth.com"],
    },
  },
} as const satisfies Chain;

// ── Connectors ─────────────────────────────────────────────────────────────

function buildConnectors(): CreateConnectorFn[] {
  const list: CreateConnectorFn[] = [injected()];

  const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (wcProjectId) {
    list.push(walletConnect({ projectId: wcProjectId }));
  }

  return list;
}

// ── Config ─────────────────────────────────────────────────────────────────

export const wagmiConfig = createConfig({
  chains: [megaeth],
  connectors: buildConnectors(),
  transports: {
    [megaeth.id]: http(),
  },
  ssr: true,
});
