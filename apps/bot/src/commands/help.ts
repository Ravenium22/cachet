import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BotCommand } from "../index.js";

const SITE_URL = process.env["SITE_URL"] ?? "https://usecachet.com";

export const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List available commands and links to docs") as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle("Cachet — Bot Commands")
      .setColor(0x0a8f54)
      .setDescription(
        "Strict NFT verification for MegaETH communities.\n\n" +
          "**Available Commands:**"
      )
      .addFields(
        {
          name: "/setup",
          value:
            "Create a verification channel with a Verify button. *Admin only.*",
          inline: false,
        },
        {
          name: "/status",
          value:
            "Show verification stats for this server (total, active, recent).",
          inline: false,
        },
        {
          name: "/ping",
          value: "Check if the bot is alive and view latency.",
          inline: false,
        },
        {
          name: "/help",
          value: "Show this help message.",
          inline: false,
        }
      )
      .addFields({
        name: "Links",
        value: `[Dashboard](${SITE_URL}/dashboard) • [Pricing](${SITE_URL}/pricing) • [Terms](${SITE_URL}/terms)`,
        inline: false,
      })
      .setFooter({ text: "cachet. • NFT Verification for MegaETH" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
