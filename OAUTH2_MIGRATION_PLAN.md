# Plan de Migración Completa a OAuth 2.0 (Sin OAuth 1.0a)

## 🎯 Objetivo
Migrar completamente de OAuth 1.0a a OAuth 2.0 para la integración con X API v2. **NO mantener OAuth 1.0a como backup**.

## 📚 Documentación de Referencia de X API

### OAuth 2.0 Overview
**URL:** https://docs.x.com/fundamentals/authentication/oauth-2-0/overview
- **Bearer Token (App-Only)**: Para lectura de datos públicos sin contexto de usuario
- **Authorization Code Flow with PKCE**: Para actuar en nombre de usuarios con control granular de scopes

### Application-Only Authentication (Bearer Token)
**URL:** https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only

**Capacidades:**
- ✅ Leer timelines de usuarios públicos
- ✅ Acceder a listas de friends/followers
- ✅ Buscar tweets
- ✅ Acceder a recursos de listas

**Limitaciones:**
- ❌ NO puede publicar tweets ("endpoints such as POST statuses/update will not function")
- ❌ NO puede buscar usuarios
- ❌ NO puede acceder a geolocalización
- ❌ NO puede leer DMs o credenciales de cuenta
- ❌ NO puede obtener emails de usuarios

**Generación de Bearer Token:**
1. Codificar credenciales: URL-encode consumer key + secret, concatenar con ":", Base64 encode
2. Intercambiar por token: POST a `/oauth2/token` con `grant_type=client_credentials`
3. Usar token: Incluir "Bearer <token>" en header Authorization

### Authorization Code with PKCE
**URL:** https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code

**Características:**
- Access tokens por defecto duran 2 horas
- Con scope `offline.access` se obtienen refresh tokens
- Sin `offline.access` NO hay refresh tokens
- Tokens pueden NO expirar según FAQ (documentación inconsistente)

### OAuth FAQ
**URL:** https://docs.x.com/fundamentals/authentication/faq#oauth-faq
- "Access tokens are not explicitly expired"
- Tokens solo se invalidan por revocación del usuario o suspensión de la app

## 🏗️ Arquitectura de OAuth 2.0 Propuesta

### Flujos de Autorización Actuales

El proyecto tiene **DOS flujos de autorización diferentes**:

1. **Hivemind Flow** (`/api/hivemind/*`): Conecta cuentas de usuarios regulares de Twitter para uso en Hivemind
   - Sin registro de webhooks
   - Almacena en tabla `HivemindUser`
   - Un usuario de Twitter por cada usuario del Hivemind

2. **Project Bot Flow** (`/api/projects/[id]/bot/*`): Conecta cuentas bot para proyectos
   - Requiere registro de webhooks
   - Almacena en tabla `Bot`
   - Una cuenta bot por proyecto

### Estrategia de Autenticación Dual

Necesitamos **DOS tipos de OAuth 2.0** para diferentes propósitos:

#### 1. **Authorization Code with PKCE** (Para Bots/Usuarios)
- **Uso:** Publicar tweets, enviar DMs, webhooks
- **Tokens:** Access token + Refresh token (con `offline.access`)
- **Duración:** ~2 horas (implementar refresh por precaución)
- **Scopes necesarios:**
  - `tweet.read` - Leer tweets
  - `tweet.write` - Publicar tweets
  - `users.read` - Leer información de usuarios
  - `dm.read` - Leer mensajes directos
  - `dm.write` - Enviar mensajes directos
  - `offline.access` - Obtener refresh tokens

#### 2. **Application-Only (Bearer Token)** (Para Operaciones de Lectura)
- **Uso:** Búsquedas, lecturas públicas, análisis
- **Tokens:** Bearer token de larga duración
- **Duración:** No expira (o muy larga)
- **Limitaciones:** Solo lectura, sin contexto de usuario

## 📋 Análisis del Estado Actual (OAuth 1.0a)

### Modelos que Usan OAuth 1.0a:
- `TwitterApp`: Almacena `consumerKey`, `consumerSecret`
- `Bot`: Almacena `accessToken`, `accessTokenSecret`
- `HivemindConfig`: Referencia a Bot con OAuth 1.0a

