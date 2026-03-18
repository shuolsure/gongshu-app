import { NextResponse } from 'next/server';

export async function GET() {
  const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  
  // Clear all auth cookies
  response.cookies.delete('user_id');
  response.cookies.delete('secondme_user_id');

  return response;
}
