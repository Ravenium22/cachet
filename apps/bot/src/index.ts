import { Client, GatewayIntentBits, Collection } from "discord.js";
import type { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import * as Sentry from "@sentry/node";
import { onReady } from "./events/ready.js";
import { onInteractionCreate } from "./events/interactionCreate.js";
import { onGuildCreate } from "./events/guildCreate.js";
import { pingCommand } from "./commands/ping.js";
import { setupCommand } from "./commands/setup.js";
import { helpCommand } from "./commands/help.js";
import { statusCommand } from "./commands/status.js";
import { lookupCommand } from "./commands/lookup.js";
import { revokeCommand } from "./commands/revoke.js";
import { reverifyCommand } from "./commands/reverify.js";
import { auditCommand } from "./commands/audit.js";
import { logger } from "./logger.js";

if (process.env["SENTRY_DSN"]) {
  Sentry.init({
    dsn: process.env["SENTRY_DSN"],
    environment: process.env["NODE_ENV"] ?? "development",
  });
}

export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = new Collection<string, BotCommand>();
commands.set(pingCommand.data.name, pingCommand);
commands.set(setupCommand.data.name, setupCommand);
commands.set(helpCommand.data.name, helpCommand);
commands.set(statusCommand.data.name, statusCommand);
commands.set(lookupCommand.data.name, lookupCommand);
commands.set(revokeCommand.data.name, revokeCommand);
commands.set(reverifyCommand.data.name, reverifyCommand);
commands.set(auditCommand.data.name, auditCommand);

declare module "discord.js" {
  interface Client {
    commands: Collection<string, BotCommand>;
  }
}
client.commands = commands;

client.once("ready", onReady);
client.on("interactionCreate", onInteractionCreate);
client.on("guildCreate", onGuildCreate);

const token = process.env["DISCORD_BOT_TOKEN"];
if (!token) {
  logger.error("DISCORD_BOT_TOKEN environment variable is required");
  process.exit(1);
}

client.login(token).catch((err) => {
  logger.error({ err }, "Failed to login to Discord");
  if (process.env["SENTRY_DSN"]) {
    Sentry.captureException(err);
  }
  process.exit(1);
});

function shutdown() {
  logger.info("Shutting down bot...");
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