### Archivos que Implementan OAuth 1.0a:
- `/src/app/api/projects/[id]/bot/authorize/route.ts`
- `/src/app/api/auth/bot-twitter/callback/route.ts`
- `/src/app/api/hivemind/authorize/route.ts`
- `/src/app/api/hivemind/callback/route.ts`
- `/src/lib/twitter/webhooks.ts`

## 🔧 Plan de Implementación

### Fase 1: Actualización del Esquema de Base de Datos

#### 1.1 Actualizar modelo TwitterApp
```prisma
model TwitterApp {
  id             String  @id @default(cuid())
  name           String  @unique

  // OAuth 2.0 credentials (NUEVOS - REQUERIDOS)
  clientId       String  // OAuth 2.0 Client ID
  clientSecret   String  // OAuth 2.0 Client Secret

  // Bearer Token para App-Only auth
  bearerToken    String? // Generado desde clientId/clientSecret

  webhookEnv     String  @default("production")

  // ELIMINAR después de migración:
  // consumerKey    String
  // consumerSecret String
}
```

#### 1.2 Actualizar modelo Bot
```prisma
model Bot {
  id                String   @id @default(cuid())
  projectId         String   @unique
  username          String   @unique
  userId            String   @unique

  // OAuth 2.0 tokens (NUEVOS)
  accessToken       String   // OAuth 2.0 access token
  refreshToken      String?  // OAuth 2.0 refresh token (con offline.access)
  expiresAt         DateTime? // Token expiration (si aplica)
  scope             String   // OAuth 2.0 scopes otorgados

  // State para PKCE
  lastCodeVerifier  String?  // Para revalidación si es necesario

  // ELIMINAR después de migración:
  // accessTokenSecret String
}
```

### Fase 2: Implementación de OAuth 2.0

#### 2.1 Crear utilidades OAuth 2.0
**Archivo:** `/src/lib/twitter/oauth2.ts`

```typescript
// Funciones a implementar:
- generatePKCEChallenge() // Genera code_verifier y code_challenge
- generateState() // Genera state para seguridad
- buildAuthorizationUrl() // Construye URL de autorización con PKCE
- exchangeCodeForTokens() // Intercambia código por tokens
- refreshAccessToken() // Renueva access token con refresh token
- generateBearerToken() // Genera Bearer Token para App-Only
```

#### 2.2 Nuevas rutas de autorización OAuth 2.0

##### Para Proyectos:
- `/src/app/api/projects/[id]/bot/authorize/route.ts` (REEMPLAZAR)
- `/src/app/api/projects/[id]/bot/callback/route.ts` (NUEVO)

##### Para Hivemind:
- `/src/app/api/hivemind/authorize/route.ts` (REEMPLAZAR)
- `/src/app/api/hivemind/callback/route.ts` (REEMPLAZAR)

#### 2.3 Middleware de Auto-Refresh
**Archivo:** `/src/lib/twitter/token-refresh.ts`
- Detectar tokens expirados
- Refrescar automáticamente
- Actualizar en base de datos

### Fase 3: Actualización de Funciones Core

#### 3.1 Webhooks
- Actualizar `/src/lib/twitter/webhooks.ts`
- Usar Bearer Token para registro de webhooks
- Usar User tokens para suscripciones

#### 3.2 Tweet Publishing
- Actualizar `/src/app/api/twitter/tweet/route.ts`
- Usar OAuth 2.0 user tokens
- Implementar auto-refresh si falla

#### 3.3 Direct Messages
- Actualizar `/src/app/api/twitter/dm/route.ts`
- Usar OAuth 2.0 con scope `dm.write`

### Fase 4: Actualización de UI

#### 4.1 Formulario de Twitter Apps
- Cambiar campos de Consumer Key/Secret a Client ID/Secret
- Agregar botón para generar Bearer Token
- Instrucciones para configurar OAuth 2.0 en X Developer Portal

