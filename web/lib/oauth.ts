/**
 * OAuth helpers for Google, GitHub, X (Twitter), and Discord.
 *
 * Required env vars per provider:
 *   Google:  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL
 *   GitHub:  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BASE_URL
 *   X:       X_CLIENT_ID, X_CLIENT_SECRET, BASE_URL
 *   Discord: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, BASE_URL
 *
 * BASE_URL is the public URL of the app (e.g. https://clawplay.example.com)
 */

function getBaseUrl(requestOrigin?: string): string {
  // Prefer explicit BASE_URL env var; fall back to request origin for local dev
  const base = process.env.BASE_URL ?? requestOrigin;
  if (!base) throw new Error("BASE_URL env var is required for OAuth (or run the dev server on a known origin)");
  return base;
}

// ─── Google ──────────────────────────────────────────────────────────────────

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export function getGoogleAuthUrl(state: string, requestOrigin?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
  const redirectUri = `${getBaseUrl(requestOrigin)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(
  code: string,
  requestOrigin?: string
): Promise<{ accessToken: string; idToken: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${getBaseUrl(requestOrigin)}/api/auth/google/callback`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
  };
  if (!json.access_token || !json.id_token) {
    throw new Error(`Google token exchange failed: ${json.error ?? "unknown"}`);
  }
  return { accessToken: json.access_token, idToken: json.id_token };
}

export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!json.id || !json.email) {
    throw new Error("Google userinfo failed: missing id or email");
  }
  return { id: json.id, email: json.email, name: json.name ?? "", picture: json.picture };
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

export interface GithubUserInfo {
  id: number;
  email: string;
  name: string;
  avatarUrl: string;
}

export function getGithubAuthUrl(state: string, requestOrigin?: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) throw new Error("GITHUB_CLIENT_ID is not set");
  const redirectUri = `${getBaseUrl(requestOrigin)}/api/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGithubCode(code: string, requestOrigin?: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!;

  // Exchange code for access token
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${getBaseUrl(requestOrigin)}/api/auth/github/callback`,
      }),
    }
  );
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenJson.access_token) {
    throw new Error(`GitHub token exchange failed: ${tokenJson.error ?? "unknown"}`);
  }
  return tokenJson.access_token;
}

export async function getGithubUserInfo(accessToken: string): Promise<GithubUserInfo> {
  // Fetch user profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ClawPlay",
    },
  });
  const userJson = (await userRes.json()) as {
    id?: number;
    name?: string;
    avatar_url?: string;
    email?: string;
  };
  if (!userJson.id) throw new Error("GitHub userinfo failed: missing id");

  // If email is not public, fetch from emails endpoint
  let email = userJson.email ?? "";
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "ClawPlay",
      },
    });
    const emailsJson = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primary = emailsJson.find((e) => e.primary && e.verified);
    email = primary?.email ?? emailsJson[0]?.email ?? "";
  }

  return {
    id: userJson.id,
    email,
    name: userJson.name ?? "",
    avatarUrl: userJson.avatar_url ?? "",
  };
}

// ─── X (Twitter) ─────────────────────────────────────────────────────────────

export interface XUserInfo {
  id: string;
  email: string;
  name: string;
  username: string;
}

export function getXAuthUrl(state: string, codeChallenge: string, requestOrigin?: string): string {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) throw new Error("X_CLIENT_ID is not set");
  const redirectUri = `${getBaseUrl(requestOrigin)}/api/auth/x/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "users.read email.read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://twitter.com/i/oauth2/authorize?${params}`;
}

export async function exchangeXCode(code: string, codeVerifier: string, requestOrigin?: string): Promise<string> {
  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const redirectUri = `${getBaseUrl(requestOrigin)}/api/auth/x/callback`;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!json.access_token) {
    throw new Error(`X token exchange failed: ${json.error ?? "unknown"}`);
  }
  return json.access_token;
}

export async function getXUserInfo(accessToken: string): Promise<XUserInfo> {
  const res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=email,name,username",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const json = (await res.json()) as {
    data?: { id?: string; email?: string; name?: string; username?: string };
    errors?: Array<{ detail?: string }>;
  };
  if (!json.data?.id || !json.data?.email) {
    throw new Error(
      `X userinfo failed: ${json.errors?.[0]?.detail ?? "missing id or email"}`
    );
  }
  return {
    id: json.data.id,
    email: json.data.email,
    name: json.data.name ?? "",
    username: json.data.username ?? "",
  };
}

// ─── Discord ───────────────────────────────────────────────────────────────────

export interface DiscordUserInfo {
  id: string;
  email: string;
  name: string;
  avatarHash: string | null;
  avatarUrl: string;
}

export function getDiscordAuthUrl(state: string, requestOrigin?: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("DISCORD_CLIENT_ID is not set");
  const redirectUri = `${getBaseUrl(requestOrigin)}/api/auth/discord/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify email",
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

export async function exchangeDiscordCode(code: string, requestOrigin?: string): Promise<string> {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
  const redirectUri = `${getBaseUrl(requestOrigin)}/api/auth/discord/callback`;

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!json.access_token) {
    throw new Error(`Discord token exchange failed: ${json.error ?? "unknown"}`);
  }
  return json.access_token;
}

export async function getDiscordUserInfo(accessToken: string): Promise<DiscordUserInfo> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    id?: string;
    email?: string;
    global_name?: string;
    username?: string;
    avatar?: string | null;
  };
  if (!json.id || !json.email) {
    throw new Error("Discord userinfo failed: missing id or email");
  }

  const avatarHash = json.avatar ?? null;
  const avatarUrl = avatarHash
    ? `https://cdn.discordapp.com/avatars/${json.id}/${avatarHash}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(json.id) >> BigInt(22)) % BigInt(6))}.png`;

  return {
    id: json.id,
    email: json.email ?? "",
    name: json.global_name ?? json.username ?? "",
    avatarHash,
    avatarUrl,
  };
}
