import type { Interaction } from "discord.js";
import { handleVerifyButton } from "../buttons/verify.js";
import { logger } from "../logger.js";

export async function onInteractionCreate(interaction: Interaction) {
  // ── Slash commands ─────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn({ command: interaction.commandName }, "Unknown command");
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Error executing slash command");

      const reply = { content: "An error occurred while executing this command.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
    return;
  }

  // ── Button interactions ────────────────────────────────────────────────
  if (interaction.isButton()) {
    if (interaction.customId === "verify_start") {
      await handleVerifyButton(interaction);
      return;
    }
  }
}
