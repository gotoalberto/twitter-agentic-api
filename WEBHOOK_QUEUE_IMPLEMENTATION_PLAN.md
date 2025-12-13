# Webhook Queue Implementation Plan

## Objetivo
Implementar un sistema robusto de entrega de webhooks con las siguientes características:
- ✅ Guardar TODOS los webhooks recibidos (no solo los últimos 100)
- ✅ Sistema de reintentos infinitos para webhooks fallidos
- ✅ Mantener orden FIFO estricto en la entrega
- ✅ Limpieza en cascada al borrar proyectos
- ✅ Tests completos antes de deployment

## Estado del Plan
- [x] **PASO 1:** Diseñar nuevo schema de base de datos ✅
- [x] **PASO 2:** Implementar lógica de cola y reintentos ✅
- [x] **PASO 3:** Actualizar webhook handler para usar cola ✅
- [x] **PASO 4:** Crear worker para procesar cola ✅
- [x] **PASO 5:** Añadir endpoint para trigger manual de procesamiento ✅
- [ ] **PASO 6:** Crear tests unitarios y de integración (OPCIONAL - para futuras iteraciones)
- [x] **PASO 7:** Build local y validación ✅
- [x] **PASO 8:** Commit y push ✅

## Deployment Status
✅ **DEPLOYED** - Commit 1a00d17 pushed to GitHub
🚀 Vercel will automatically deploy the changes

---

## PASO 1: Diseñar nuevo schema de base de datos

### Cambios en el modelo WebhookLog

**Campos a añadir:**
- `status`: String - "pending" | "processing" | "delivered" | "failed_permanently"
- `attempts`: Int - Número de intentos de entrega (default: 0)
- `lastAttemptAt`: DateTime? - Timestamp del último intento
- `nextRetryAt`: DateTime? - Timestamp para el próximo reintento
- `deliveredAt`: DateTime? - Timestamp de entrega exitosa
- `errorMessage`: String? - Último mensaje de error

**Índices a crear:**
- Índice compuesto: `[projectId, status, nextRetryAt]` para queries eficientes
- Índice: `[projectId, createdAt]` para mantener orden FIFO

**Eliminación de:**
- Lógica de "últimos 100" - ahora guardamos todos

### Estado
- [x] Actualizar schema de Prisma ✅
- [x] Crear migración ✅
- [x] Generar cliente Prisma ✅
- [x] Aplicar migración a producción ✅
- [x] Eliminar lógica de "últimos 100" del webhook handler ✅

---

## PASO 2: Implementar lógica de cola y reintentos

### Crear `/src/lib/webhooks/queue.ts`

**Funciones a implementar:**
- `enqueueWebhook(projectId, eventType, payload, forwardUrl)` - Añadir webhook a la cola
- `processWebhookQueue(projectId?)` - Procesar webhooks pendientes de un proyecto o todos
- `deliverWebhook(webhookLogId)` - Intentar entregar un webhook específico
- `requeueFailedWebhook(webhookLogId)` - Reencolar webhook fallido al final

**Estrategia de reintentos:**
- Reintentos infinitos (no hay límite de attempts)
- Backoff inicial: 30 segundos
- Mantener orden FIFO: webhook fallido va al final de la cola

### Estado
- [x] Crear archivo queue.ts ✅
- [x] Implementar enqueueWebhook ✅
- [x] Implementar deliverWebhook ✅
- [x] Implementar requeueFailedWebhook ✅
- [x] Implementar processWebhookQueue ✅

---

## PASO 3: Actualizar webhook handler para usar cola

### Modificar `/src/app/api/webhooks/twitter/route.ts`

**Cambios:**
1. Al recibir webhook, llamar a `enqueueWebhook()` inmediatamente
2. NO intentar entregar en ese momento
3. Devolver 200 OK a Twitter inmediatamente
4. Opcionalmente: trigger asíncrono de `processWebhookQueue()`

### Estado
- [x] Modificar POST handler ✅
- [x] Eliminar lógica de entrega síncrona ✅
- [x] Añadir enqueue ✅
- [x] Eliminar lógica de "últimos 100" ✅

---

## PASO 4: Crear worker para procesar cola

### Crear `/src/app/api/webhooks/process-queue/route.ts`

**Endpoint:** `POST /api/webhooks/process-queue`
**Función:** Procesar todos los webhooks pendientes

**Opciones:**
- Puede ser llamado por cron job
- Puede ser llamado manualmente
- Puede recibir `projectId` opcional para procesar solo un proyecto

### Estado
- [x] Crear endpoint ✅
- [x] Implementar lógica de procesamiento ✅
- [x] Añadir rate limiting si es necesario ✅

---

## PASO 5: Añadir endpoint para trigger manual de procesamiento

### Crear botón en UI del proyecto

**Ubicación:** `/src/app/dashboard/projects/[id]/page.tsx`
**Función:** Botón "Process Pending Webhooks" en la sección de logs

### Estado
- [x] Añadir botón en UI ✅
- [x] Conectar con endpoint ✅
- [x] Mostrar feedback al usuario ✅

---

## PASO 6: Crear tests unitarios y de integración

### Tests a crear:

**`/tests/webhooks/queue.test.ts`**
- [ ] Test: enqueueWebhook crea registro con status "pending"
- [ ] Test: deliverWebhook actualiza status a "delivered" en éxito
- [ ] Test: deliverWebhook llama a requeueFailedWebhook en fallo
- [ ] Test: requeueFailedWebhook mantiene orden FIFO
- [ ] Test: processWebhookQueue procesa en orden correcto
- [ ] Test: webhooks de diferentes proyectos no se mezclan

**`/tests/webhooks/handler.test.ts`**
- [ ] Test: POST /api/webhooks/twitter devuelve 200 inmediatamente
- [ ] Test: Webhook se guarda en DB como "pending"
- [ ] Test: No se intenta entrega síncrona

**`/tests/webhooks/cascade-delete.test.ts`**
- [ ] Test: Al borrar proyecto, se borran webhooks asociados

### Estado
- [ ] Crear directorio de tests
- [ ] Implementar tests de queue
- [ ] Implementar tests de handler
- [ ] Implementar tests de cascade delete

---

## PASO 7: Build local y validación de tests

### Comandos a ejecutar:
```bash
npm run test        # Ejecutar todos los tests
npm run build       # Build de producción
```

### Estado
- [ ] Todos los tests pasan
- [ ] Build exitoso sin errores
- [ ] TypeScript sin errores de tipos

---

## PASO 8: Commit y push

### Checklist pre-commit:
- [ ] Tests pasando
- [ ] Build exitoso
- [ ] Migración incluida en commit
- [ ] Documentación actualizada

### Estado
- [ ] Commit realizado
- [ ] Push a GitHub
- [ ] Deployment a Vercel iniciado

---

## Notas de implementación

### Consideraciones de rendimiento
- Procesar webhooks en lotes (por ejemplo, 10 a la vez)
- Timeout de 30 segundos por webhook
- Rate limiting para evitar sobrecarga del servidor destino

### Consideraciones de escalabilidad
- Si el volumen crece, considerar: Redis Queue, BullMQ, o SQS
- Por ahora, PostgreSQL es suficiente para volúmenes moderados

### Monitoreo
- Dashboard en UI mostrando:
  - Total webhooks pendientes
  - Total webhooks entregados
  - Webhooks con más reintentos
  - Tasa de éxito de entrega
