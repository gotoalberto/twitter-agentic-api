/**
 * Image Upload to S3 Endpoint
 *
 * Uploads images to AWS S3 and returns the public URL
 * Supports both project API keys and Hivemind API key
 *
 * POST /api/upload/image
 *
 * Headers:
 *   X-API-Key: <project_api_key or hivemind_api_key>
 *
 * Request body:
 * {
 *   "imageData": "data:image/jpeg;base64,..." // Base64 encoded image (data URL format)
 *   // OR
 *   "imageData": "/9j/4AAQ...", // Raw base64
 *   "imageMimeType": "image/jpeg" // Required if raw base64 (default: image/jpeg)
 *   "filename": "my-image.jpg" // Optional custom filename
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "url": "https://hivemind.s3.amazonaws.com/images/1234567890-image.jpg",
 *   "key": "images/1234567890-image.jpg"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getProjectByApiKey } from '@/lib/db/projects';
import { getHivemindConfig } from '@/lib/db/hivemind';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

interface UploadRequest {
  imageData: string;
  imageMimeType?: string;
  filename?: string;
}

// Initialize S3 client
function getS3Client() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured');
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// Generate a unique filename
function generateFilename(originalFilename?: string, mimeType: string = 'image/jpeg'): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');

  // Get extension from MIME type
  const extensions: { [key: string]: string } = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };

  const extension = extensions[mimeType] || 'jpg';

  if (originalFilename) {
    // Sanitize filename
    const sanitized = originalFilename
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `images/${timestamp}-${randomString}-${sanitized}`;
  }

  return `images/${timestamp}-${randomString}.${extension}`;
}

export async function POST(request: NextRequest) {
  try {
    console.log('================================================================================');
    console.log('📤 IMAGE UPLOAD REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Parse request body
    const body: UploadRequest = await request.json();

    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      console.log('❌ Missing API key');
      return NextResponse.json(
        { error: 'API key required - include X-API-Key header' },
        { status: 401 }
      );
    }

    // Validate API key (check if it's Hivemind or Project)
    let isAuthorized = false;
    let projectName: string | null = null;

    // Check if it's a Hivemind API key
    if (apiKey.startsWith('hm_')) {
      const hivemindConfig = await getHivemindConfig();
      if (hivemindConfig?.enabled && hivemindConfig.apiKey === apiKey) {
        isAuthorized = true;
        projectName = 'Hivemind';
        console.log('✅ Authorized via Hivemind API key');
      }
    } else {
      // Check if it's a project API key
      const project = await getProjectByApiKey(apiKey);
      if (project && project.apiEnabled) {
        isAuthorized = true;
        projectName = project.name;
        console.log(`✅ Authorized via project API key: ${project.name}`);
      }
    }

    if (!isAuthorized) {
      console.log('❌ Invalid API key');
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    console.log(`   Source: ${projectName}`);

    // Validate image data
    if (!body.imageData) {
      console.log('❌ Missing image data');
      return NextResponse.json(
        { error: 'imageData is required' },
        { status: 400 }
      );
    }

    // Extract base64 data and MIME type
    let base64Data: string;
    let mimeType: string;

    if (body.imageData.startsWith('data:')) {
      // Data URL format: data:image/png;base64,...
      const matches = body.imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        console.log('❌ Invalid data URL format');
        return NextResponse.json(
          { error: 'Invalid data URL format' },
          { status: 400 }
        );
      }
      mimeType = matches[1];
      base64Data = matches[2];
    } else {
      // Raw base64
      base64Data = body.imageData;
      mimeType = body.imageMimeType || 'image/jpeg';
    }

    console.log('   MIME type:', mimeType);

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      console.log('❌ Invalid MIME type:', mimeType);
      return NextResponse.json(
        { error: `Invalid image type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Convert base64 to Buffer
    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      console.log('❌ Failed to decode base64');
      return NextResponse.json(
        { error: 'Invalid base64 data' },
        { status: 400 }
      );
    }

    console.log('   Image size:', imageBuffer.length, 'bytes');

    // Check file size
    if (imageBuffer.length > MAX_FILE_SIZE) {
      console.log('❌ File too large:', imageBuffer.length, 'bytes (max:', MAX_FILE_SIZE, ')');
      return NextResponse.json(
        { error: `Image too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate filename
    const filename = generateFilename(body.filename, mimeType);
    console.log('   Generated filename:', filename);

    // Get S3 client
    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME || 'hivemind';

    // Check if bucket exists, create if it doesn't
    console.log('🔍 Checking if bucket exists:', bucketName);

    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      console.log('   ✅ Bucket exists');

      // Ensure bucket has public read policy
      console.log('   📝 Ensuring bucket has public read policy...');
      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${bucketName}/*`
          }
        ]
      };

      try {
        await s3Client.send(new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(bucketPolicy)
        }));
        console.log('   ✅ Bucket policy updated');
      } catch (policyError: any) {
        console.log('   ℹ️ Bucket policy already configured or cannot be updated');
      }
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404 || error.Code === 'NotFound') {
        console.log('   📦 Bucket does not exist, creating...');
        try {
          await s3Client.send(new CreateBucketCommand({
            Bucket: bucketName,
            // ACL removed as it may not be supported
          }));
          console.log('   ✅ Bucket created successfully');

          // Configure bucket policy for public read access
          console.log('   📝 Setting bucket policy for public access...');
          const bucketPolicy = {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicReadGetObject',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::${bucketName}/*`
              }
            ]
          };

          try {
            await s3Client.send(new PutBucketPolicyCommand({
              Bucket: bucketName,
              Policy: JSON.stringify(bucketPolicy)
            }));
            console.log('   ✅ Bucket policy configured for public access');
          } catch (policyError: any) {
            console.warn('   ⚠️ Could not set bucket policy:', policyError.message);
            // Continue anyway, the bucket was created
          }
        } catch (createError: any) {
          console.error('   ❌ Failed to create bucket:', createError.message);
          return NextResponse.json(
            { error: `Failed to create S3 bucket: ${createError.message}` },
            { status: 500 }
          );
        }
      } else if (error.Code === 'Forbidden' || error.$metadata?.httpStatusCode === 403) {
        console.error('   ❌ Access denied to bucket');
        return NextResponse.json(
          { error: 'Access denied to S3 bucket. Check permissions.' },
          { status: 500 }
        );
      } else {
        console.error('   ❌ Error checking bucket:', error.message);
        return NextResponse.json(
          { error: `S3 bucket error: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Upload to S3
    console.log('📤 Uploading to S3...');
    console.log('   Bucket:', bucketName);
    console.log('   Key:', filename);

    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: imageBuffer,
      ContentType: mimeType,
      // Add metadata
      Metadata: {
        'uploaded-by': projectName || 'unknown',
        'upload-timestamp': new Date().toISOString(),
      },
    });

    const startTime = Date.now();

    try {
      await s3Client.send(uploadCommand);
    } catch (error: any) {
      console.error('❌ S3 upload failed:', error.message);

      // Check if it's a permissions issue
      if (error.Code === 'AccessDenied') {
        return NextResponse.json(
          { error: 'S3 access denied. Check AWS credentials and bucket permissions.' },
          { status: 500 }
        );
      }

      // Check if bucket doesn't exist
      if (error.Code === 'NoSuchBucket') {
        return NextResponse.json(
          { error: `S3 bucket '${bucketName}' does not exist.` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: `Failed to upload image: ${error.message}` },
        { status: 500 }
      );
    }

    const uploadDuration = Date.now() - startTime;
    console.log(`   ✅ Upload successful (${uploadDuration}ms)`);

    // Generate public URL
    // Format: https://{bucket}.s3.{region}.amazonaws.com/{key}
    const region = process.env.AWS_REGION || 'us-east-1';
    const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${filename}`;

    console.log('   Public URL:', publicUrl);
    console.log('');
    console.log('✅ IMAGE UPLOAD COMPLETE');
    console.log('================================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key: filename,
    });

  } catch (error: any) {
    console.error('❌ IMAGE UPLOAD ERROR');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.log('================================================================================');
    console.log('');

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to upload image',
      },
      { status: 500 }
    );
  }
}