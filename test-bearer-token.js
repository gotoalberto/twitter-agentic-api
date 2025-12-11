/**
 * Script de prueba local para verificar el Bearer Token
 * Reproduce el comportamiento de la app en producción
 */

// Cargar variables de entorno del archivo .env.production.local
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env.production.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2];

      // Remove quotes if present (but keep content as-is)
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  });
}

loadEnv();

// Función cleanEnvVar del proyecto
function cleanEnvVar(value) {
  if (!value) return '';
  // Remove leading/trailing quotes (both single and double)
  // Trim all whitespace including newlines, tabs, etc.
  return value.replace(/^["']|["']$/g, '').trim();
}

console.log('');
console.log('='.repeat(80));
console.log('🔍 VERIFICACIÓN DE BEARER TOKEN');
console.log('='.repeat(80));
console.log('');

// 1. Obtener token RAW (como viene de .env)
const rawToken = process.env.X_API_BEARER_TOKEN;
console.log('📋 Token RAW (primeros 50 chars):', rawToken?.substring(0, 50));
console.log('📋 Token RAW (últimos 20 chars):', rawToken?.substring(rawToken.length - 20));
console.log('📋 Token RAW length:', rawToken?.length);
console.log('');

// 2. Verificar caracteres especiales al final
const lastChars = rawToken?.substring(rawToken.length - 5);
console.log('🔎 Últimos 5 caracteres (bytes):');
for (let i = 0; i < (lastChars?.length || 0); i++) {
  const char = lastChars[i];
  const code = char.charCodeAt(0);
  console.log(`   [${i}] '${char}' (code: ${code}, hex: 0x${code.toString(16)})`);
}
console.log('');

// 3. Aplicar cleanEnvVar
const cleanedToken = cleanEnvVar(rawToken);
console.log('✨ Token CLEANED (primeros 50 chars):', cleanedToken?.substring(0, 50));
console.log('✨ Token CLEANED (últimos 20 chars):', cleanedToken?.substring(cleanedToken.length - 20));
console.log('✨ Token CLEANED length:', cleanedToken?.length);
console.log('');

// 4. Comparar
console.log('📊 Comparación:');
console.log('   ¿Son iguales?', rawToken === cleanedToken ? '✅ Sí' : '❌ No');
console.log('   Diferencia de longitud:', (rawToken?.length || 0) - (cleanedToken?.length || 0));
console.log('');

// 5. Test 1: Probar con API v1.1 (como nuestra app actual)
console.log('='.repeat(80));
console.log('🧪 TEST 1: Twitter API v1.1 (Actual)');
console.log('='.repeat(80));
console.log('');

async function testV1APIRaw() {
  console.log('1️⃣ Probando con token RAW (sin limpiar)...');
  const url = 'https://api.twitter.com/1.1/account_activity/all/production/webhooks.json';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${rawToken}`,
      },
    });

    console.log('   Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('   Error:', error);
    } else {
      const data = await response.json();
      console.log('   ✅ SUCCESS!');
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
  }
  console.log('');
}

async function testV1APICleaned() {
  console.log('2️⃣ Probando con token CLEANED (con trim)...');
  const url = 'https://api.twitter.com/1.1/account_activity/all/production/webhooks.json';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanedToken}`,
      },
    });

    console.log('   Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('   Error:', error);
    } else {
      const data = await response.json();
      console.log('   ✅ SUCCESS!');
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
  }
  console.log('');
}

// 6. Test 2: Probar con API v2 (como goodboy)
async function testV2APIRaw() {
  console.log('='.repeat(80));
  console.log('🧪 TEST 2: Twitter API v2 (Goodboy)');
  console.log('='.repeat(80));
  console.log('');

  console.log('3️⃣ Probando con token RAW en API v2...');
  const url = 'https://api.twitter.com/2/webhooks';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${rawToken}`,
      },
    });

    console.log('   Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('   Error:', error);
    } else {
      const data = await response.json();
      console.log('   ✅ SUCCESS!');
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
  }
  console.log('');
}

async function testV2APICleaned() {
  console.log('4️⃣ Probando con token CLEANED en API v2...');
  const url = 'https://api.twitter.com/2/webhooks';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanedToken}`,
      },
    });

    console.log('   Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('   Error:', error);
    } else {
      const data = await response.json();
      console.log('   ✅ SUCCESS!');
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
  }
  console.log('');
}

// Ejecutar tests
(async () => {
  await testV1APIRaw();
  await testV1APICleaned();
  await testV2APIRaw();
  await testV2APICleaned();

  console.log('='.repeat(80));
  console.log('✅ TESTS COMPLETADOS');
  console.log('='.repeat(80));
})();
