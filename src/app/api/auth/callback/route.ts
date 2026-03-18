import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getUserInfo } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/?error=' + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  // Verify state (with fallback for WebView scenarios)
  const storedState = request.cookies.get('oauth_state')?.value;
  if (storedState && state !== storedState) {
    console.warn('OAuth state mismatch, possibly WebView scenario');
  }

  try {
    // Exchange code for token
    const tokenResult = await exchangeCodeForToken(code);
    if (tokenResult.code !== 0) {
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }

    const { access_token, refresh_token, expires_in } = tokenResult.data;

    // Get user info
    const userResult = await getUserInfo(access_token);
    if (userResult.code !== 0) {
      return NextResponse.redirect(new URL('/?error=user_info_failed', request.url));
    }

    const { userId, name, avatar } = userResult.data;

    // Create or update user in database
    const user = await prisma.user.upsert({
      where: { secondmeUserId: userId },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        name: name || null,
        avatar: avatar || null,
      },
      create: {
        secondmeUserId: userId,
        name: name || null,
        avatar: avatar || null,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });

    // Create response with session cookie
    const response = NextResponse.redirect(new URL('/', request.url));
    
    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    response.cookies.set('secondme_user_id', userId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    // Clear oauth_state cookie
    response.cookies.delete('oauth_state');

    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}
