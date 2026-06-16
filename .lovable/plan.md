
# Ciclo de vida de cotizaciones (housekeeping automático)

Mantener la BD limpia sin perder historia: expirar por edad, archivar después, purgar opcional manual.

## 1. Modelo de estados

Estados actuales que se mantienen: `borrador`, `enviada`, `aceptada`, `rechazada`, etc.

Se agregan dos nuevos:
- **`expirada`** — caducó por inactividad/vigencia (NO es rechazo del cliente; no contamina tasa de cierre).
- **`archivada`** — oculta de listados, conservada en BD.

Reglas de transición automática (job nocturno):

| Origen | Condición | Nuevo estado |
|---|---|---|
| `borrador` | `updated_at` > 7 días | `expirada` |
| `enviada` | `fecha_validez < CURRENT_DATE` | `expirada` |
| `expirada` | `updated_at` > 90 días | `archivada` |

No se aplica a cotizaciones con: `aceptada`, `rechazada`, embarque vinculado, o flag `congelada` (futura).

## 2. Migración (BD)

**a) Ampliar enum / CHECK** del estado de `cotizaciones` para incluir `expirada` y `archivada`.

**b) Asegurar columna** `fecha_validez date` (revisar si ya existe; si no, agregarla con default `CURRENT_DATE + INTERVAL '15 days'` para nuevas filas y backfill `created_at + 15d` para las existentes enviadas).

**c) Columna auxiliar** `estado_anterior text` (para auditoría de quién pasó a expirada/archivada y poder revertir).

**d) Habilitar extensión** `pg_cron` (ya disponible en Lovable Cloud).

**e) Función SECURITY DEFINER** `public.expirar_cotizaciones_job()`:
1. UPDATE borradores >7d → `expirada` (registra `estado_anterior='borrador'`, escribe en `bitacora_actividad` como sistema).
2. UPDATE enviadas con `fecha_validez < CURRENT_DATE` → `expirada`.
3. UPDATE expiradas >90d (por `updated_at`) → `archivada`.
4. Excluye filas con embarque vinculado o estado terminal.
5. Devuelve conteos por categoría para logging.

**f) Programar pg_cron**: ejecución diaria 03:00 America/Mexico_City llamando al job. Registrar resultado en `app_logs`.

## 3. UI

**a) Listado de cotizaciones** (`/cotizaciones`):
- Filtro de estado por defecto excluye `expirada` y `archivada`.
- Agregar chips/checkbox "Incluir expiradas" e "Incluir archivadas" en la barra de filtros.
- Badge gris para `expirada`, badge tenue para `archivada`.

**b) Detalle de cotización expirada**:
- Banner informativo: "Esta cotización expiró el DD/MM/YYYY. Las tarifas pueden estar desactualizadas."
- Botón **"Reactivar"** (solo admin/gerencia/ejecutivo dueño) → vuelve a `estado_anterior` y refresca `updated_at`. Registra en bitácora.
- Botón **"Duplicar como nueva"** (cualquier rol con permiso de crear).

**c) Aviso preventivo** (no bloqueante en esta entrega; preparar el campo):
- Calcular `días_para_expirar` en el listado; mostrar tooltip naranja cuando ≤2 días en borrador. (Notificación por email queda fuera de alcance de este plan.)

## 4. Configuración (futuro, no en esta entrega)

Dejar el plazo de 7 días como **constante exportada** en `src/features/cotizacion/domain/lifecycle.ts` (`DIAS_EXPIRACION_BORRADOR = 7`) para que cuando se quiera hacer configurable por organización, solo se mueva a `configuracion_global`.

## 5. Cambios técnicos resumidos

- **Migración SQL**: enum, columnas, función, pg_cron.
- **Frontend**:
  - `src/features/cotizacion/services/queries.ts` — filtro por defecto excluye estados inactivos.
  - `src/features/cotizacion/components/CotizacionesFiltros.tsx` — toggles nuevos.
  - `src/features/cotizacion/components/CotizacionDetalleHeader.tsx` — banner + botón reactivar.
  - `src/features/cotizacion/domain/lifecycle.ts` — constantes y helpers `puedeReactivar()`, `estaInactiva()`.
  - Badge component — colores nuevos.
- **Bitácora**: cada transición automática se registra con `usuario_id = NULL` y `accion = 'cotizacion_expirada_auto'` / `'cotizacion_archivada_auto'`.
- **`APP_VERSION`** → `13.40.0`.
- **`CHANGELOG.md`** → entrada nueva.

## 6. Backfill al desplegar

Una sola corrida manual del job tras la migración para clasificar el histórico actual. Se reporta al usuario cuántas filas pasaron a `expirada` / `archivada` antes de habilitar el cron.

## 7. Lo que NO se hace

- No se borra nada de la BD.
- No se tocan cotizaciones `aceptada`/`rechazada` ni las que ya generaron embarque.
- No se envían emails al ejecutivo (queda como mejora futura).
- No se configura por organización todavía (constante centralizada lista para migrar).
