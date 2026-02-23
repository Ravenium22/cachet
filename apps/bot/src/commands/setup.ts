import {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";
import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import type { BotCommand } from "../index.js";
import { getDb, projects, subscriptions } from "@megaeth-verify/db";
import { eq } from "drizzle-orm";

export const setupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Create a verification channel in this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const db = getDb();
    const guildId = interaction.guild.id;

    // Upsert project record
    const existing = await db.query.projects.findFirst({
      where: eq(projects.discordGuildId, guildId),
    });

    let projectId: string;

    if (existing) {
      projectId = existing.id;
      if (existing.deletedAt) {
        await db
          .update(projects)
          .set({
            deletedAt: null,
            ownerDiscordId: interaction.user.id,
            name: interaction.guild.name,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, existing.id));
      }
    } else {
      const [inserted] = await db
        .insert(projects)
        .values({
          discordGuildId: guildId,
          ownerDiscordId: interaction.user.id,
          name: interaction.guild.name,
        })
        .returning({ id: projects.id });
      projectId = inserted.id;
    }

    // Create verification channel
    const channel = await interaction.guild.channels.create({
      name: "verify",
      type: ChannelType.GuildText,
      topic: "Connect your wallet to verify NFT holdings and receive roles.",
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
    });

    // Send verification embed with button
    const embed = new EmbedBuilder()
      .setTitle("NFT Verification")
      .setDescription(
        "Click the button below to verify your NFT holdings and receive your roles.\n\n" +
        "**How it works:**\n" +
        "1. Click **Verify**\n" +
        "2. You'll receive a DM with a verification link\n" +
        "3. Connect your wallet and sign a message (no gas fees)\n" +
        "4. Roles are assigned automatically based on your holdings"
      )
      .setColor(0x0A8F54)
      .setFooter({ text: "cachet. • NFT Verification for MegaETH" });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_start")
        .setLabel("Verify")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("✅"),
    );

    await channel.send({ embeds: [embed], components: [row] });

    // Store channel ID in project record
    await db
      .update(projects)
      .set({
        verificationChannelId: channel.id,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    const existingSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.projectId, projectId),
    });

    if (!existingSubscription) {
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 100);

      await db.insert(subscriptions).values({
        projectId,
        tier: "free",
        status: "active",
        currentPeriodEnd,
        verificationCount: 0,
      });
    }

    await interaction.editReply({
      content: `Verification channel created: <#${channel.id}>`,
    });
  },
};
