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

  console.log('OAuth callback received');
  console.log('Host:', host);
  console.log('Code:', code?.substring(0, 20) + '...');
  console.log('Error:', error);

  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(new URL('/?error=' + error, baseUrl));
  }

  if (!code) {
    console.error('No code received');
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
    if (tokenResult.code !== 0 || !tokenResult.data) {
      console.error('Token exchange failed:', JSON.stringify(tokenResult));
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', baseUrl));
    }

    const { accessToken, refreshToken, expiresIn } = tokenResult.data;
    console.log('Token exchange successful, expires in:', expiresIn);

    // Get user info
    const userResult = await getUserInfo(accessToken);
    if (userResult.code !== 0 || !userResult.data) {
      console.error('Get user info failed:', JSON.stringify(userResult));
      return NextResponse.redirect(new URL('/?error=user_info_failed', baseUrl));
    }

    const { userId, name, avatar } = userResult.data;
    console.log('User info retrieved:', userId, name);

    // Create or update user in database
    const user = await prisma.user.upsert({
      where: { secondmeUserId: userId },
      update: {
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        name: name || null,
        avatar: avatar || null,
      },
      create: {
        secondmeUserId: userId,
        name: name || null,
        avatar: avatar || null,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    console.log('User saved to database:', user.id);

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

    console.log('Login successful, cookies set');
    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=auth_failed', baseUrl));
  }
}