#### 4.2 Conexión de Bots
- Nuevo flujo OAuth 2.0 con PKCE
- Mostrar scopes solicitados
- Guardar refresh token

### Fase 5: Eliminación de OAuth 1.0a

#### 5.1 Eliminar código legacy
- Remover todas las referencias a `consumerKey`, `consumerSecret`
- Eliminar `accessTokenSecret` de modelos
- Quitar imports de OAuth 1.0a en TwitterApi

#### 5.2 Limpieza de base de datos
- Migration para eliminar columnas OAuth 1.0a
- Marcar todos los bots para re-autorización

### Fase 6: Testing y Despliegue

#### 6.1 Testing
- [ ] Flujo completo de autorización OAuth 2.0 con PKCE
- [ ] Refresh automático de tokens
- [ ] Bearer Token para operaciones de lectura
- [ ] Publicación de tweets con OAuth 2.0
- [ ] Webhooks con nueva autenticación
- [ ] DMs con scope apropiado

#### 6.2 Despliegue
1. Desplegar con soporte OAuth 2.0
2. Notificar usuarios para re-autorizar bots
3. Monitorear logs para errores
4. Eliminar código OAuth 1.0a cuando todos migren

## 📝 Variables de Entorno

### Eliminar completamente:
```
TWITTER_OAUTH_API_KEY        # OAuth 1.0a - ELIMINAR
TWITTER_OAUTH_API_SECRET     # OAuth 1.0a - ELIMINAR
```

### Mantener/Actualizar:
```
X_API_CLIENT_ID              # OAuth 2.0 Client ID (requerido)
X_API_CLIENT_SECRET          # OAuth 2.0 Client Secret (requerido)
X_API_REDIRECT_URI           # OAuth 2.0 Callback URL
```

## ⚠️ Consideraciones Críticas

### 1. **Dos Flujos OAuth 2.0 Necesarios**
- Authorization Code with PKCE para usuarios/bots
- Application-Only para operaciones de solo lectura

### 2. **Gestión de Tokens**
- Implementar refresh proactivo (antes de expiración)
- Guardar `expiresAt` aunque la documentación sea inconsistente
- Manejar errores 401 con retry usando refresh token

### 3. **Scopes Críticos**
- `offline.access` es OBLIGATORIO para refresh tokens
- Sin este scope, usuarios deben re-autorizar cada 2 horas

### 4. **PKCE es Obligatorio**
- X API requiere PKCE para Authorization Code flow
- Generar y almacenar code_verifier seguramente

### 5. **Sin Retrocompatibilidad**
- NO mantener OAuth 1.0a
- Forzar re-autorización de todos los bots

## 🚀 Orden de Implementación

1. **Crear utilidades OAuth 2.0** ⏳
2. **Actualizar esquema Prisma**
3. **Implementar Authorization Code with PKCE**
4. **Implementar Application-Only auth**
5. **Actualizar todas las rutas API**
6. **Modificar UI para OAuth 2.0**
7. **Testing exhaustivo**
8. **Desplegar con feature flag**
9. **Migrar usuarios progresivamente**
10. **Eliminar OAuth 1.0a completamente**

## 📊 Estimación de Tiempo

- Desarrollo: 3-4 días
- Testing: 1-2 días
- Migración usuarios: 2-3 días
- **Total**: ~1 semana

## ✅ Criterios de Éxito

- [ ] Todos los bots autorizados con OAuth 2.0
- [ ] Refresh tokens funcionando automáticamente
- [ ] Bearer tokens para operaciones de lectura
- [ ] Cero referencias a OAuth 1.0a en el código
- [ ] Webhooks funcionando con OAuth 2.0
- [ ] Publicación de tweets exitosa
- [ ] DMs funcionando con scopes apropiados
- [ ] Sin interrupciones para usuarios finales

## 🔍 Monitoreo Post-Migración

- Logs de errores 401 (tokens expirados)
- Tasa de éxito de refresh tokens
- Usuarios que requieren re-autorización
- Latencia de operaciones con nuevo auth
- Webhooks perdidos o fallidos

---

**Última actualización:** 2026-02-21
**Estado:** Listo para implementación