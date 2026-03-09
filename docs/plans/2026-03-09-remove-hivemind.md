# Remove Hivemind Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar completamente la funcionalidad Hivemind (páginas, API routes, DB tables, componentes) y convertir la index page en un redirect simple a /admin.

**Architecture:** Borrado quirúrgico archivo por archivo. Primero DB (migración SQL), luego schema Prisma, luego API routes, luego páginas/componentes, finalmente index page. Projects y dashboard admin se conservan intactos.

**Tech Stack:** Next.js 15 App Router, Prisma 6, PostgreSQL (RDS eu-west-1), TypeScript

---

### Task 1: Drop hivemind tables from DB

**Files:**
- Create: `prisma/migrations/drop_hivemind/migration.sql`

**Step 1: Conectar a la DB y verificar tablas existentes**

```bash
psql "postgresql://xbotadmin:9ctRoXzA6ITaGEBNUaiOJo0odTTv0jzx@xbot-postgres.c9couagskvi4.eu-west-1.rds.amazonaws.com:5432/xbot?search_path=agentic-twitter-api" -c "\dt"
```

**Step 2: Crear el script SQL de drop**

Crear `/tmp/twitter-agentic-api/prisma/migrations/drop_hivemind/migration.sql`:

```sql
-- Drop hivemind tables in correct order (FK dependencies first)
ALTER TABLE IF EXISTS "rate_limits" DROP COLUMN IF EXISTS "hivemind_user_id";

DROP TABLE IF EXISTS "hivemind_raids" CASCADE;
DROP TABLE IF EXISTS "hivemind_actions" CASCADE;
DROP TABLE IF EXISTS "hivemind_users" CASCADE;
DROP TABLE IF EXISTS "hivemind_config" CASCADE;
```

**Step 3: Ejecutar la migración**

```bash
psql "postgresql://xbotadmin:9ctRoXzA6ITaGEBNUaiOJo0odTTv0jzx@xbot-postgres.c9couagskvi4.eu-west-1.rds.amazonaws.com:5432/xbot" -f prisma/migrations/drop_hivemind/migration.sql
```

Expected output:
```
ALTER TABLE
DROP TABLE
DROP TABLE
DROP TABLE
DROP TABLE
```

**Step 4: Verificar que las tablas han sido eliminadas**

```bash
psql "postgresql://xbotadmin:9ctRoXzA6ITaGEBNUaiOJo0odTTv0jzx@xbot-postgres.c9couagskvi4.eu-west-1.rds.amazonaws.com:5432/xbot" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'hivemind%';"
```

Expected: `(0 rows)`

**Step 5: Commit**

```bash
git add prisma/migrations/drop_hivemind/migration.sql
git commit -m "db: drop hivemind tables (raids, actions, users, config)"
```

---

### Task 2: Actualizar Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Abrir `prisma/schema.prisma` y eliminar los siguientes modelos completos:**
- `HivemindConfig` (buscar `model HivemindConfig`)
- `HivemindUser` (buscar `model HivemindUser`)
- `HivemindAction` (buscar `model HivemindAction`)
- `HivemindRaid` (buscar `model HivemindRaid`)

**Step 2: Eliminar el campo `hivemindConfig` de `TwitterApp`**

Buscar en `TwitterApp`:
```prisma
hivemindConfig   HivemindConfig?
```
Eliminar esa línea.

**Step 3: Eliminar referencias a `HivemindUser` en `RateLimit`**

Buscar en `RateLimit`:
```prisma
hivemindUserId  String?       @map("hivemind_user_id")
hivemindUser    HivemindUser? @relation(fields: [hivemindUserId], references: [userId], onDelete: Cascade)
@@index([hivemindUserId, endpoint])
```
Eliminar esas 3 líneas.

**Step 4: Verificar que el schema compila**

```bash
cd /tmp/twitter-agentic-api && npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

**Step 5: Regenerar Prisma client**

```bash
npx prisma generate
```

**Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "prisma: remove hivemind models from schema"
```

---

### Task 3: Eliminar API routes de hivemind

