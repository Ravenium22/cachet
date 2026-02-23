import type { Client } from "discord.js";
import { logger } from "../logger.js";

export function onReady(client: Client<true>) {
  logger.info({ user: client.user.tag, guildCount: client.guilds.cache.size }, "Bot ready");

  client.user.setActivity("NFT Verification", { type: 3 }); // Watching
}
