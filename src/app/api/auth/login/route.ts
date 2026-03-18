import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.SECONDME_CLIENT_ID;
  const redirectUri = process.env.SECONDME_REDIRECT_URI;
  const oauthUrl = process.env.SECONDME_OAUTH_URL || 'https://go.second.me/oauth/';

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15);

  const authUrl = new URL(oauthUrl);
  authUrl.searchParams.set('client_id', clientId!);
  authUrl.searchParams.set('redirect_uri', redirectUri!);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'user.info user.info.softmemory chat agent_memory');

  const response = NextResponse.redirect(authUrl.toString());
  
  // Set state cookie for verification
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  return response;
}
