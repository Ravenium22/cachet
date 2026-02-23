import {
  DISCORD_API_BASE,
  DISCORD_OAUTH_SCOPES,
  type DiscordUser,
  type DiscordTokenResponse,
} from "@megaeth-verify/shared";

function getClientId(): string {
  const id = process.env["DISCORD_CLIENT_ID"];
  if (!id) throw new Error("DISCORD_CLIENT_ID is required");
  return id;
}

function getClientSecret(): string {
  const secret = process.env["DISCORD_CLIENT_SECRET"];
  if (!secret) throw new Error("DISCORD_CLIENT_SECRET is required");
  return secret;
}

function getRedirectUri(): string {
  const base = process.env["API_URL"] ?? "http://localhost:3001";
  return `${base}/api/v1/auth/discord/callback`;
}

/**
 * Build the Discord OAuth2 authorization URL.
 */
export function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: DISCORD_OAUTH_SCOPES.join(" "),
    state,
  });
  return `${DISCORD_API_BASE}/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for Discord tokens.
 */
export async function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord token exchange failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<DiscordTokenResponse>;
}

/**
 * Fetch the authenticated user's Discord profile.
 */
export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Discord user: ${response.status}`);
  }

  return response.json() as Promise<DiscordUser>;
}
