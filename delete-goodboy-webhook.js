/**
 * Eliminar webhook de goodboy
 */

const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAAHMn5wEAAAAARpCdThpwPZ1tNZiRP6OfowjCf7o=Go4WnMdCZKSP8p8TkmthUK2NNWbn5IwAgAyU1dGIcmkORMjeXq';
const WEBHOOK_ID = '1998684490214817792';

console.log('');
console.log('='.repeat(80));
console.log('🗑️  ELIMINANDO WEBHOOK DE GOODBOY');
console.log('='.repeat(80));
console.log('');
console.log('📍 Webhook ID:', WEBHOOK_ID);
console.log('');

(async () => {
  try {
    const response = await fetch(`https://api.twitter.com/2/webhooks/${WEBHOOK_ID}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    });

    console.log('📥 Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ ERROR:', error);

      try {
        const errorJson = JSON.parse(error);
        console.log('📦 Parsed Error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // Ignore
      }

      process.exit(1);
    }

    // DELETE puede devolver 204 No Content o 200
    if (response.status === 204) {
      console.log('✅ Webhook eliminado exitosamente (204 No Content)');
    } else {
      const data = await response.json();
      console.log('✅ Webhook eliminado exitosamente');
      console.log('📦 Response:', JSON.stringify(data, null, 2));
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ WEBHOOK DE GOODBOY ELIMINADO');
    console.log('='.repeat(80));
    console.log('');

  } catch (error) {
    console.log('❌ Exception:', error.message);
    console.log(error);
    process.exit(1);
  }
})();
