/**
 * Test endpoint for webhook registration
 *
 * This endpoint tests programmatic webhook registration using Twitter API v1.1
 * Requires TAAS access (most new apps don't have this)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { registerWebhook } from '@/lib/twitter/webhooks';

export async function POST(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('🧪 TEST: WEBHOOK REGISTRATION');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Get the TwitterApp ID from request body
    const { twitterAppId, webhookUrl } = await request.json();

    if (!twitterAppId) {
      return NextResponse.json(
        { error: 'twitterAppId is required' },
        { status: 400 }
      );
    }

    // Get the TwitterApp
    const twitterApp = await prisma.twitterApp.findUnique({
      where: { id: twitterAppId }
    });

    if (!twitterApp) {
      return NextResponse.json(
        { error: 'TwitterApp not found' },
        { status: 404 }
      );
    }

    console.log('📋 Test Configuration:');
    console.log('   TwitterApp:', twitterApp.name);
    console.log('   Webhook Env:', twitterApp.webhookEnv);
    console.log('   Has Consumer Key:', !!twitterApp.consumerKey);
    console.log('   Has Consumer Secret:', !!twitterApp.consumerSecret);
    console.log('   Has Bearer Token:', !!twitterApp.bearerToken);
    console.log('');

    // Check credentials
    if (!twitterApp.consumerKey || !twitterApp.consumerSecret) {
      return NextResponse.json(
        {
          error: 'TwitterApp missing OAuth 1.0a credentials',
          details: 'Consumer Key and Consumer Secret are required for webhook registration'
        },
        { status: 400 }
      );
    }

    // Generate webhook URL if not provided
    const finalWebhookUrl = webhookUrl ||
      `${process.env.NEXTAUTH_URL || 'https://bitso-twitter-api.vercel.app'}/api/webhooks/twitter/${twitterApp.id}`;

    console.log('🌐 Webhook URL to register:', finalWebhookUrl);
    console.log('');

    // Test 1: List existing webhooks
    console.log('📋 TEST 1: List existing webhooks');
    console.log('================================================================================');

    let existingWebhooks: any[] = [];
    if (twitterApp.bearerToken) {
      try {
        const { listWebhooks } = await import('@/lib/twitter/webhooks');
        existingWebhooks = await listWebhooks(twitterApp.bearerToken);

        console.log(`✅ Found ${existingWebhooks.length} existing webhook(s):`);
        existingWebhooks.forEach((webhook, index) => {
          console.log(`   [${index + 1}] ID: ${webhook.id}`);
          console.log(`       URL: ${webhook.url}`);
          console.log(`       Valid: ${webhook.valid}`);
          console.log(`       Created: ${webhook.created_at}`);
        });
      } catch (error: any) {
        console.log('❌ Failed to list webhooks:', error.message);
      }
    } else {
      console.log('⚠️  No Bearer Token - cannot list existing webhooks');
    }
    console.log('');

    // Test 2: Attempt webhook registration
    console.log('📋 TEST 2: Register new webhook');
    console.log('================================================================================');
    console.log('   Method: POST /1.1/account_activity/all/{env}/webhooks.json');
    console.log('   Auth: OAuth 1.0a (App-only)');
    console.log('   Environment:', twitterApp.webhookEnv);
    console.log('');

    try {
      const result = await registerWebhook(
        finalWebhookUrl,
        twitterApp.consumerKey,
        twitterApp.consumerSecret,
        twitterApp.webhookEnv,
        twitterApp.bearerToken || undefined
      );

      console.log('✅ WEBHOOK REGISTRATION SUCCESSFUL!');
      console.log('   Webhook ID:', result.webhookId);
      console.log('   Webhook URL:', result.url);
      console.log('');

      // Save to database - need to find a project that uses this TwitterApp
      // For testing, we'll just log that we would save it
      console.log('💾 Would save to database (requires project selection):');
      console.log('   Webhook ID:', result.webhookId);
      console.log('   Webhook URL:', result.url);
      console.log('   Note: WebhookRegistration requires a projectId');
      console.log('   To save, you need to associate this with a specific project');
      console.log('');

      // Test 3: Verify registration by listing webhooks again
      console.log('📋 TEST 3: Verify registration');
      console.log('================================================================================');

      if (twitterApp.bearerToken) {
        try {
          const { listWebhooks } = await import('@/lib/twitter/webhooks');
          const updatedWebhooks = await listWebhooks(twitterApp.bearerToken);

          const newWebhook = updatedWebhooks.find(w => w.id === result.webhookId);
          if (newWebhook) {
            console.log('✅ Webhook verified in Twitter API:');
            console.log('   ID:', newWebhook.id);
            console.log('   URL:', newWebhook.url);
            console.log('   Valid:', (newWebhook as any).valid || 'N/A');
          } else {
            console.log('⚠️  Webhook not found in list (may take time to propagate)');
          }
        } catch (error: any) {
          console.log('❌ Failed to verify webhook:', error.message);
        }
      }

      console.log('');
      console.log('================================================================================');
      console.log('✅ TEST COMPLETED SUCCESSFULLY');
      console.log('================================================================================');
      console.log('');

      return NextResponse.json({
        success: true,
        webhookId: result.webhookId,
        webhookUrl: result.url,
        verification: {
          instruction: 'Check Twitter Developer Portal',
          steps: [
            '1. Go to https://developer.twitter.com/en/portal/dashboard',
            `2. Select your app: ${twitterApp.name}`,
            '3. Navigate to "Webhooks" or "Account Activity API" section',
            '4. You should see the new webhook listed there',
            `5. Webhook ID: ${result.webhookId}`,
            `6. Webhook URL: ${result.url}`
          ]
        }
      });

    } catch (error: any) {
      console.error('❌ WEBHOOK REGISTRATION FAILED');
      console.error('   Error:', error.message);
      console.error('');

      // Common error scenarios
      let errorAnalysis = '';
      let solution = '';

      if (error.message?.includes('403')) {
        errorAnalysis = 'App lacks TAAS (Twitter Ads API Suite) access';
        solution = 'Most new apps cannot register webhooks programmatically. Use manual registration in Twitter Developer Portal.';
      } else if (error.message?.includes('401')) {
        errorAnalysis = 'Authentication failed';
        solution = 'Check that Consumer Key and Consumer Secret are correct.';
      } else if (error.message?.includes('429')) {
        errorAnalysis = 'Rate limit exceeded';
        solution = 'Wait a few minutes and try again.';
      } else if (error.message?.includes('already exists')) {
        errorAnalysis = 'Webhook already registered';
        solution = 'Use the existing webhook or delete it first.';
      }

      console.log('📋 ERROR ANALYSIS');
      console.log('================================================================================');
      if (errorAnalysis) {
        console.log('   Diagnosis:', errorAnalysis);
        console.log('   Solution:', solution);
      }
      console.log('');

      return NextResponse.json({
        success: false,
        error: error.message,
        analysis: errorAnalysis,
        solution,
        existingWebhooks,
        verification: {
          instruction: 'Check Twitter Developer Portal to see current webhooks',
          steps: [
            '1. Go to https://developer.twitter.com/en/portal/dashboard',
            `2. Select your app: ${twitterApp.name}`,
            '3. Navigate to "Webhooks" or "Account Activity API" section',
            '4. Check if any webhooks are listed there'
          ]
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Test endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Test failed' },
      { status: 500 }
    );
  }
}

// GET method to check test endpoint status
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/webhook-register',
    method: 'POST',
    description: 'Test webhook registration programmatically',
    requiredParams: {
      twitterAppId: 'ID of the TwitterApp to use',
      webhookUrl: '(optional) Custom webhook URL to register'
    },
    note: 'Most apps require TAAS access for this to work'
  });
}