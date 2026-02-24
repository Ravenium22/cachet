import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BotCommand } from "../index.js";
import { getDb, projects, verifications, verificationLogs } from "@megaeth-verify/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../logger.js";

export const revokeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("revoke")
    .setDescription("Revoke a user's verification and remove all granted roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The Discord user to revoke").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for revoking (logged)").setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "Manual revoke by admin";
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
      await interaction.editReply({ content: `**${targetUser.tag}** has no verification record in this server.` });
      return;
    }

    if (verification.status === "revoked") {
      await interaction.editReply({ content: `**${targetUser.tag}** is already revoked.` });
      return;
    }

    // Remove roles from the Discord member
    const rolesToRemove = verification.rolesGranted ?? [];
    let rolesRemoved = 0;

    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      for (const roleId of rolesToRemove) {
        try {
          await member.roles.remove(roleId, `Revoked by ${interaction.user.tag}: ${reason}`);
          rolesRemoved++;
        } catch (err) {
          logger.warn({ err, roleId, userId: targetUser.id }, "Failed to remove role during revoke");
        }
      }
    } catch {
      // Member may have left the server — still update DB
      logger.info({ userId: targetUser.id }, "Member not in server during revoke, updating DB only");
    }

    // Update verification status
    await db
      .update(verifications)
      .set({
        status: "revoked",
        rolesGranted: [],
        lastChecked: new Date(),
      })
      .where(eq(verifications.id, verification.id));

    // Log the event
    await db.insert(verificationLogs).values({
      verificationId: verification.id,
      eventType: "expired", // closest enum value for revoke
      details: {
        source: "manual",
        revokedBy: interaction.user.id,
        reason,
        rolesRemoved: rolesToRemove,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle("Verification Revoked")
      .setColor(0xe74c3c)
      .addFields(
        { name: "User", value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
        { name: "Wallet", value: `\`${verification.walletAddress}\``, inline: true },
        { name: "Roles Removed", value: rolesRemoved > 0 ? `${rolesRemoved} role(s)` : "None (member not in server)", inline: true },
        { name: "Reason", value: reason, inline: false },
        { name: "Revoked By", value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: "cachet. • NFT Verification" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      { projectId: project.id, userId: targetUser.id, revokedBy: interaction.user.id, reason },
      "Verification manually revoked",
    );
  },
};
