import { redis, REDIS_KEYS } from '@/lib/db/redis';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import type { ConnectedBot } from '@/types/bot';

/**
 * Guardar bot conectado en Redis
 */
export async function saveConnectedBot(bot: ConnectedBot): Promise<void> {
  // Encriptar tokens antes de guardar
  const botData = {
    ...bot,
    accessToken: encrypt(bot.accessToken),
    accessTokenSecret: encrypt(bot.accessTokenSecret),
  };

  await redis.set(REDIS_KEYS.BOT_CONNECTED, JSON.stringify(botData));
  console.log('✅ Bot saved to Redis:', bot.username);
}

/**
 * Obtener bot conectado desde Redis
 */
export async function getConnectedBot(): Promise<ConnectedBot | null> {
  const data = await redis.get(REDIS_KEYS.BOT_CONNECTED);

  if (!data) {
    return null;
  }

  // Upstash Redis puede devolver el valor como string o como objeto ya parseado
  const bot = (typeof data === 'string' ? JSON.parse(data) : data) as ConnectedBot;

  // Desencriptar tokens
  return {
    ...bot,
    accessToken: decrypt(bot.accessToken),
    accessTokenSecret: decrypt(bot.accessTokenSecret),
  };
}

/**
 * Eliminar bot conectado de Redis
 */
export async function deleteConnectedBot(): Promise<void> {
  await redis.del(REDIS_KEYS.BOT_CONNECTED);
  console.log('✅ Bot deleted from Redis');
}

/**
 * Verificar si hay un bot conectado
 */
export async function isBotConnected(): Promise<boolean> {
  const exists = await redis.exists(REDIS_KEYS.BOT_CONNECTED);
  return exists === 1;
}