**Files:**
- Delete: `src/app/api/hivemind/` (toda la carpeta)

**Step 1: Eliminar la carpeta completa**

```bash
rm -rf /tmp/twitter-agentic-api/src/app/api/hivemind
```

**Step 2: Verificar que no queda nada**

```bash
ls /tmp/twitter-agentic-api/src/app/api/
```

Expected: no aparece `hivemind/`

**Step 3: Commit**

```bash
git add -A src/app/api/hivemind
git commit -m "feat: remove all hivemind API routes"
```

---

### Task 4: Eliminar páginas hivemind, status y raid

**Files:**
- Delete: `src/app/hivemind/` (toda la carpeta)
- Delete: `src/app/status/` (toda la carpeta)
- Delete: `src/app/raid/` (toda la carpeta)
- Delete: `src/app/dashboard/hivemind/` (toda la carpeta)

**Step 1: Eliminar las carpetas**

```bash
rm -rf /tmp/twitter-agentic-api/src/app/hivemind
rm -rf /tmp/twitter-agentic-api/src/app/status
rm -rf /tmp/twitter-agentic-api/src/app/raid
rm -rf /tmp/twitter-agentic-api/src/app/dashboard/hivemind
```

**Step 2: Verificar**

```bash
ls /tmp/twitter-agentic-api/src/app/
ls /tmp/twitter-agentic-api/src/app/dashboard/
```

Expected: no aparece `hivemind/`, `status/`, `raid/`

**Step 3: Commit**

```bash
git add -A src/app/hivemind src/app/status src/app/raid src/app/dashboard/hivemind
git commit -m "feat: remove hivemind, status, and raid pages"
```

---

### Task 5: Eliminar lib/db/hivemind.ts y lib/auth/hivemind.ts

**Files:**
- Delete: `src/lib/db/hivemind.ts`
- Delete: `src/lib/auth/hivemind.ts`

**Step 1: Eliminar los archivos**

```bash
rm /tmp/twitter-agentic-api/src/lib/db/hivemind.ts
rm /tmp/twitter-agentic-api/src/lib/auth/hivemind.ts
```

**Step 2: Verificar que nadie más los importa**

```bash
grep -r "lib/db/hivemind\|lib/auth/hivemind" /tmp/twitter-agentic-api/src/ --include="*.ts" --include="*.tsx"
```

Expected: `(no output)` — si hay resultados, eliminar esos imports también.

**Step 3: Commit**

```bash
git add -A src/lib/db/hivemind.ts src/lib/auth/hivemind.ts
git commit -m "feat: remove hivemind lib modules"
```

---

### Task 6: Eliminar componente HivemindTwitterApiDocs

**Files:**
- Delete: `src/components/HivemindTwitterApiDocs.tsx`

**Step 1: Verificar que nadie lo importa**

```bash
grep -r "HivemindTwitterApiDocs" /tmp/twitter-agentic-api/src/ --include="*.ts" --include="*.tsx"
```

Si hay referencias, eliminarlas primero de esos archivos.

**Step 2: Eliminar el archivo**

```bash
rm /tmp/twitter-agentic-api/src/components/HivemindTwitterApiDocs.tsx
```

**Step 3: Commit**

```bash
git add -A src/components/HivemindTwitterApiDocs.tsx
git commit -m "feat: remove HivemindTwitterApiDocs component"
```

---

### Task 7: Limpiar dashboard/page.tsx — quitar link a /dashboard/hivemind

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Leer el archivo**

```bash
cat -n /tmp/twitter-agentic-api/src/app/dashboard/page.tsx | grep -A3 -B3 "hivemind"
```

**Step 2: Eliminar el botón/card que navega a `/dashboard/hivemind`**

Buscar y eliminar el bloque que contiene:
```tsx
onClick={() => router.push('/dashboard/hivemind')}
```
Eliminar el elemento JSX completo que lo contiene (botón, card, o list item).

**Step 3: Verificar que el archivo compila**

```bash
cd /tmp/twitter-agentic-api && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: remove hivemind link from dashboard"
```

