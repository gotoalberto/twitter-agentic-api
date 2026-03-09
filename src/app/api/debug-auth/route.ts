import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
    X_API_CLIENT_ID: process.env.X_API_CLIENT_ID ? process.env.X_API_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET',
    X_API_CLIENT_SECRET: process.env.X_API_CLIENT_SECRET ? 'SET (length=' + process.env.X_API_CLIENT_SECRET.length + ')' : 'NOT SET',
    X_API_REDIRECT_URI: process.env.X_API_REDIRECT_URI || 'NOT SET',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET (length=' + process.env.NEXTAUTH_SECRET.length + ')' : 'NOT SET',
  });
}
