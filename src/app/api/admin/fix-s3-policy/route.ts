import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutBucketPolicyCommand, DeleteBucketCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

export async function GET(request: NextRequest) {
  try {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucketName = process.env.S3_BUCKET_NAME || 'pepesdog-uploads';

    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json({ error: 'AWS credentials not configured' }, { status: 500 });
    }

    const s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    // Apply public read policy to existing bucket
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

    console.log('Applying public read policy to bucket:', bucketName);

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy)
    }));

    return NextResponse.json({
      success: true,
      message: `Public read policy applied to bucket: ${bucketName}`,
      policy: bucketPolicy
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      error: error.message,
      code: error.Code
    }, { status: 500 });
  }
}