---

### Task 8: Limpiar auth/config.ts — quitar comentario sobre hivemind

**Files:**
- Modify: `src/lib/auth/config.ts`

**Step 1: Leer el archivo**

```bash
cat /tmp/twitter-agentic-api/src/lib/auth/config.ts
```

**Step 2: Eliminar el comentario que menciona hivemind**

Buscar:
```
// Hivemind users need to be able to connect their accounts
```
Eliminar esa línea de comentario.

También actualizar `signIn` callback — ahora que no hay hivemind, el comentario `// Allow ALL users to sign in` puede simplificarse, pero solo eliminar la referencia explícita a hivemind.

**Step 3: Commit**

```bash
git add src/lib/auth/config.ts
git commit -m "chore: remove hivemind comment from auth config"
```

---

### Task 9: Reemplazar index page con redirect a /admin

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Reemplazar completamente el contenido del archivo**

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/admin')
}
```

**Step 2: Verificar que no hay imports huérfanos ni CSS relacionado que importe page.tsx**

```bash
grep -r "zeus-landing\|from.*app/page" /tmp/twitter-agentic-api/src/ --include="*.ts" --include="*.tsx" --include="*.css"
```

**Step 3: Verificar que compila**

```bash
cd /tmp/twitter-agentic-api && npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace landing page with redirect to /admin"
```

---

### Task 10: Eliminar CSS/assets zeus-landing no usados

**Files:**
- Check: `src/app/globals.css` or `public/zeus-landing.css`

**Step 1: Buscar archivos CSS relacionados con la landing**

```bash
find /tmp/twitter-agentic-api/src -name "*.css" | xargs grep -l "zeus-landing\|hivemind" 2>/dev/null
find /tmp/twitter-agentic-api/public -name "zeus-landing*" 2>/dev/null
```

**Step 2: Eliminar archivos CSS exclusivos de hivemind/landing**

Si existe `public/zeus-landing.css` u otro archivo CSS solo para la landing o hivemind, eliminarlo:
```bash
rm /tmp/twitter-agentic-api/public/zeus-landing.css  # si existe
```

Si las reglas están en `globals.css`, eliminar solo las secciones marcadas con comentarios `/* hivemind */` o `/* zeus-landing */`.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove zeus-landing and hivemind CSS"
```

---

### Task 11: Build final y verificación

**Step 1: Ejecutar build completo**

```bash
cd /tmp/twitter-agentic-api && npm run build 2>&1
```

Expected: `✓ Compiled successfully` sin errores de TypeScript ni referencias a hivemind.

**Step 2: Si hay errores de compilación**

Leer el error completo, identificar qué archivo aún importa algo de hivemind, y eliminarlo.

**Step 3: Push a GitHub**

```bash
cd /tmp/twitter-agentic-api && git push origin main
```

**Step 4: Verificar en GitHub**

```bash
gh repo view gotoalberto/twitter-agentic-api --web
```

Confirmar que el último commit es visible y el build de Vercel (si hay CI) pasa.

---

## Resumen de archivos a eliminar

| Tipo | Ruta |
|------|------|
| Página | `src/app/hivemind/` |
| Página | `src/app/status/` |
| Página | `src/app/raid/` |
| Página | `src/app/dashboard/hivemind/` |
| API | `src/app/api/hivemind/` (16 rutas) |
| Lib | `src/lib/db/hivemind.ts` |
| Lib | `src/lib/auth/hivemind.ts` |
| Component | `src/components/HivemindTwitterApiDocs.tsx` |
| DB | `hivemind_config`, `hivemind_users`, `hivemind_actions`, `hivemind_raids` |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/app/page.tsx` | Reemplazar con redirect a /admin |
| `prisma/schema.prisma` | Eliminar 4 modelos + refs en TwitterApp y RateLimit |
| `src/app/dashboard/page.tsx` | Quitar botón/link a /dashboard/hivemind |
| `src/lib/auth/config.ts` | Quitar comentario sobre hivemind |
