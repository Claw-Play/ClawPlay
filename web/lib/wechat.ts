/**
 * WeChat Web OAuth helpers (公众号网页授权)
 *
 * Required env vars:
 *   WECHAT_APP_ID
 *   WECHAT_APP_SECRET
 *   WECHAT_REDIRECT_BASE_URL  — e.g. https://clawplay.cn (must be authorized in WeChat backend)
 */

export interface WechatAccessToken {
  openid: string;
  accessToken: string;
  expiresIn: number;
}

export interface WechatUserInfo {
  openid: string;
  nickname: string;
  headimgurl: string;
}

function getConfig() {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  const redirectBase = process.env.WECHAT_REDIRECT_BASE_URL;

  if (!appId || !appSecret || !redirectBase) {
    throw new Error(
      "WeChat OAuth not configured. Set WECHAT_APP_ID, WECHAT_APP_SECRET, WECHAT_REDIRECT_BASE_URL."
    );
  }
  return { appId, appSecret, redirectBase };
}

/**
 * Build the WeChat OAuth redirect URL.
 * scope=snsapi_userinfo to get nickname and avatar.
 * state is passed through and returned in callback for CSRF protection.
 */
export function getWechatAuthUrl(state: string): string {
  const { appId, redirectBase } = getConfig();
  const redirectUri = encodeURIComponent(`${redirectBase}/api/auth/wechat/callback`);
  return (
    `https://open.weixin.qq.com/connect/oauth2/authorize` +
    `?appid=${appId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=snsapi_userinfo` +
    `&state=${encodeURIComponent(state)}` +
    `#wechat_redirect`
  );
}

/**
 * Exchange an OAuth code for access_token + openid.
 */
export async function exchangeCode(code: string): Promise<WechatAccessToken> {
  const { appId, appSecret } = getConfig();
  const url =
    `https://api.weixin.qq.com/sns/oauth2/access_token` +
    `?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

  const res = await fetch(url);
  const json = (await res.json()) as {
    access_token?: string;
    openid?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (!json.access_token || !json.openid) {
    throw new Error(`WeChat token exchange failed: ${json.errmsg ?? "unknown error"}`);
  }

  return {
    openid: json.openid,
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 7200,
  };
}

/**
 * Fetch WeChat user profile using access_token + openid.
 */
export async function getWechatUserInfo(
  accessToken: string,
  openid: string
): Promise<WechatUserInfo> {
  const url =
    `https://api.weixin.qq.com/sns/userinfo` +
    `?access_token=${accessToken}&openid=${openid}&lang=zh_CN`;

  const res = await fetch(url);
  const json = (await res.json()) as {
    openid?: string;
    nickname?: string;
    headimgurl?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (!json.openid) {
    throw new Error(`WeChat userinfo failed: ${json.errmsg ?? "unknown error"}`);
  }

  return {
    openid: json.openid,
    nickname: json.nickname ?? "",
    headimgurl: json.headimgurl ?? "",
  };
}
