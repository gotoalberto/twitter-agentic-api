/**
 * Test endpoint for webhook registration using X API v2
 * Based on official X API documentation: https://docs.x.com/x-api/webhooks
 *
 * Uses POST /2/webhooks with Bearer Token authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('🧪 TEST: WEBHOOK REGISTRATION (X API v2)');
    console.log('================================================================================');
    console.log('   Documentation: https://docs.x.com/x-api/webhooks');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Get parameters from request body
    const { twitterAppId, customWebhookUrl } = await request.json();

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

    console.log('📋 Configuration:');
    console.log('   TwitterApp:', twitterApp.name);
    console.log('   Has Bearer Token:', !!twitterApp.bearerToken);
    console.log('   Has Consumer Secret:', !!twitterApp.consumerSecret);
    console.log('');

    // Check required credentials
    if (!twitterApp.bearerToken) {
      return NextResponse.json(
        {
          error: 'Bearer Token is required for X API v2 webhook registration',
          solution: 'Configure Bearer Token for this TwitterApp'
        },
        { status: 400 }
      );
    }

    if (!twitterApp.consumerSecret) {
      console.log('⚠️  Warning: Consumer Secret missing - CRC validation will fail');
      console.log('   The webhook will register but won\'t pass validation');
      console.log('');
    }

    // Generate webhook URL
    const webhookUrl = customWebhookUrl ||
      `${process.env.NEXTAUTH_URL || 'https://bitso-twitter-api.vercel.app'}/api/webhooks/twitter/${twitterApp.id}`;

    console.log('🌐 Webhook Configuration:');
    console.log('   URL:', webhookUrl);
    console.log('   Note: URL must be HTTPS and cannot include port numbers');
    console.log('');

    // Test 1: List existing webhooks first
    console.log('📋 STEP 1: List existing webhooks');
    console.log('================================================================================');
    console.log('   Endpoint: GET https://api.x.com/2/webhooks');
    console.log('');

    let existingWebhooks: any[] = [];
    try {
      const listResponse = await fetch('https://api.x.com/2/webhooks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${twitterApp.bearerToken}`,
        },
      });

      console.log('   Response:', listResponse.status, listResponse.statusText);

      if (listResponse.ok) {
        const data = await listResponse.json();
        existingWebhooks = data.data || [];

        console.log(`   ✅ Found ${existingWebhooks.length} existing webhook(s):`);
        existingWebhooks.forEach((webhook, index) => {
          console.log(`   [${index + 1}] ID: ${webhook.id}`);
          console.log(`       URL: ${webhook.url}`);
          console.log(`       Valid: ${webhook.valid}`);
          console.log(`       Created: ${webhook.created_at}`);
        });

        // Check if webhook already exists
        const existingWebhook = existingWebhooks.find(w => w.url === webhookUrl);
        if (existingWebhook) {
          console.log('');
          console.log('⚠️  Webhook with this URL already exists!');
          console.log('   ID:', existingWebhook.id);

          return NextResponse.json({
            success: false,
            alreadyExists: true,
            webhookId: existingWebhook.id,
            webhookUrl: existingWebhook.url,
            message: 'Webhook already registered with this URL',
            existingWebhooks,
            verification: {
              instruction: 'Check X Console to verify webhook',
              url: 'https://console.x.com/',
              steps: [
                'Go to https://console.x.com/',
                'Navigate to your app settings',
                'Check webhook configuration',
                `Webhook ${existingWebhook.id} should be listed`
              ]
            }
          });
        }
      } else {
        const errorText = await listResponse.text();
        console.log('   ❌ Failed to list webhooks:', errorText);
      }
    } catch (error: any) {
      console.log('   ❌ Error listing webhooks:', error.message);
    }
    console.log('');

    // Test 2: Register new webhook
    console.log('📋 STEP 2: Register new webhook');
    console.log('================================================================================');
    console.log('   Endpoint: POST https://api.x.com/2/webhooks');
    console.log('   Method: POST');
    console.log('   Auth: Bearer Token (OAuth2 App Only)');
    console.log('');

    const requestBody = {
      url: webhookUrl
    };

    console.log('   Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('');

    try {
      console.log('🚀 Sending registration request...');
      const registerResponse = await fetch('https://api.x.com/2/webhooks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${twitterApp.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Response:', registerResponse.status, registerResponse.statusText);
      console.log('');

      const responseText = await registerResponse.text();
      let responseData: any;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawResponse: responseText };
      }

      if (registerResponse.ok) {
        console.log('✅ WEBHOOK REGISTERED SUCCESSFULLY!');
        console.log('   Response:', JSON.stringify(responseData, null, 2));

        const webhookId = responseData.data?.id || responseData.id;
        const webhookUrl = responseData.data?.url || responseData.url;
        const valid = responseData.data?.valid || responseData.valid;

        console.log('');
        console.log('📊 Webhook Details:');
        console.log('   ID:', webhookId);
        console.log('   URL:', webhookUrl);
        console.log('   Valid:', valid);
        console.log('');

        // Test 3: Verify by listing again
        console.log('📋 STEP 3: Verify registration');
        console.log('================================================================================');

        try {
          const verifyResponse = await fetch('https://api.x.com/2/webhooks', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${twitterApp.bearerToken}`,
            },
          });

          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            const newWebhook = (verifyData.data || []).find((w: any) => w.id === webhookId);

            if (newWebhook) {
              console.log('✅ Webhook verified in API!');
              console.log('   Confirmed ID:', newWebhook.id);
              console.log('   Confirmed URL:', newWebhook.url);
            } else {
              console.log('⚠️  Webhook not found in verification (may need time to propagate)');
            }
          }
        } catch (error: any) {
          console.log('⚠️  Verification failed:', error.message);
        }

        console.log('');
        console.log('================================================================================');
        console.log('✅ TEST COMPLETED SUCCESSFULLY');
        console.log('================================================================================');
        console.log('');

        return NextResponse.json({
          success: true,
          webhookId,
          webhookUrl,
          valid,
          response: responseData,
          verification: {
            instruction: '🔍 PLEASE VERIFY in X Console',
            url: 'https://console.x.com/',
            steps: [
              '1. Go to https://console.x.com/',
              '2. Navigate to your app settings',
              '3. Check webhook configuration',
              `4. Verify webhook ID: ${webhookId}`,
              `5. Verify webhook URL: ${webhookUrl}`,
              '6. Check if status shows as "Valid"'
            ]
          }
        });

      } else {
        console.log('❌ WEBHOOK REGISTRATION FAILED');
        console.log('   Status:', registerResponse.status);
        console.log('   Response:', JSON.stringify(responseData, null, 2));
        console.log('');

        // Analyze error
        let errorAnalysis = '';
        let solution = '';

        if (registerResponse.status === 403) {
          errorAnalysis = 'Forbidden - Possible lack of webhook permissions';
          solution = 'Check app permissions in X Developer Console';
        } else if (registerResponse.status === 401) {
          errorAnalysis = 'Unauthorized - Invalid Bearer Token';
          solution = 'Regenerate Bearer Token in X Developer Console';
        } else if (registerResponse.status === 429) {
          errorAnalysis = 'Rate limit exceeded';
          solution = 'Wait and retry later';
        } else if (registerResponse.status === 400) {
          errorAnalysis = 'Bad Request - Invalid webhook URL or parameters';
          solution = 'Ensure URL is HTTPS, publicly accessible, and has no port number';
        }

        return NextResponse.json({
          success: false,
          error: `${registerResponse.status}: ${registerResponse.statusText}`,
          response: responseData,
          analysis: errorAnalysis,
          solution,
          existingWebhooks,
          verification: {
            instruction: 'Check X Console for current webhook status',
            url: 'https://console.x.com/',
          }
        }, { status: 500 });
      }

    } catch (error: any) {
      console.error('❌ Request failed:', error.message);
      return NextResponse.json({
        success: false,
        error: error.message,
        existingWebhooks,
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

// GET method to check endpoint status
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/webhook-v2-register',
    method: 'POST',
    description: 'Test webhook registration using X API v2',
    documentation: 'https://docs.x.com/x-api/webhooks',
    requiredParams: {
      twitterAppId: 'ID of the TwitterApp to use',
      customWebhookUrl: '(optional) Custom webhook URL to register'
    },
    requirements: [
      'Bearer Token (OAuth2 App Only) required',
      'Consumer Secret required for CRC validation',
      'Webhook URL must be HTTPS',
      'URL cannot include port numbers',
      'URL must be publicly accessible'
    ]
  });
}