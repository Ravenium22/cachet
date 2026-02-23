import { DISCORD_API_BASE } from "@megaeth-verify/shared";

function getBotToken(): string {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) throw new Error("DISCORD_BOT_TOKEN is required");
  return token;
}

const headers = () => ({
  Authorization: `Bot ${getBotToken()}`,
  "Content-Type": "application/json",
});

// ── Role management ────────────────────────────────────────────────────────

/**
 * Add a Discord role to a guild member.
 * Returns true if successful, false if the role/member couldn't be found or permissions are missing.
 */
export async function addRole(
  guildId: string,
  userId: string,
  roleId: string,
): Promise<boolean> {
  const url = `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  const res = await fetch(url, { method: "PUT", headers: headers() });

  if (res.ok || res.status === 204) return true;

  // 403 = missing permissions, 404 = role or member not found
  if (res.status === 403 || res.status === 404) {
    console.warn(`addRole failed: guild=${guildId} user=${userId} role=${roleId} status=${res.status}`);
    return false;
  }

  const text = await res.text();
  console.error(`addRole unexpected error: ${res.status} ${text}`);
  return false;
}

/**
 * Remove a Discord role from a guild member.
 * Returns true if successful, false on permission/not-found errors.
 */
export async function removeRole(
  guildId: string,
  userId: string,
  roleId: string,
): Promise<boolean> {
  const url = `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  const res = await fetch(url, { method: "DELETE", headers: headers() });

  if (res.ok || res.status === 204) return true;

  if (res.status === 403 || res.status === 404) {
    console.warn(`removeRole failed: guild=${guildId} user=${userId} role=${roleId} status=${res.status}`);
    return false;
  }

  const text = await res.text();
  console.error(`removeRole unexpected error: ${res.status} ${text}`);
  return false;
}

// ── Batch operations ───────────────────────────────────────────────────────

export interface RoleDelta {
  toAdd: string[];
  toRemove: string[];
}

/**
 * Apply role changes to a guild member. Processes all adds/removes,
 * collecting failures without aborting the batch.
 */
export async function applyRoleChanges(
  guildId: string,
  userId: string,
  delta: RoleDelta,
): Promise<{ added: string[]; removed: string[]; failed: string[] }> {
  const added: string[] = [];
  const removed: string[] = [];
  const failed: string[] = [];

  for (const roleId of delta.toAdd) {
    const ok = await addRole(guildId, userId, roleId);
    if (ok) added.push(roleId);
    else failed.push(roleId);
  }

  for (const roleId of delta.toRemove) {
    const ok = await removeRole(guildId, userId, roleId);
    if (ok) removed.push(roleId);
    else failed.push(roleId);
  }

  return { added, removed, failed };
}

// ── Guild roles ─────────────────────────────────────────────────────────────

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

/**
 * Fetch all roles for a Discord guild.
 * Filters out @everyone and sorts by position (highest first).
 */
export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const url = `${DISCORD_API_BASE}/guilds/${guildId}/roles`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch guild roles: ${res.status} ${text}`);
  }

  const roles = (await res.json()) as DiscordRole[];
  return roles
    .filter((r) => r.name !== "@everyone")
    .sort((a, b) => b.position - a.position);
}

// ── Direct messaging ───────────────────────────────────────────────────────

/**
 * Send a DM to a Discord user via the REST API.
 * Returns true if sent, false if the user has DMs closed or the request fails.
 */
export async function sendDM(userId: string, content: string): Promise<boolean> {
  // Step 1: Create DM channel
  const channelRes = await fetch(`${DISCORD_API_BASE}/users/@me/channels`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!channelRes.ok) {
    console.warn(`sendDM: could not create DM channel for user ${userId} (${channelRes.status})`);
    return false;
  }

  const channel = (await channelRes.json()) as { id: string };

  // Step 2: Send message
  const msgRes = await fetch(`${DISCORD_API_BASE}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ content }),
  });

  if (!msgRes.ok) {
    console.warn(`sendDM: could not send message to user ${userId} (${msgRes.status})`);
    return false;
  }

  return true;
}
