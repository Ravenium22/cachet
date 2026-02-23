import type { Guild } from "discord.js";

export async function onGuildCreate(guild: Guild) {
  console.log(`Joined guild: ${guild.name} (${guild.id}) — ${guild.memberCount} members`);

  // In Sprint 2+, we can auto-create a project record here.
  // For now, project creation is handled via /setup or the API.
}
