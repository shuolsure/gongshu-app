import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getUserInfo } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // 获取正确的域名
  const host = request.headers.get('host') || 'gongshu-app.vercel.app';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${protocol}://${host}`;

  if (error) {
    return NextResponse.redirect(new URL('/?error=' + error, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', baseUrl));
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
      console.error('Token exchange failed:', tokenResult);
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', baseUrl));
    }

    const { access_token, refresh_token, expires_in } = tokenResult.data;

    // Get user info
    const userResult = await getUserInfo(access_token);
    if (userResult.code !== 0) {
      console.error('Get user info failed:', userResult);
      return NextResponse.redirect(new URL('/?error=user_info_failed', baseUrl));
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
    const response = NextResponse.redirect(new URL('/', baseUrl));
    
    // 设置 cookie，添加 path 确保整个站点可访问
    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      secure: true, // Vercel 始终使用 HTTPS
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    response.cookies.set('secondme_user_id', userId, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    // Clear oauth_state cookie
    response.cookies.delete('oauth_state');

    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=auth_failed', baseUrl));
  }
}