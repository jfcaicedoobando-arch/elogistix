
## Objetivo

Reemplazar el badge confuso `estado_revision` ("Pendiente de revisión") por **dos badges claros e independientes** en el detalle de la proforma:

1. **Badge de estado del ciclo** (qué está pasando con la proforma)
2. **Badge de origen de aceptación** (quién la aceptó) — solo visible cuando está aceptada

## Diseño de los badges

### Badge 1 — Estado del ciclo
| Condición | Texto | Color |
|---|---|---|
| `estado_proforma = 'facturada'` | Facturada | verde (success) |
| `estado_cliente = 'rechazada'` | Rechazada por cliente | rojo (destructive) |
| `estado_cliente = 'aceptada'` | Aceptada | azul (info) |
| `estado_cliente = 'pendiente'` | Pendiente cliente | ámbar (warning) |

### Badge 2 — Origen de aceptación (solo si `estado_cliente = 'aceptada'`)
| Origen | Texto | Ícono |
|---|---|---|
| Portal público (token) | Cliente aceptó por portal | `Globe` |
| Dialog manual del equipo | Aceptación manual | `UserCheck` |
| Migración histórica | Aceptación histórica | `Archive` |

## Cambios técnicos

### 1. Base de datos
Agregar columna `aceptacion_origen` a `public.proformas`:
- Tipo: `text` con `CHECK IN ('portal','manual','migracion')`, nullable.
- Migración de datos existentes:
  - `aceptada_por = 'migración histórica pre-julio 2026'` → `'migracion'`
  - Resto de aceptadas actuales → `'manual'` (todas las anteriores se marcaron desde el dialog).

### 2. RPCs
- `actualizar_estado_cliente_proforma` (manual) → escribe `aceptacion_origen = 'manual'`.
- `portal_responder_por_token` (portal público) → escribe `aceptacion_origen = 'portal'`.

### 3. Frontend
- `src/features/proformas/components/ProformaDetalleCards.tsx` (`EstadoBadges`): eliminar el badge de `estado_revision`; renderizar los dos badges nuevos con tooltips explicando cada uno.
- `src/features/proformas/services/portalPublico.ts` y `respuestaCliente.ts`: reflejar el nuevo campo en los tipos de retorno (con `// SAFE-CAST:` mientras se regeneran los tipos).
- Tabla de proformas (`proformasColumns.tsx`): sin cambios (ya muestra el estado del ciclo correctamente desde el fix anterior).

### 4. Revisión interna
El campo `estado_revision` **sigue existiendo en la BD** y sigue bloqueando "Convertir a factura", pero **ya no se muestra como badge en el header** para no confundir. Si más adelante quieres verlo, lo movemos a la tarjeta de "Detalles internos" con etiqueta clara.

### 5. Versionado
Bump a `13.144.9` + entrada en `CHANGELOG.md`.

## Fuera de alcance
- No se toca la lógica de facturación (sigue requiriendo revisión interna aprobada + cliente aceptó).
- No se cambia el flujo del portal ni del dialog manual, solo se etiqueta el origen.
