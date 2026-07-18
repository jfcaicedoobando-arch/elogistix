# Revisión Fase F reforzada — verde

Verifiqué los guardrails de Fases D/E/F + hotfix + refuerzo (v13.301.73–77):

- `saldo-factura-fase-d.test.ts` — 8/8 ✅
- `eliminar-embarque-bloqueado-fiscal.test.ts` — 8/8 ✅
- `candados-pagos-rep-nc-fase-f.test.ts` — 13/13 ✅
- `rep-guard-hotfix-migration.test.ts` — 4/4 ✅

**33/33 en verde.** Sin bugs pendientes. Fixtures RLS ya insertan facturas timbradas (estado realista), guardrail estático protege el `WHEN` clause y el early-exit del trigger. Cierro Fase F y arranco Fase G.

---

# Fase G — Grafo de transiciones de estado de embarque (Bug 12)

## Problema (verificado en código)

El enum `estado_embarque` tiene 12 valores (`Borrador, Cotización, Confirmado, En Tránsito, En Aduana, Llegada, Arribo, En Proceso, Entregado, EIR, Cerrado, Cancelado`), pero **nada valida qué transiciones son legales**:

- `avanzar_estado_embarque` (RPC en `20260708044858_*.sql`) sólo bloquea:
  - `Arribo` sin `fecha_llegada_real`
  - Docs faltantes en 7 estados avanzados
  - `Cerrado` delega a `cerrar_embarque`
  
  Pero acepta **cualquier salto**: `Borrador → Entregado`, `Cerrado → Cotización`, `Cancelado → En Tránsito`, ida y vuelta arbitraria, etc.
- `actualizarEstadoEmbarque` (`embarqueDirectMutations.ts`) hace `UPDATE embarques SET estado = ...` sin ningún guard — camino paralelo que ignora hasta los pocos candados que sí tiene la RPC.
- `useSyncEstadoEmbarque` usa la ruta directa desde el UI del Tracking.

Consecuencia: bitácora y timeline pueden mostrar secuencias imposibles; reportes que asumen orden temporal (KPIs, alertas de demora) mienten; un usuario puede reabrir un embarque `Cancelado` sin pasar por reapertura formal.

## Solución

Definir el grafo dirigido de transiciones válidas server-side y aplicarlo en **ambas rutas** (RPC + trigger). El trigger es la última línea de defensa: incluso `actualizarEstadoEmbarque` (UPDATE directo) queda cubierto.

### Grafo propuesto

```text
Borrador ─→ Cotización ─→ Confirmado ─→ En Tránsito ─→ En Aduana ─→ Llegada ─→ Arribo ─→ Entregado ─→ EIR ─→ Cerrado
                              │              │              │           │          │           │
                              └──────────────┴──────────────┴───────────┴──────────┴───────────┘
                                              todos permiten → Cancelado
                                              
Reapertura: sólo Cerrado → EIR (vía RPC `reabrir_embarque`, ya existe)
Cancelado: estado terminal (no sale de ahí sin intervención admin)
En Proceso: estado legacy — se acepta como sinónimo de `En Tránsito` para no romper datos históricos, pero no es destino de nuevas transiciones.
```

Reglas adicionales:
- Idempotencia: `estado_actual = nuevo_estado` se acepta como no-op (no rompe reintentos).
- `Cerrado` sigue delegando a `cerrar_embarque` (candados financieros de Fase E ya existen).
- `Cancelado` requiere que **no** haya facturas vivas ni CxP viva (reutiliza los contadores de Fase E).

## Cambios

### 1. Migración `20260718XXXXXX_grafo_transiciones_embarque.sql`

- **Función `public.transicion_embarque_valida(actual estado_embarque, nuevo estado_embarque) RETURNS boolean`** (IMMUTABLE, SECURITY DEFINER):
  - Devuelve `true` si `actual = nuevo` (idempotente).
  - Contiene la tabla de aristas del grafo como `CASE` explícito.
- **Función `public.assert_transicion_embarque(actual, nuevo, expediente text)`**: `RAISE EXCEPTION 'LC_TRANSICION_INVALIDA: ...'` con `HINT` JSON `{estado_actual, estado_nuevo, expediente, transiciones_permitidas}`.
- **Reescritura de `avanzar_estado_embarque`**: llama `assert_transicion_embarque` como primer chequeo tras leer el estado actual. Rama `Cancelado` agrega chequeo de facturas/CxP vivas (contadores de Fase E).
- **Trigger nuevo `trg_embarque_transicion_valida` en `embarques` `BEFORE UPDATE OF estado`**:
  - `WHEN (OLD.estado IS DISTINCT FROM NEW.estado)`.
  - Bypass controlado con `current_setting('app.bypass_transicion', true) = 'on'` para migraciones/backfills legítimos (patrón ya usado por `app.bypass_cierre`).
  - Llama `assert_transicion_embarque`.

### 2. Guardrails

- `src/lib/__tests__/grafo-transiciones-embarque-fase-g.test.ts` (nuevo):
  - Existencia de `transicion_embarque_valida` y `assert_transicion_embarque`.
  - Grafo cubre las 10 aristas del happy path.
  - Todos los estados excepto `Cancelado` pueden ir a `Cancelado`.
  - `Cerrado → *` sólo permite `Cerrado` (idempotente) y `EIR` (reapertura).
  - `Cancelado` no tiene salidas.
  - `avanzar_estado_embarque` invoca `assert_transicion_embarque` antes de cualquier UPDATE.
  - Trigger `trg_embarque_transicion_valida` existe con `WHEN (OLD.estado IS DISTINCT FROM NEW.estado)` y bypass reconocido.
  - Marcador `LC_TRANSICION_INVALIDA` presente con las 4 llaves del HINT.
- Extender `mutations.test.ts` de embarques: `actualizarEstadoEmbarque` con transición inválida propaga error tipado del server.

### 3. UI

- `useEmbarqueEstadoActions.ts`: mapear `LC_TRANSICION_INVALIDA` a un toast claro ("Transición no permitida: X → Y"), listando las transiciones válidas del `HINT`.
- Sin cambios visuales adicionales — el botón "Avanzar" ya calcula el siguiente estado del happy path, así que el error sólo aparecería en atajos manuales / atomicidad de reintentos.

### 4. Diagnóstico previo (dry-run antes de migrar)

Antes de instalar el trigger, correr consulta de auditoría contra `bitacora_actividad` / `notas_embarque` para detectar embarques cuyo historial de estados **hoy** viole el grafo. Reportar cantidad y expedientes. Si hay >0, ajustar el grafo o marcar excepciones antes de bloquear.

### 5. Versionado

- `APP_VERSION` → `13.301.78`.
- Entrada en `CHANGELOG.md` describiendo el grafo, el trigger, el diagnóstico dry-run y el guardrail.

## Roadmap tras Fase G

- Cierre de la ronda 2 de auditoría (Bugs 6–12 resueltos).
- Queda pendiente evaluar si vale una Fase H para garantías/comisiones (Ronda 2 no las priorizó), o si cerramos la auditoría y volvemos a UX.
