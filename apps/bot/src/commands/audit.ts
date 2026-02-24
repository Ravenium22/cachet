import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BotCommand } from "../index.js";
import { getDb, projects, verifications, verificationLogs } from "@megaeth-verify/db";
import { eq, desc } from "drizzle-orm";

const EVENT_LABELS: Record<string, string> = {
  verified: "VERIFIED",
  reverified: "RE-VERIFIED",
  roles_updated: "ROLES_UPDATED",
  expired: "EXPIRED/REVOKED",
};

export const auditCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("audit")
    .setDescription("Show recent verification activity in this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addIntegerOption((opt) =>
      opt
        .setName("count")
        .setDescription("Number of events to show (default 15, max 25)")
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const limit = interaction.options.getInteger("count") ?? 15;
    const db = getDb();

    const project = await db.query.projects.findFirst({
      where: eq(projects.discordGuildId, interaction.guild.id),
    });

    if (!project) {
      await interaction.editReply({ content: "No project found for this server. Run `/setup` first." });
      return;
    }

    // Get recent verification logs joined with verifications for user info
    const logs = await db
      .select({
        eventType: verificationLogs.eventType,
        createdAt: verificationLogs.createdAt,
        details: verificationLogs.details,
        userDiscordId: verifications.userDiscordId,
        walletAddress: verifications.walletAddress,
      })
      .from(verificationLogs)
      .innerJoin(verifications, eq(verificationLogs.verificationId, verifications.id))
      .where(eq(verifications.projectId, project.id))
      .orderBy(desc(verificationLogs.createdAt))
      .limit(limit);

    if (logs.length === 0) {
      await interaction.editReply({ content: "No verification activity recorded yet." });
      return;
    }

    const lines = logs.map((log) => {
      const timestamp = `<t:${Math.floor(log.createdAt.getTime() / 1000)}:R>`;
      const label = EVENT_LABELS[log.eventType] ?? log.eventType.toUpperCase();
      const wallet = log.walletAddress.slice(0, 6) + "..." + log.walletAddress.slice(-4);
      const details = log.details as Record<string, unknown> | null;
      const source = details?.source ? ` (${details.source})` : "";
      return `\`${label}\`${source} — <@${log.userDiscordId}> \`${wallet}\` ${timestamp}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`Audit Log — ${interaction.guild.name}`)
      .setColor(0x0a8f54)
      .setDescription(lines.join("\n"))
      .setFooter({ text: `Showing last ${logs.length} events • cachet.` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
