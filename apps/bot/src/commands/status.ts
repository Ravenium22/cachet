import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BotCommand } from "../index.js";
import { getDb, projects, verifications, subscriptions } from "@megaeth-verify/db";
import { eq, and, count, sql } from "drizzle-orm";

export const statusCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show verification stats for this server") as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const db = getDb();
    const guildId = interaction.guild.id;

    // Find the project for this guild
    const project = await db.query.projects.findFirst({
      where: eq(projects.discordGuildId, guildId),
    });

    if (!project) {
      await interaction.editReply({
        content:
          "No project found for this server. Run `/setup` first to create a verification channel.",
      });
      return;
    }

    // Get verification counts
    const [totalResult] = await db
      .select({ total: count() })
      .from(verifications)
      .where(eq(verifications.projectId, project.id));

    const [activeResult] = await db
      .select({ total: count() })
      .from(verifications)
      .where(
        and(
          eq(verifications.projectId, project.id),
          eq(verifications.status, "active")
        )
      );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentResult] = await db
      .select({ total: count() })
      .from(verifications)
      .where(
        and(
          eq(verifications.projectId, project.id),
          sql`${verifications.verifiedAt} >= ${sevenDaysAgo}`
        )
      );

    // Get subscription info
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.projectId, project.id),
    });

    const tier = sub?.tier?.toUpperCase() ?? "FREE";

    const embed = new EmbedBuilder()
      .setTitle(`Verification Status — ${interaction.guild.name}`)
      .setColor(0x0a8f54)
      .addFields(
        {
          name: "Plan",
          value: tier,
          inline: true,
        },
        {
          name: "Total Verifications",
          value: String(totalResult.total),
          inline: true,
        },
        {
          name: "Active Members",
          value: String(activeResult.total),
          inline: true,
        },
        {
          name: "Last 7 Days",
          value: String(recentResult.total),
          inline: true,
        }
      )
      .setFooter({ text: "cachet. • NFT Verification for MegaETH" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
