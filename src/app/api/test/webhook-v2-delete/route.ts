/**
 * Test endpoint for webhook deletion using X API v2
 * Based on official X API documentation: https://docs.x.com/x-api/webhooks
 *
 * Uses DELETE /2/webhooks/:webhook_id with Bearer Token authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('🧪 TEST: WEBHOOK DELETION (X API v2)');
    console.log('================================================================================');
    console.log('   Documentation: https://docs.x.com/x-api/webhooks');
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

    console.log('📋 Configuration:');
    console.log('   TwitterApp:', twitterApp.name);
    console.log('   Webhook ID to delete:', webhookId);
    console.log('   Has Bearer Token:', !!twitterApp.bearerToken);
    console.log('');

    // Check required credentials
    if (!twitterApp.bearerToken) {
      return NextResponse.json(
        {
          error: 'Bearer Token is required for X API v2 webhook deletion',
          solution: 'Configure Bearer Token for this TwitterApp'
        },
        { status: 400 }
      );
    }

    // Step 1: List webhooks before deletion
    console.log('📋 STEP 1: List webhooks before deletion');
    console.log('================================================================================');
    console.log('   Endpoint: GET https://api.x.com/2/webhooks');
    console.log('');

    let webhooksBeforeDeletion: any[] = [];
    let targetWebhookExists = false;

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
        webhooksBeforeDeletion = data.data || [];

        console.log(`   ✅ Found ${webhooksBeforeDeletion.length} webhook(s) before deletion:`);
        webhooksBeforeDeletion.forEach((webhook, index) => {
          const isTarget = webhook.id === webhookId;
          console.log(`   [${index + 1}] ID: ${webhook.id} ${isTarget ? '← TARGET' : ''}`);
          console.log(`       URL: ${webhook.url}`);
          console.log(`       Valid: ${webhook.valid}`);
          if (isTarget) {
            targetWebhookExists = true;
          }
        });

        if (!targetWebhookExists) {
          console.log('');
          console.log('⚠️  WARNING: Target webhook not found in current list');
          console.log('   Will attempt deletion anyway...');
        }
      } else {
        const errorText = await listResponse.text();
        console.log('   ❌ Failed to list webhooks:', errorText);
      }
    } catch (error: any) {
      console.log('   ❌ Error listing webhooks:', error.message);
    }
    console.log('');

    // Step 2: Delete the webhook
    console.log('📋 STEP 2: Delete webhook');
    console.log('================================================================================');
    console.log(`   Endpoint: DELETE https://api.x.com/2/webhooks/${webhookId}`);
    console.log('   Method: DELETE');
    console.log('   Auth: Bearer Token (OAuth2 App Only)');
    console.log('');

    try {
      console.log('🚀 Sending deletion request...');
      const deleteResponse = await fetch(`https://api.x.com/2/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${twitterApp.bearerToken}`,
        },
      });

      console.log('📡 Response:', deleteResponse.status, deleteResponse.statusText);
      console.log('');

      let responseData: any = null;
      if (deleteResponse.status !== 204) {
        const responseText = await deleteResponse.text();
        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = { rawResponse: responseText };
          }
        }
      }

      const isSuccess = deleteResponse.ok || deleteResponse.status === 204;

      if (isSuccess) {
        console.log('✅ WEBHOOK DELETED SUCCESSFULLY!');
        if (responseData) {
          console.log('   Response:', JSON.stringify(responseData, null, 2));
        } else {
          console.log('   Response: 204 No Content (standard success response)');
        }
        console.log('');

        // Step 3: Verify deletion by listing again
        console.log('📋 STEP 3: Verify deletion');
        console.log('================================================================================');

        let webhooksAfterDeletion: any[] = [];
        let stillExists = false;

        try {
          const verifyResponse = await fetch('https://api.x.com/2/webhooks', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${twitterApp.bearerToken}`,
            },
          });

          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            webhooksAfterDeletion = verifyData.data || [];

            console.log(`   ✅ Found ${webhooksAfterDeletion.length} webhook(s) after deletion:`);
            webhooksAfterDeletion.forEach((webhook, index) => {
              console.log(`   [${index + 1}] ID: ${webhook.id}`);
              console.log(`       URL: ${webhook.url}`);
              if (webhook.id === webhookId) {
                stillExists = true;
                console.log('       ⚠️  TARGET WEBHOOK STILL EXISTS!');
              }
            });

            if (!stillExists && targetWebhookExists) {
              console.log('');
              console.log('✅ CONFIRMED: Webhook successfully removed from list');
            } else if (stillExists) {
              console.log('');
              console.log('⚠️  WARNING: Webhook still appears in list (may need time to propagate)');
            }
          }
        } catch (error: any) {
          console.log('⚠️  Verification failed:', error.message);
        }

        // Clean up database records
        try {
          const deletedRecords = await prisma.webhookRegistration.deleteMany({
            where: { webhookId: webhookId }
          });
          if (deletedRecords.count > 0) {
            console.log(`💾 Removed ${deletedRecords.count} webhook registration(s) from database`);
          }
        } catch (error: any) {
          console.log('⚠️  Database cleanup failed:', error.message);
        }

        console.log('');
        console.log('================================================================================');
        console.log('✅ TEST COMPLETED SUCCESSFULLY');
        console.log('================================================================================');
        console.log('');

        return NextResponse.json({
          success: true,
          webhookId,
          webhooksBefore: webhooksBeforeDeletion.length,
          webhooksAfter: webhooksAfterDeletion.length,
          targetExistedBefore: targetWebhookExists,
          targetRemovedSuccessfully: targetWebhookExists && !stillExists,
          verification: {
            instruction: '🔍 PLEASE VERIFY in X Console',
            url: 'https://console.x.com/',
            steps: [
              '1. Go to https://console.x.com/',
              '2. Navigate to your app settings',
              '3. Check webhook configuration',
              `4. Webhook ID ${webhookId} should NOT be listed anymore`,
              '5. Confirm the webhook has been removed'
            ]
          }
        });

      } else {
        console.log('❌ WEBHOOK DELETION FAILED');
        console.log('   Status:', deleteResponse.status);
        if (responseData) {
          console.log('   Response:', JSON.stringify(responseData, null, 2));
        }
        console.log('');

        // Analyze error
        let errorAnalysis = '';
        let solution = '';

        if (deleteResponse.status === 404) {
          errorAnalysis = 'Not Found - Webhook does not exist';
          solution = 'Verify the webhook ID is correct';
        } else if (deleteResponse.status === 403) {
          errorAnalysis = 'Forbidden - No permission to delete this webhook';
          solution = 'Check if this webhook belongs to your app';
        } else if (deleteResponse.status === 401) {
          errorAnalysis = 'Unauthorized - Invalid Bearer Token';
          solution = 'Regenerate Bearer Token in X Developer Console';
        } else if (deleteResponse.status === 429) {
          errorAnalysis = 'Rate limit exceeded';
          solution = 'Wait and retry later';
        }

        return NextResponse.json({
          success: false,
          error: `${deleteResponse.status}: ${deleteResponse.statusText}`,
          response: responseData,
          analysis: errorAnalysis,
          solution,
          webhooksBefore: webhooksBeforeDeletion.length,
          targetExistedBefore: targetWebhookExists,
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
        webhooksBefore: webhooksBeforeDeletion.length,
        targetExistedBefore: targetWebhookExists,
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
    endpoint: '/api/test/webhook-v2-delete',
    method: 'POST',
    description: 'Test webhook deletion using X API v2',
    documentation: 'https://docs.x.com/x-api/webhooks',
    requiredParams: {
      twitterAppId: 'ID of the TwitterApp to use',
      webhookId: 'ID of the webhook to delete'
    },
    requirements: [
      'Bearer Token (OAuth2 App Only) required',
      'Valid webhook ID',
      'Webhook must belong to your app'
    ]
  });
}