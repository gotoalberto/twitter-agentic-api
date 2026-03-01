import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * Validate Hivemind API key from request headers
 * Returns true if valid or no API key provided (for web access)
 * Returns error message if invalid API key is provided
 */
export async function validateHivemindApiKey(request: NextRequest): Promise<{ valid: boolean; error?: string }> {
  const apiKey = request.headers.get('x-api-key');

  // If no API key, allow access (for web interface)
  if (!apiKey) {
    return { valid: true };
  }

  // If API key is provided, it must be valid
  if (!apiKey.startsWith('hm_')) {
    return { valid: false, error: 'Invalid Hivemind API key format' };
  }

  // Verify Hivemind API key
  const hivemindConfig = await prisma.hivemindConfig.findFirst();
  if (!hivemindConfig || hivemindConfig.apiKey !== apiKey) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true };
}