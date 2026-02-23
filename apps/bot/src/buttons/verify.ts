import { EmbedBuilder } from "discord.js";
import type { ButtonInteraction } from "discord.js";
import { logger } from "../logger.js";

function getApiUrl(): string {
  return process.env["API_URL"] ?? "http://localhost:3001";
}

function getBotApiSecret(): string {
  const secret = process.env["BOT_API_SECRET"];
  if (!secret) throw new Error("BOT_API_SECRET is required");
  return secret;
}

interface InitiateResponse {
  success: boolean;
  data?: { token: string; verifyUrl: string };
  error?: string;
  details?: {
    code?: string;
    suggestedTier?: string;
  };
}

/**
 * Handles the "Verify" button click in the verification channel.
 * Calls the API to generate a verification link, then DMs the user.
 */
export async function handleVerifyButton(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: "This button only works in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // Call API to generate verification link
  let result: InitiateResponse;
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/verify/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${getBotApiSecret()}`,
      },
      body: JSON.stringify({
        guildId: interaction.guild.id,
        userDiscordId: interaction.user.id,
      }),
    });

    result = (await res.json()) as InitiateResponse;

    if (!res.ok || !result.success || !result.data) {
      if (res.status === 402) {
        const suggestedTier = result.details?.suggestedTier;
        const suffix = suggestedTier ? ` Suggested upgrade: ${suggestedTier}.` : "";
        throw new Error(`This server has reached its verification plan limit.${suffix}`);
      }
      throw new Error(result.error ?? `API returned ${res.status}`);
    }
  } catch (err) {
    logger.error({ err }, "Failed to initiate verification");
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Provide specific guidance based on the error
    let userMessage: string;
    if (errorMsg.includes("plan limit") || errorMsg.includes("verification limit")) {
      userMessage =
        "This server has reached its verification limit. Please ask a server admin to upgrade the plan at <https://usecachet.com/pricing>.";
    } else if (errorMsg.includes("404") || errorMsg.includes("not found")) {
      userMessage =
        "This server hasn't been set up for verification yet. A server admin needs to run `/setup` first.";
    } else if (errorMsg.includes("401") || errorMsg.includes("403")) {
      userMessage =
        "The bot isn't authorized to perform verifications. Please contact a server admin.";
    } else {
      userMessage =
        "Something went wrong starting verification. Please try again in a few minutes. If this keeps happening, contact a server admin.";
    }

    await interaction.editReply({ content: userMessage });
    return;
  }

  // DM the user the verification link
  const embed = new EmbedBuilder()
    .setTitle("Verify Your NFT Holdings")
    .setDescription(
      `Click the link below to connect your wallet and verify your NFTs for **${interaction.guild.name}**.\n\n` +
      `**[Click here to verify](${result.data.verifyUrl})**\n\n` +
      `This link expires in **15 minutes** and can only be used once.`,
    )
    .setColor(0x0A8F54)
    .setFooter({ text: "cachet. • No gas fees required" })
    .setTimestamp();

  try {
    await interaction.user.send({ embeds: [embed] });
    await interaction.editReply({
      content: "Check your DMs! I sent you a verification link.",
    });
  } catch (dmError: unknown) {
    // User has DMs closed or blocked the bot
    const discordError = dmError as { code?: number };
    if (discordError.code === 50007) {
      await interaction.editReply({
        content:
          "I couldn't send you a DM. Please enable **Allow direct messages from server members** in your privacy settings for this server, then try again.",
      });
    } else {
      logger.error({ err: dmError }, "Failed to DM user");
      await interaction.editReply({
        content: "Something went wrong sending you a DM. Please try again.",
      });
    }
  }
}
