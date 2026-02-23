"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Contract {
  id: string;
  contractAddress: string;
  contractType: "erc721" | "erc1155";
  name: string | null;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

interface RoleMapping {
  id: string;
  contractId: string;
  discordRoleId: string;
  minNftCount: number;
  tokenIds: number[] | null;
  contractAddress: string;
  contractType: string;
  contractName: string | null;
  order: number;
}

function roleColorToHex(color: number): string | null {
  if (!color) return null;
  return `#${color.toString(16).padStart(6, "0")}`;
}

export default function RoleMappingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["roleMappings", projectId],
    queryFn: () => api.fetch<RoleMapping[]>(`/api/v1/projects/${projectId}/roles`),
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts", projectId],
    queryFn: () => api.fetch<Contract[]>(`/api/v1/projects/${projectId}/contracts`),
  });

  const { data: discordRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["discordRoles", projectId],
    queryFn: () => api.fetch<DiscordRole[]>(`/api/v1/projects/${projectId}/discord-roles`),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [contractId, setContractId] = useState("");
  const [discordRoleId, setDiscordRoleId] = useState("");
  const [minNftCount, setMinNftCount] = useState(1);
  const [tokenIdsStr, setTokenIdsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMinNft, setEditMinNft] = useState(1);
  const [editTokenIds, setEditTokenIds] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const selectedContract = contracts?.find((c) => c.id === contractId);
  const isErc1155 = selectedContract?.contractType === "erc1155";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId) {
      toast.error("Please select a contract");
      return;
    }
    if (!discordRoleId) {
      toast.error("Please select a Discord role");
      return;
    }
    setSubmitting(true);
    try {
      const tokenIds = tokenIdsStr
        ? tokenIdsStr.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
        : undefined;

      await api.fetch(`/api/v1/projects/${projectId}/roles`, {
        method: "POST",
        body: JSON.stringify({
          contractId,
          discordRoleId,
          minNftCount,
          tokenIds: isErc1155 ? tokenIds : undefined,
        }),
      });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["roleMappings", projectId] });
      toast.success("Role mapping created successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create mapping");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setContractId("");
    setDiscordRoleId("");
    setMinNftCount(1);
    setTokenIdsStr("");
    setShowCreate(false);
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (roleId: string) => {
    setDeleting(true);
    try {
      await api.fetch(`/api/v1/projects/${projectId}/roles/${roleId}`, {
        method: "DELETE",
      });
      queryClient.invalidateQueries({ queryKey: ["roleMappings", projectId] });
      toast.success("Role mapping deleted successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setConfirmDeleteId(null);
      setDeleting(false);
    }
  };

  const startEdit = useCallback((m: RoleMapping) => {
    setEditingId(m.id);
    setEditMinNft(m.minNftCount);
    setEditTokenIds(m.tokenIds ? m.tokenIds.join(", ") : "");
  }, []);

  const handleEditSave = async (mapping: RoleMapping) => {
    setEditSubmitting(true);
    try {
      const tokenIds = editTokenIds
        ? editTokenIds.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
        : undefined;

      await api.fetch(`/api/v1/projects/${projectId}/roles/${mapping.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          minNftCount: editMinNft,
          tokenIds: mapping.contractType === "erc1155" ? tokenIds : undefined,
        }),
      });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["roleMappings", projectId] });
      toast.success("Role mapping updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update mapping");
    } finally {
      setEditSubmitting(false);
    }
  };

  const getRoleName = useCallback((roleId: string) => {
    if (rolesLoading) return null;
    const role = discordRoles?.find((r) => r.id === roleId);
    return role?.name ?? roleId;
  }, [discordRoles, rolesLoading]);

  const getRoleColor = useCallback((roleId: string): string | null => {
    const role = discordRoles?.find((r) => r.id === roleId);
    return role ? roleColorToHex(role.color) : null;
  }, [discordRoles]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !mappings) {
      return;
    }

    const oldIndex = mappings.findIndex((m) => m.id === active.id);
    const newIndex = mappings.findIndex((m) => m.id === over.id);

    const newMappings = arrayMove(mappings, oldIndex, newIndex);
    queryClient.setQueryData(["roleMappings", projectId], newMappings);

    try {
      await api.fetch(`/api/v1/projects/${projectId}/roles/reorder`, {
        method: "PUT",
        body: JSON.stringify({
          roleMappingIds: newMappings.map((m) => m.id),
        }),
      });
      toast.success("Order saved");
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ["roleMappings", projectId] });
      toast.error("Failed to reorder mappings");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-white">Role Mappings</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-[2px] bg-brand-green px-4 py-2 text-sm font-medium text-brand-black hover:bg-brand-green/80 transition"
        >
          {showCreate ? "CANCEL" : "CREATE MAPPING"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 rounded-[2px] border border-brand-green bg-brand-void p-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-brand-gray">Contract</label>
              <select
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
              >
                <option value="">Select a contract...</option>
                {contracts?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.contractAddress} ({c.contractType.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-gray">Discord Role</label>
              <select
                value={discordRoleId}
                onChange={(e) => setDiscordRoleId(e.target.value)}
                className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
              >
                <option value="">Select a role...</option>
                {discordRoles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.color ? ` ●` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-gray">Minimum NFT Count</label>
              <input
                type="number"
                value={minNftCount}
                onChange={(e) => setMinNftCount(parseInt(e.target.value, 10) || 1)}
                min={1}
                className="mt-1 w-32 rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
              />
            </div>
            {isErc1155 && (
              <div>
                <label className="block text-sm font-medium text-brand-gray">
                  Token IDs (comma-separated, required for ERC-1155)
                </label>
                <input
                  type="text"
                  value={tokenIdsStr}
                  onChange={(e) => setTokenIdsStr(e.target.value)}
                  required={isErc1155}
                  className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
                  placeholder="0, 1, 2"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[2px] bg-brand-white px-4 py-2 text-sm font-medium text-brand-black hover:bg-brand-gray disabled:opacity-50 transition"
            >
              {submitting ? "CREATING..." : "CREATE MAPPING"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="mt-6 font-mono text-sm uppercase tracking-widest text-brand-gray">LOADING_MAPPINGS...</p>
      ) : !mappings || mappings.length === 0 ? (
        <div className="mt-8 rounded-[2px] border border-brand-green bg-brand-void p-8 text-center">
          <p className="font-mono text-sm text-brand-gray">
            NO_ROLE_MAPPINGS_CONFIGURED
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={mappings.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {mappings.map((m) => (
                  <SortableRoleItem
                    key={m.id}
                    mapping={m}
                    getRoleName={getRoleName}
                    getRoleColor={getRoleColor}
                    isEditing={editingId === m.id}
                    startEdit={() => startEdit(m)}
                    editMinNft={editMinNft}
                    setEditMinNft={setEditMinNft}
                    editTokenIds={editTokenIds}
                    setEditTokenIds={setEditTokenIds}
                    handleEditSave={() => handleEditSave(m)}
                    editSubmitting={editSubmitting}
                    setEditingId={setEditingId}
                    confirmDeleteId={confirmDeleteId}
                    setConfirmDeleteId={setConfirmDeleteId}
                    handleDelete={() => handleDelete(m.id)}
                    deleting={deleting}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function SortableRoleItem({
  mapping,
  getRoleName,
  getRoleColor,
  isEditing,
  startEdit,
  editMinNft,
  setEditMinNft,
  editTokenIds,
  setEditTokenIds,
  handleEditSave,
  editSubmitting,
  setEditingId,
  confirmDeleteId,
  setConfirmDeleteId,
  handleDelete,
  deleting,
}: {
  mapping: RoleMapping;
  getRoleName: (id: string) => string | null;
  getRoleColor: (id: string) => string | null;
  isEditing: boolean;
  startEdit: () => void;
  editMinNft: number;
  setEditMinNft: (n: number) => void;
  editTokenIds: string;
  setEditTokenIds: (s: string) => void;
  handleEditSave: () => void;
  editSubmitting: boolean;
  setEditingId: (id: string | null) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleDelete: () => void;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mapping.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  };

  const roleName = getRoleName(mapping.discordRoleId);
  const roleColor = getRoleColor(mapping.discordRoleId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[2px] border border-brand-green bg-brand-void p-4 transition ${isDragging ? "opacity-50 shadow-lg shadow-brand-green/20" : "hover:bg-brand-green/10"
        }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Drag Handle */}
          {!isEditing && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-move p-1 text-brand-gray hover:text-brand-white focus:outline-none shrink-0"
              title="Drag to reorder"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="12" r="1" />
                <circle cx="9" cy="5" r="1" />
                <circle cx="9" cy="19" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="15" cy="5" r="1" />
                <circle cx="15" cy="19" r="1" />
              </svg>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {roleColor && (
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: roleColor }}
                  title="Discord role color"
                />
              )}
              <p className="font-semibold text-brand-white">
                {roleName === null ? (
                  <span className="inline-block h-4 w-24 animate-pulse rounded bg-brand-gray/30" />
                ) : (
                  roleName
                )}
              </p>
            </div>
            <p className="mt-1 font-mono text-xs text-brand-gray">
              CONTRACT: {mapping.contractName || mapping.contractAddress.slice(0, 10) + "..."} ({mapping.contractType.toUpperCase()})
            </p>

            {isEditing ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="font-mono text-xs text-brand-gray">MIN:</label>
                  <input
                    type="number"
                    value={editMinNft}
                    onChange={(e) => setEditMinNft(parseInt(e.target.value, 10) || 1)}
                    min={1}
                    className="w-20 rounded-[2px] border border-brand-green bg-brand-black px-2 py-1 text-sm text-brand-white focus:border-brand-white focus:outline-none"
                  />
                </div>
                {mapping.contractType === "erc1155" && (
                  <div className="flex items-center gap-2">
                    <label className="font-mono text-xs text-brand-gray">TOKEN_IDS:</label>
                    <input
                      type="text"
                      value={editTokenIds}
                      onChange={(e) => setEditTokenIds(e.target.value)}
                      className="w-40 rounded-[2px] border border-brand-green bg-brand-black px-2 py-1 text-sm text-brand-white focus:border-brand-white focus:outline-none"
                      placeholder="0, 1, 2"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleEditSave}
                    disabled={editSubmitting}
                    className="rounded-[2px] bg-brand-green px-3 py-1 text-sm font-medium text-brand-black hover:bg-brand-green/80 disabled:opacity-50 transition"
                  >
                    {editSubmitting ? "SAVING..." : "SAVE"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm font-medium text-brand-gray hover:text-brand-white transition"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 font-mono text-xs text-brand-gray">
                MIN: {mapping.minNftCount} NFT(S)
                {mapping.tokenIds && mapping.tokenIds.length > 0 && (
                  <span> | TOKEN_IDS: {mapping.tokenIds.join(", ")}</span>
                )}
              </p>
            )}
          </div>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={startEdit}
              className="rounded-[2px] border border-brand-green px-3 py-1 text-sm font-medium text-brand-green hover:bg-brand-green/10 transition"
            >
              EDIT
            </button>
            {confirmDeleteId === mapping.id ? (
              <>
                <button
                  onClick={handleDelete}
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
              </>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(mapping.id)}
                className="rounded-[2px] border border-brand-red px-3 py-1 text-sm font-medium text-brand-red hover:bg-brand-red/10 transition"
              >
                DELETE
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
