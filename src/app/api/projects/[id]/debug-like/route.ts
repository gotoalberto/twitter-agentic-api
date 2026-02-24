/**
 * Debug endpoint for like functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db/projects';
import { getBotByProjectId } from '@/lib/db/bots';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const apiKey = request.headers.get('x-api-key');

    // Get project
    const project = await getProjectById(params.id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify API key
    if (project.apiKey !== apiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Get bot
    const bot = await getBotByProjectId(params.id);

    // Get TwitterApp
    const twitterApp = await getTwitterAppByProjectId(params.id);

    // Debug info
    const debugInfo = {
      project: {
        id: project.id,
        name: project.name,
        apiEnabled: project.apiEnabled,
        hasApiKey: !!project.apiKey,
      },
      bot: bot ? {
        id: bot.id,
        username: bot.username,
        userId: bot.userId,
        hasOAuth1Token: !!bot.accessToken,
        hasOAuth1Secret: !!bot.accessTokenSecret,
        hasOAuth2Token: !!bot.oauth2AccessToken,
        hasRefreshToken: !!bot.refreshToken,
        expiresAt: bot.expiresAt,
        isExpired: bot.expiresAt ? new Date() > new Date(bot.expiresAt) : null,
        scope: bot.scope,
      } : null,
      twitterApp: twitterApp ? {
        id: twitterApp.id,
        name: twitterApp.name,
        hasConsumerKey: !!twitterApp.consumerKey,
        hasConsumerSecret: !!twitterApp.consumerSecret,
        hasClientId: !!twitterApp.clientId,
        hasClientSecret: !!twitterApp.clientSecret,
        hasBearerToken: !!twitterApp.bearerToken,
      } : null,
    };

    return NextResponse.json(debugInfo);
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Debug failed' },
      { status: 500 }
    );
  }
}