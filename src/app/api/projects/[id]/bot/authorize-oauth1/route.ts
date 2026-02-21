import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterAppById } from '@/lib/db/twitter-apps';

/**
 * Force OAuth 1.0a authorization for bot connection
 * This bypasses OAuth 2.0 even if credentials are available
 * Needed for webhook subscriptions which require OAuth 1.0a
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    console.log('================================================================================');
    console.log('🔐 FORCE OAuth 1.0a Authorization for Bot Connection');
    console.log('================================================================================');
    console.log('Project ID:', projectId);

    // Get project
    const project = await getProjectById(projectId);
    if (!project) {
      console.error('❌ Project not found:', projectId);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log('📁 Project:', project.name);

    // Get TwitterApp
    const twitterApp = await getTwitterAppById(project.twitterAppId!);
    if (!twitterApp) {
      console.error('❌ No TwitterApp configured for project');
      return NextResponse.json(
        { error: 'No Twitter App configured for this project' },
        { status: 400 }
      );
    }

    console.log('🔑 Using TwitterApp:', twitterApp.name);

    // Check OAuth 1.0a credentials
    if (!twitterApp.consumerKey || !twitterApp.consumerSecret) {
      console.error('❌ TwitterApp missing OAuth 1.0a credentials');
      return NextResponse.json(
        { error: 'Twitter App does not have OAuth 1.0a credentials configured' },
        { status: 400 }
      );
    }

    console.log('✅ OAuth 1.0a credentials found');
    console.log('⚠️  FORCING OAuth 1.0a flow (bypassing OAuth 2.0 even if available)');

    // Build callback URL
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/bot-twitter/callback`;
    console.log('📍 Callback URL:', callbackUrl);

    // Initialize Twitter client with OAuth 1.0a credentials only
    const client = new TwitterApi({
      appKey: twitterApp.consumerKey,
      appSecret: twitterApp.consumerSecret,
    } as any);

    // Generate OAuth 1.0a auth link
    console.log('🔗 Generating OAuth 1.0a authorization link...');
    const authLink = await client.generateAuthLink(callbackUrl, {
      linkMode: 'authorize',
    });

    console.log('✅ OAuth 1.0a auth link generated successfully');
    console.log('   OAuth Token:', authLink.oauth_token);
    console.log('   Redirect URL:', authLink.url);

    // Store OAuth tokens and project info in cookies for callback
    const response = NextResponse.redirect(authLink.url);

    // Store temporary OAuth token secret
    response.cookies.set('oauth_token_secret', authLink.oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Store projectId and twitterAppId
    response.cookies.set('oauth_project_id', projectId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    response.cookies.set('oauth_twitter_app_id', twitterApp.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    // Set OAuth version flag to 1.0a
    response.cookies.set('oauth_version', '1.0a', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    console.log('🚀 Redirecting to Twitter for OAuth 1.0a authorization...');
    console.log('================================================================================\n');

    return response;

  } catch (error: any) {
    console.error('❌ Error in OAuth 1.0a authorization:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start OAuth 1.0a flow' },
      { status: 500 }
    );
  }
}