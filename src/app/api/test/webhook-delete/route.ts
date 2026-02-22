/**
 * Test endpoint for webhook deletion
 *
 * This endpoint tests programmatic webhook deletion using Twitter API
 * Tests both v1.1 and v2 approaches
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('🧪 TEST: WEBHOOK DELETION');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Get parameters from request body
    const { twitterAppId, webhookId } = await request.json();

    if (!twitterAppId || !webhookId) {
      return NextResponse.json(
        { error: 'twitterAppId and webhookId are required' },
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
    console.log('   Webhook ID:', webhookId);
    console.log('   Webhook Env:', twitterApp.webhookEnv);
    console.log('   Has Consumer Key:', !!twitterApp.consumerKey);
    console.log('   Has Consumer Secret:', !!twitterApp.consumerSecret);
    console.log('   Has Bearer Token:', !!twitterApp.bearerToken);
    console.log('');

    // Test 1: List webhooks before deletion
    console.log('📋 TEST 1: List webhooks before deletion');
    console.log('================================================================================');

    let webhooksBeforeDeletion: any[] = [];
    if (twitterApp.bearerToken) {
      try {
        const { listWebhooks } = await import('@/lib/twitter/webhooks');
        webhooksBeforeDeletion = await listWebhooks(twitterApp.bearerToken);

        console.log(`✅ Found ${webhooksBeforeDeletion.length} webhook(s) before deletion:`);
        webhooksBeforeDeletion.forEach((webhook, index) => {
          console.log(`   [${index + 1}] ID: ${webhook.id}`);
          console.log(`       URL: ${webhook.url}`);
          console.log(`       Valid: ${webhook.valid}`);
          console.log(`       Match target: ${webhook.id === webhookId ? '✅ YES' : '❌ NO'}`);
        });
      } catch (error: any) {
        console.log('❌ Failed to list webhooks:', error.message);
      }
    } else {
      console.log('⚠️  No Bearer Token - cannot list existing webhooks');
    }
    console.log('');

    // Check if webhook exists
    const webhookExists = webhooksBeforeDeletion.some(w => w.id === webhookId);
    if (!webhookExists) {
      console.log('⚠️  WARNING: Webhook not found in current list');
      console.log('   Will attempt deletion anyway...');
      console.log('');
    }

    // Test 2: Attempt webhook deletion with v1.1 API
    console.log('📋 TEST 2: Delete webhook using v1.1 API');
    console.log('================================================================================');
    console.log('   Method: DELETE /1.1/account_activity/all/{env}/webhooks/{id}.json');
    console.log('   Auth: OAuth 1.0a (App-only)');
    console.log('   Environment:', twitterApp.webhookEnv);
    console.log('');

    let v1DeleteSuccess = false;
    let v1DeleteError = '';

    if (twitterApp.consumerKey && twitterApp.consumerSecret) {
      try {
        const apiUrl = `https://api.twitter.com/1.1/account_activity/all/${twitterApp.webhookEnv}/webhooks/${webhookId}.json`;

        // Generate OAuth 1.0a header for app-only auth
        const crypto = require('crypto');
        function generateOAuthHeader(
          method: string,
          url: string,
          consumerKey: string,
          consumerSecret: string
        ): string {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const nonce = crypto.randomBytes(32).toString('base64').replace(/\W/g, '');

          const oauthParams: Record<string, string> = {
            oauth_consumer_key: consumerKey,
            oauth_nonce: nonce,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: timestamp,
            oauth_version: '1.0',
          };

          // Generate signature
          const sortedParams = Object.keys(oauthParams)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
            .join('&');

          const signatureBase = [
            method.toUpperCase(),
            encodeURIComponent(url),
            encodeURIComponent(sortedParams),
          ].join('&');

          const signingKey = `${encodeURIComponent(consumerSecret)}&`;
          const hmac = crypto.createHmac('sha1', signingKey);
          hmac.update(signatureBase);
          const signature = hmac.digest('base64');

          oauthParams.oauth_signature = signature;

          return `OAuth ${Object.keys(oauthParams)
            .sort()
            .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
            .join(', ')}`;
        }

        const authHeader = generateOAuthHeader('DELETE', apiUrl, twitterApp.consumerKey, twitterApp.consumerSecret);

        console.log('🌐 Making v1.1 DELETE request...');
        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': authHeader,
          },
        });

        console.log('📡 Response:', response.status, response.statusText);

        if (response.status === 204 || response.ok) {
          v1DeleteSuccess = true;
          console.log('✅ Webhook deleted successfully via v1.1 API');
        } else {
          const errorText = await response.text();
          v1DeleteError = `${response.status}: ${errorText || response.statusText}`;
          console.log('❌ v1.1 deletion failed:', v1DeleteError);
        }
      } catch (error: any) {
        v1DeleteError = error.message;
        console.log('❌ v1.1 deletion error:', error.message);
      }
    } else {
      console.log('⚠️  No OAuth 1.0a credentials - skipping v1.1 test');
    }
    console.log('');

    // Test 3: Attempt webhook deletion with v2 API (if v1.1 failed)
    console.log('📋 TEST 3: Delete webhook using v2 API');
    console.log('================================================================================');
    console.log('   Method: DELETE /2/webhooks/{id}');
    console.log('   Auth: Bearer Token');
    console.log('');

    let v2DeleteSuccess = false;
    let v2DeleteError = '';

    if (!v1DeleteSuccess && twitterApp.bearerToken) {
      try {
        const apiUrl = `https://api.twitter.com/2/webhooks/${webhookId}`;

        console.log('🌐 Making v2 DELETE request...');
        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${twitterApp.bearerToken}`,
          },
        });

        console.log('📡 Response:', response.status, response.statusText);

        if (response.status === 204 || response.ok) {
          v2DeleteSuccess = true;
          console.log('✅ Webhook deleted successfully via v2 API');
        } else {
          const errorText = await response.text();
          v2DeleteError = `${response.status}: ${errorText || response.statusText}`;
          console.log('❌ v2 deletion failed:', v2DeleteError);
        }
      } catch (error: any) {
        v2DeleteError = error.message;
        console.log('❌ v2 deletion error:', error.message);
      }
    } else if (v1DeleteSuccess) {
      console.log('⏭️  Skipping v2 test (v1.1 already succeeded)');
    } else {
      console.log('⚠️  No Bearer Token - skipping v2 test');
    }
    console.log('');

    // Test 4: Verify deletion by listing webhooks again
    console.log('📋 TEST 4: Verify deletion');
    console.log('================================================================================');

    let webhooksAfterDeletion: any[] = [];
    if (twitterApp.bearerToken) {
      try {
        const { listWebhooks } = await import('@/lib/twitter/webhooks');
        webhooksAfterDeletion = await listWebhooks(twitterApp.bearerToken);

        console.log(`✅ Found ${webhooksAfterDeletion.length} webhook(s) after deletion:`);
        webhooksAfterDeletion.forEach((webhook, index) => {
          console.log(`   [${index + 1}] ID: ${webhook.id}`);
          console.log(`       URL: ${webhook.url}`);
        });

        const stillExists = webhooksAfterDeletion.some(w => w.id === webhookId);
        if (!stillExists && webhookExists) {
          console.log('');
          console.log('✅ WEBHOOK SUCCESSFULLY REMOVED FROM LIST');
        } else if (stillExists) {
          console.log('');
          console.log('⚠️  WEBHOOK STILL EXISTS IN LIST');
        }
      } catch (error: any) {
        console.log('❌ Failed to verify deletion:', error.message);
      }
    }
    console.log('');

    // Clean up database if deletion was successful
    if (v1DeleteSuccess || v2DeleteSuccess) {
      try {
        // Find and delete webhook registrations across all projects
        const deletedRecords = await prisma.webhookRegistration.deleteMany({
          where: {
            webhookId: webhookId
          }
        });
        if (deletedRecords.count > 0) {
          console.log(`💾 Removed ${deletedRecords.count} webhook registration(s) from database`);
        } else {
          console.log('ℹ️  No webhook registrations found in database for this webhook ID');
        }
      } catch (error: any) {
        console.log('⚠️  Failed to remove from database:', error.message);
      }
    }

    // Prepare response
    const success = v1DeleteSuccess || v2DeleteSuccess;
    const method = v1DeleteSuccess ? 'v1.1' : v2DeleteSuccess ? 'v2' : 'none';

    console.log('');
    console.log('================================================================================');
    console.log(success ? '✅ TEST COMPLETED SUCCESSFULLY' : '❌ TEST FAILED');
    console.log('================================================================================');
    console.log('');

    return NextResponse.json({
      success,
      method,
      webhookId,
      results: {
        v1: {
          attempted: !!twitterApp.consumerKey,
          success: v1DeleteSuccess,
          error: v1DeleteError
        },
        v2: {
          attempted: !v1DeleteSuccess && !!twitterApp.bearerToken,
          success: v2DeleteSuccess,
          error: v2DeleteError
        }
      },
      webhooks: {
        before: webhooksBeforeDeletion.length,
        after: webhooksAfterDeletion.length,
        targetFound: webhookExists,
        targetRemoved: webhookExists && !webhooksAfterDeletion.some(w => w.id === webhookId)
      },
      verification: {
        instruction: 'Check Twitter Developer Portal to confirm deletion',
        steps: [
          '1. Go to https://developer.twitter.com/en/portal/dashboard',
          `2. Select your app: ${twitterApp.name}`,
          '3. Navigate to "Webhooks" or "Account Activity API" section',
          `4. Webhook ID ${webhookId} should NOT be listed anymore`,
          '5. If still listed, manual deletion may be required'
        ]
      }
    });

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
    endpoint: '/api/test/webhook-delete',
    method: 'POST',
    description: 'Test webhook deletion programmatically',
    requiredParams: {
      twitterAppId: 'ID of the TwitterApp to use',
      webhookId: 'ID of the webhook to delete'
    },
    notes: [
      'Tests both v1.1 and v2 deletion methods',
      'v1.1 requires OAuth 1.0a credentials',
      'v2 requires Bearer Token',
      'Most apps need TAAS access for deletion to work'
    ]
  });
}