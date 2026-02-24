import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BotCommand } from "../index.js";
import { getDb, projects, verifications, verificationLogs } from "@megaeth-verify/db";
import { eq, and, desc } from "drizzle-orm";

export const lookupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Look up a user's verification status and linked wallet")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The Discord user to look up").setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user", true);
    const db = getDb();

    const project = await db.query.projects.findFirst({
      where: eq(projects.discordGuildId, interaction.guild.id),
    });

    if (!project) {
      await interaction.editReply({ content: "No project found for this server. Run `/setup` first." });
      return;
    }

    const verification = await db.query.verifications.findFirst({
      where: and(
        eq(verifications.projectId, project.id),
        eq(verifications.userDiscordId, targetUser.id),
      ),
    });

    if (!verification) {
      await interaction.editReply({ content: `**${targetUser.tag}** has not verified in this server.` });
      return;
    }

    // Get recent logs
    const recentLogs = await db
      .select({
        eventType: verificationLogs.eventType,
        createdAt: verificationLogs.createdAt,
      })
      .from(verificationLogs)
      .where(eq(verificationLogs.verificationId, verification.id))
      .orderBy(desc(verificationLogs.createdAt))
      .limit(5);

    const rolesDisplay = verification.rolesGranted && verification.rolesGranted.length > 0
      ? verification.rolesGranted.map((r) => `<@&${r}>`).join(", ")
      : "None";

    const logsDisplay = recentLogs.length > 0
      ? recentLogs
          .map((l) => `\`${l.eventType}\` — <t:${Math.floor(l.createdAt.getTime() / 1000)}:R>`)
          .join("\n")
      : "No events recorded";

    const embed = new EmbedBuilder()
      .setTitle(`Lookup — ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor(
        verification.status === "active" ? 0x0a8f54
        : verification.status === "expired" ? 0xf5a623
        : 0xe74c3c,
      )
      .addFields(
        { name: "Status", value: verification.status.toUpperCase(), inline: true },
        { name: "Wallet", value: `\`${verification.walletAddress}\``, inline: true },
        { name: "Roles Granted", value: rolesDisplay, inline: false },
        { name: "Verified At", value: `<t:${Math.floor(verification.verifiedAt.getTime() / 1000)}:F>`, inline: true },
        { name: "Last Checked", value: `<t:${Math.floor(verification.lastChecked.getTime() / 1000)}:R>`, inline: true },
        { name: "Recent Activity", value: logsDisplay, inline: false },
      )
      .setFooter({ text: "cachet. • NFT Verification" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
