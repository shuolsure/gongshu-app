import { prisma } from './prisma';

const SECONDME_API_BASE_URL = process.env.SECONDME_API_BASE_URL || 'https://api.mindverse.com/gate/lab';
const SECONDME_TOKEN_ENDPOINT = process.env.SECONDME_TOKEN_ENDPOINT || 'https://api.mindverse.com/gate/lab/api/oauth/token/code';
const SECONDME_REFRESH_ENDPOINT = process.env.SECONDME_REFRESH_ENDPOINT || 'https://api.mindverse.com/gate/lab/api/oauth/token/refresh';

interface TokenResponse {
  code: number;
  data?: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
    scope?: string[];
  };
  message?: string;
}

interface UserInfoResponse {
  code: number;
  data?: {
    userId: string;
    name?: string;
    avatar?: string;
  };
  message?: string;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  console.log('Exchanging code for token...');
  console.log('Token endpoint:', SECONDME_TOKEN_ENDPOINT);
  console.log('Client ID:', process.env.SECONDME_CLIENT_ID?.substring(0, 8) + '...');
  console.log('Redirect URI:', process.env.SECONDME_REDIRECT_URI);
  
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

  const result = await response.json();
  console.log('Token response code:', result.code);
  return result;
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
  console.log('Getting user info...');
  console.log('API base URL:', SECONDME_API_BASE_URL);
  console.log('Access token prefix:', accessToken?.substring(0, 15) + '...');
  
  const response = await fetch(`${SECONDME_API_BASE_URL}/api/secondme/user/info`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const result = await response.json();
  console.log('User info response:', JSON.stringify(result).substring(0, 200));
  return result;
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
  if (result.code !== 0 || !result.data) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      tokenExpiresAt: new Date(Date.now() + result.data.expiresIn * 1000),
    },
  });

  return result.data.accessToken;
}