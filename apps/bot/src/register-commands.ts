import { REST, Routes } from "discord.js";
import { pingCommand } from "./commands/ping.js";
import { setupCommand } from "./commands/setup.js";
import { helpCommand } from "./commands/help.js";
import { statusCommand } from "./commands/status.js";
import { lookupCommand } from "./commands/lookup.js";
import { revokeCommand } from "./commands/revoke.js";
import { reverifyCommand } from "./commands/reverify.js";
import { auditCommand } from "./commands/audit.js";

const token = process.env["DISCORD_BOT_TOKEN"];
const clientId = process.env["DISCORD_CLIENT_ID"];

if (!token || !clientId) {
  console.error("DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID environment variables are required");
  process.exit(1);
}

const commands = [
  pingCommand.data.toJSON(),
  setupCommand.data.toJSON(),
  helpCommand.data.toJSON(),
  statusCommand.data.toJSON(),
  lookupCommand.data.toJSON(),
  revokeCommand.data.toJSON(),
  reverifyCommand.data.toJSON(),
  auditCommand.data.toJSON(),
];

const rest = new REST({ version: "10" }).setToken(token);

async function register() {
  try {
    console.log(`Registering ${commands.length} slash commands...`);

    await rest.put(Routes.applicationCommands(clientId!), {
      body: commands,
    });

    console.log("Slash commands registered successfully.");
  } catch (err) {
    console.error("Failed to register commands:", err);
    process.exit(1);
  }
}

register();
