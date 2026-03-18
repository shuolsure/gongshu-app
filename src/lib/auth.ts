import { prisma } from './prisma';

const SECONDME_API_BASE_URL = process.env.SECONDME_API_BASE_URL || 'https://api.mindverse.com/gate/lab';
const SECONDME_TOKEN_ENDPOINT = process.env.SECONDME_TOKEN_ENDPOINT || 'https://api.mindverse.com/gate/lab/api/oauth/token/code';
const SECONDME_REFRESH_ENDPOINT = process.env.SECONDME_REFRESH_ENDPOINT || 'https://api.mindverse.com/gate/lab/api/oauth/token/refresh';

interface TokenResponse {
  code: number;
  data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

interface UserInfoResponse {
  code: number;
  data: {
    userId: string;
    name?: string;
    avatar?: string;
  };
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const response = await fetch(SECONDME_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.SECONDME_CLIENT_ID!,
      client_secret: process.env.SECONDME_CLIENT_SECRET!,
      redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    }),
  });

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(SECONDME_REFRESH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SECONDME_CLIENT_ID!,
      client_secret: process.env.SECONDME_CLIENT_SECRET!,
    }),
  });

  return response.json();
}

export async function getUserInfo(accessToken: string): Promise<UserInfoResponse> {
  const response = await fetch(`${SECONDME_API_BASE_URL}/api/secondme/user/info`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.json();
}

export async function getValidToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { secondmeUserId: userId },
  });

  if (!user) return null;

  if (user.tokenExpiresAt > new Date()) {
    return user.accessToken;
  }

  // Token expired, try to refresh
  const result = await refreshAccessToken(user.refreshToken);
  if (result.code !== 0) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      accessToken: result.data.access_token,
      refreshToken: result.data.refresh_token,
      tokenExpiresAt: new Date(Date.now() + result.data.expires_in * 1000),
    },
  });

  return result.data.access_token;
}
