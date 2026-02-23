"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useCallback } from "react";
import { toast } from "sonner";

const EXPLORER_BASE = process.env.NEXT_PUBLIC_MEGAETH_EXPLORER_URL ?? "https://megaexplorer.xyz";
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

interface Contract {
  id: string;
  contractAddress: string;
  contractType: "erc721" | "erc1155";
  name: string | null;
  isActive: boolean;
  chain: string;
  verifiedMemberCount: number;
}

function getAddressValidation(address: string): { valid: boolean; message: string } | null {
  if (!address) return null;
  if (!address.startsWith("0x")) return { valid: false, message: "Must start with 0x" };
  if (address.length > 2 && address.length < 42) return { valid: false, message: `${42 - address.length} characters remaining` };
  if (address.length === 42 && !ADDRESS_REGEX.test(address)) return { valid: false, message: "Invalid hex characters" };
  if (ADDRESS_REGEX.test(address)) return { valid: true, message: "Valid address" };
  if (address.length > 42) return { valid: false, message: "Address too long" };
  return null;
}

export default function ContractsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts", projectId],
    queryFn: () => api.fetch<Contract[]>(`/api/v1/projects/${projectId}/contracts`),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [address, setAddress] = useState("");
  const [contractType, setContractType] = useState<"erc721" | "erc1155">("erc721");
  const [name, setName] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDetect = useCallback(async (addr?: string) => {
    const targetAddress = addr ?? address;
    if (!targetAddress || !ADDRESS_REGEX.test(targetAddress)) return;
    setDetecting(true);
    try {
      const result = await api.fetch<{ contractType: string | null }>(
        `/api/v1/projects/${projectId}/contracts/detect`,
        { method: "POST", body: JSON.stringify({ contractAddress: targetAddress }) },
      );
      if (result.contractType === "erc721" || result.contractType === "erc1155") {
        setContractType(result.contractType);
        toast.success(`Detected ${result.contractType.toUpperCase()}`);
      } else {
        toast.error("Could not auto-detect contract type. Please select manually.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setDetecting(false);
    }
  }, [address, projectId]);

  const handleAddressChange = (value: string) => {
    setAddress(value);
    // Auto-detect when a valid address is pasted (length jumps to 42)
    if (ADDRESS_REGEX.test(value) && address.length < 10) {
      handleDetect(value);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.fetch(`/api/v1/projects/${projectId}/contracts`, {
        method: "POST",
        body: JSON.stringify({ contractAddress: address, contractType, name: name || undefined }),
      });
      setAddress("");
      setName("");
      setContractType("erc721");
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["contracts", projectId] });
      toast.success("Contract added successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add contract");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (contractId: string) => {
    setDeleting(true);
    try {
      await api.fetch(`/api/v1/projects/${projectId}/contracts/${contractId}`, {
        method: "DELETE",
      });
      queryClient.invalidateQueries({ queryKey: ["contracts", projectId] });
      toast.success("Contract removed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete contract");
    } finally {
      setConfirmDeleteId(null);
      setDeleting(false);
    }
  };

  const addressValidation = getAddressValidation(address);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-white">Contracts</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-[2px] bg-brand-green px-4 py-2 text-sm font-medium text-brand-black hover:bg-brand-green/80"
        >
          {showAdd ? "CANCEL" : "ADD CONTRACT"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mt-4 rounded-[2px] border border-brand-green bg-brand-void p-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-brand-gray">Contract Address</label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    required
                    pattern="^0x[a-fA-F0-9]{40}$"
                    className={`w-full rounded-[2px] border bg-brand-black px-3 py-2 text-sm text-brand-white focus:outline-none focus:ring-1 ${addressValidation === null
                      ? "border-brand-green focus:border-brand-white focus:ring-brand-white"
                      : addressValidation.valid
                        ? "border-brand-green focus:border-brand-green focus:ring-brand-green"
                        : "border-brand-red focus:border-brand-red focus:ring-brand-red"
                      }`}
                    placeholder="0x..."
                  />
                  {addressValidation && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs ${addressValidation.valid ? "text-brand-green" : "text-brand-red"
                      }`}>
                      {addressValidation.valid ? "\u2713" : "\u2717"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDetect()}
                  disabled={detecting || !address || !ADDRESS_REGEX.test(address)}
                  className="rounded-[2px] border border-brand-green bg-brand-void px-3 py-2 text-sm font-medium text-brand-white hover:bg-brand-green/10 disabled:opacity-50"
                >
                  {detecting ? "DETECTING..." : "AUTO-DETECT"}
                </button>
              </div>
              {addressValidation && !addressValidation.valid && (
                <p className="mt-1 font-mono text-xs text-brand-red">{addressValidation.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-gray">Contract Type</label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as "erc721" | "erc1155")}
                className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
              >
                <option value="erc721">ERC-721</option>
                <option value="erc1155">ERC-1155</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[2px] bg-brand-white px-4 py-2 text-sm font-medium text-brand-black hover:bg-brand-gray disabled:opacity-50 transition"
            >
              {submitting ? "ADDING..." : "ADD CONTRACT"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="mt-6 font-mono text-sm uppercase tracking-widest text-brand-gray">LOADING_CONTRACTS...</p>
      ) : !contracts || contracts.length === 0 ? (
        <div className="mt-8 rounded-[2px] border border-brand-green bg-brand-void p-8 text-center">
          <p className="font-mono text-sm text-brand-gray">
            NO_CONTRACTS_CONFIGURED
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="rounded-[2px] border border-brand-green bg-brand-void p-4 transition hover:bg-brand-green/10"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-brand-white">{c.name || "UNNAMED_CONTRACT"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-mono text-sm text-brand-gray truncate">
                      {c.contractAddress}
                    </p>
                    <a
                      href={`${EXPLORER_BASE}/address/${c.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-xs text-brand-green hover:text-brand-white transition"
                      title="View on explorer"
                    >
                      &#x2197;
                    </a>
                  </div>
                  <p className="mt-1 font-mono text-xs text-brand-gray">
                    {c.contractType.toUpperCase()} | {c.chain.toUpperCase()} |{" "}
                    {c.isActive ? "ACTIVE" : "INACTIVE"} | {c.verifiedMemberCount.toLocaleString()} VERIFIED
                  </p>
                </div>
                {confirmDeleteId === c.id ? (
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting}
                      className="rounded-[2px] bg-brand-red px-3 py-1 text-sm font-medium text-brand-black hover:bg-brand-red/80 disabled:opacity-50 transition"
                    >
                      {deleting ? "DELETING..." : "CONFIRM"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-sm font-medium text-brand-gray hover:text-brand-white transition"
                    >
                      CANCEL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(c.id)}
                    className="shrink-0 ml-4 rounded-[2px] border border-brand-red px-3 py-1 text-sm font-medium text-brand-red hover:bg-brand-red/10 transition"
                  >
                    REMOVE
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
