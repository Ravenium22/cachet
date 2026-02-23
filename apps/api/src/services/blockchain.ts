import { createPublicClient, http, type PublicClient, type Address, parseAbi } from "viem";
import { REDIS_PREFIX, RPC_CACHE_TTL_SECONDS, RPC_MAX_RETRIES } from "@megaeth-verify/shared";
import type { ContractType } from "@megaeth-verify/shared";
import { getRedis } from "./redis.js";

// ── Minimal ABIs ───────────────────────────────────────────────────────────

const ERC721_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

const ERC1155_ABI = parseAbi([
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

// ERC-165 interface IDs
export const ERC721_INTERFACE_ID = "0x80ac58cd";
export const ERC1155_INTERFACE_ID = "0xd9b67a26";

// ── MegaETH chain definition ───────────────────────────────────────────────

function getMegaethChain() {
  const chainId = parseInt(process.env["NEXT_PUBLIC_MEGAETH_CHAIN_ID"] ?? "6342", 10);
  return {
    id: chainId,
    name: "MegaETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: {
        http: [process.env["MEGAETH_RPC_URL"] ?? "https://rpc.megaeth.com"],
      },
    },
  } as const;
}

// ── Client singleton ───────────────────────────────────────────────────────

let client: PublicClient | null = null;

function getClient(): PublicClient {
  if (!client) {
    const chain = getMegaethChain();
    client = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0], {
        retryCount: RPC_MAX_RETRIES,
        retryDelay: 500,
        timeout: 10_000,
      }),
    });
  }
  return client;
}

// ── Retry wrapper ──────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RPC_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < RPC_MAX_RETRIES) {
        const delay = attempt * 500;
        console.warn(`RPC ${label} attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ── Cached RPC call ────────────────────────────────────────────────────────

async function cachedBalance(
  cacheKey: string,
  fetchFn: () => Promise<bigint>,
): Promise<bigint> {
  const redis = getRedis();
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return BigInt(cached);
  }

  const balance = await fetchFn();
  await redis.set(cacheKey, balance.toString(), "EX", RPC_CACHE_TTL_SECONDS);
  return balance;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Check ERC-721 balance for an owner address.
 */
export async function getERC721Balance(
  contractAddress: string,
  ownerAddress: string,
): Promise<bigint> {
  const cacheKey = `${REDIS_PREFIX.RPC_CACHE}721:${contractAddress}:${ownerAddress}`;
  return cachedBalance(cacheKey, () =>
    withRetry(
      () =>
        getClient().readContract({
          address: contractAddress as Address,
          abi: ERC721_ABI,
          functionName: "balanceOf",
          args: [ownerAddress as Address],
        }),
      `ERC721.balanceOf(${contractAddress}, ${ownerAddress})`,
    ),
  );
}

/**
 * Check ERC-1155 balance for an owner + specific token ID.
 */
export async function getERC1155Balance(
  contractAddress: string,
  ownerAddress: string,
  tokenId: bigint,
): Promise<bigint> {
  const cacheKey = `${REDIS_PREFIX.RPC_CACHE}1155:${contractAddress}:${ownerAddress}:${tokenId}`;
  return cachedBalance(cacheKey, () =>
    withRetry(
      () =>
        getClient().readContract({
          address: contractAddress as Address,
          abi: ERC1155_ABI,
          functionName: "balanceOf",
          args: [ownerAddress as Address, tokenId],
        }),
      `ERC1155.balanceOf(${contractAddress}, ${ownerAddress}, ${tokenId})`,
    ),
  );
}

/**
 * Auto-detect contract type via ERC-165 supportsInterface.
 * Returns null if detection fails (contract doesn't implement ERC-165).
 */
export async function detectContractType(
  contractAddress: string,
): Promise<ContractType | null> {
  try {
    const is721 = await withRetry(
      () =>
        getClient().readContract({
          address: contractAddress as Address,
          abi: ERC721_ABI,
          functionName: "supportsInterface",
          args: [ERC721_INTERFACE_ID as `0x${string}`],
        }),
      `supportsInterface(ERC721, ${contractAddress})`,
    );
    if (is721) return "erc721";
  } catch { /* not ERC-165 compliant or RPC error */ }

  try {
    const is1155 = await withRetry(
      () =>
        getClient().readContract({
          address: contractAddress as Address,
          abi: ERC1155_ABI,
          functionName: "supportsInterface",
          args: [ERC1155_INTERFACE_ID as `0x${string}`],
        }),
      `supportsInterface(ERC1155, ${contractAddress})`,
    );
    if (is1155) return "erc1155";
  } catch { /* not ERC-165 compliant or RPC error */ }

  return null;
}

/**
 * Check NFT holdings for one role mapping.
 * For ERC-1155, token_ids MUST be provided — no fallback.
 * Throws on RPC failure so the caller can handle it as "unknown".
 */
export async function checkRoleMappingBalance(
  contractAddress: string,
  contractType: ContractType,
  ownerAddress: string,
  minNftCount: number,
  tokenIds: number[] | null,
): Promise<{ qualified: boolean; balance: bigint }> {
  if (contractType === "erc721") {
    const balance = await getERC721Balance(contractAddress, ownerAddress);
    return { qualified: balance >= BigInt(minNftCount), balance };
  }

  // ERC-1155: token_ids are required
  if (!tokenIds || tokenIds.length === 0) {
    throw new Error(
      `ERC-1155 role mapping for contract ${contractAddress} has no token_ids configured. ` +
      `ERC-1155 requires explicit token IDs.`,
    );
  }

  let totalBalance = 0n;
  for (const tid of tokenIds) {
    const balance = await getERC1155Balance(contractAddress, ownerAddress, BigInt(tid));
    totalBalance += balance;
  }
  return { qualified: totalBalance >= BigInt(minNftCount), balance: totalBalance };
}
