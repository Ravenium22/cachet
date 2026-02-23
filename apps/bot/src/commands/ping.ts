import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BotCommand } from "../index.js";

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is alive") as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply({
      content: `Pong! Latency: ${latency}ms | WebSocket: ${interaction.client.ws.ping}ms`,
      ephemeral: true,
    });
  },
};
