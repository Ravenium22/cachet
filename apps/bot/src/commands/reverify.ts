import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BotCommand } from "../index.js";
import { logger } from "../logger.js";

function getApiUrl(): string {
  return process.env["API_URL"] ?? "http://localhost:3001";
}

function getBotApiSecret(): string {
  const secret = process.env["BOT_API_SECRET"];
  if (!secret) throw new Error("BOT_API_SECRET is required");
  return secret;
}

interface ReverifyResponse {
  success: boolean;
  data?: {
    walletAddress: string;
    rolesGranted: string[];
    rolesRemoved: string[];
    stillHoldsNft: boolean;
  };
  error?: string;
}

export const reverifyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("reverify")
    .setDescription("Force an immediate re-check of a user's NFT holdings")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The Discord user to re-verify").setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user", true);

    let result: ReverifyResponse;
    try {
      const res = await fetch(`${getApiUrl()}/api/v1/verify/reverify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${getBotApiSecret()}`,
        },
        body: JSON.stringify({
          guildId: interaction.guild.id,
          userDiscordId: targetUser.id,
        }),
      });

      result = (await res.json()) as ReverifyResponse;

      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error ?? `API returned ${res.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reverify user";
      logger.error({ err, userId: targetUser.id }, "Reverify command failed");
      await interaction.editReply({ content: `Failed: ${message}` });
      return;
    }

    const { data } = result;
    const rolesGrantedDisplay = data.rolesGranted.length > 0
      ? data.rolesGranted.map((r) => `<@&${r}>`).join(", ")
      : "None";
    const rolesRemovedDisplay = data.rolesRemoved.length > 0
      ? data.rolesRemoved.map((r) => `<@&${r}>`).join(", ")
      : "None";

    const embed = new EmbedBuilder()
      .setTitle("Re-Verification Complete")
      .setColor(data.stillHoldsNft ? 0x0a8f54 : 0xf5a623)
      .addFields(
        { name: "User", value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
        { name: "Wallet", value: `\`${data.walletAddress}\``, inline: true },
        { name: "Still Holds NFT", value: data.stillHoldsNft ? "YES" : "NO", inline: true },
        { name: "Roles Granted", value: rolesGrantedDisplay, inline: false },
        { name: "Roles Removed", value: rolesRemovedDisplay, inline: false },
      )
      .setFooter({ text: `Triggered by ${interaction.user.tag} • cachet.` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
