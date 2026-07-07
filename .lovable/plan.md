## Diagnóstico

La proforma **PRO-2026-0278** del embarque **ELIMP00021** tiene estos valores en BD:

| Campo | Valor |
|---|---|
| `estado_cliente` | `aceptada` ✅ (el cliente aceptó el 27-may-2026) |
| `estado_revision` | `pendiente` (nadie la aprobó internamente) |
| `estado_proforma` | `pendiente` |

En la app existen **dos flujos independientes** que se combinaron mal:

- `estado_cliente` → respuesta del cliente al recibir la proforma (`pendiente / aceptada / rechazada`).
- `estado_revision` → aprobación interna del equipo (`pendiente / aprobada / consolidada`).

El **listado global de proformas** ya usa `getEstadoUnificado()` (en `src/features/proformas/lib/estadoUnificado.ts`) que prioriza el estado del cliente y muestra "Aceptada". Pero la tarjeta **"Proformas Generadas"** dentro del embarque (`HistorialProformas.tsx`) sólo mira `estado_revision` y por eso muestra "Pendiente revisión" aunque el cliente ya haya aceptado.

Analogía: la sucursal (embarque) sigue viendo el paquete como "sin sellar internamente" aunque el cliente ya firmó el acuse en el mostrador. Vamos a que la sucursal use el mismo tablero de estados que la oficina central.

## Cambio

**Archivo único**: `src/features/embarques/components/facturacion/HistorialProformas.tsx` (función `renderEstado`).

Reemplazar la lógica actual por la misma prioridad que usa el listado global, con estas reglas en orden:

1. **Facturada** → badge verde "Facturada" (sin cambios).
2. **Borrador vacío** → badge amarillo "Borrador vacío" (sin cambios).
3. **Consolidada** (`estado_revision = 'consolidada'`) → badge azul "Consolidada en X" (sin cambios).
4. **Rechazada por cliente** (`estado_cliente = 'rechazada'`) → badge rojo "Rechazada" (nuevo).
5. **Aceptada por cliente** (`estado_cliente = 'aceptada'`) → badge verde "Aceptada" (nuevo — resuelve el bug).
6. **Aprobada internamente pero sin respuesta del cliente** (`estado_revision = 'aprobada'` y `estado_cliente = 'pendiente'`) → badge neutro "Enviada al cliente".
7. **Pendiente revisión** (`estado_revision = 'pendiente'` y sin respuesta del cliente) → badge amarillo "Pendiente revisión" (sólo si el cliente aún no responde).

Para mantener consistencia se reutilizará `getEstadoUnificado()` del feature `proformas` (ya existe, testeado). No se toca BD, ni se agregan endpoints ni migraciones.

## Efecto en el caso reportado

Después del cambio, `PRO-2026-0278` mostrará **"Aceptada"** en el embarque `ELIMP00021`, igual que en el listado global.

## Detalle técnico

- Importar `getEstadoUnificado` desde `@/features/proformas/lib/estadoUnificado`.
- La función `renderEstado` pasa a ~15 líneas (bajo el límite Power of 10).
- No hay cambios de contrato en la tabla ni en los datos que recibe `HistorialProformas` (`ProformaConFactura` ya incluye `estado_cliente` vía SAFE-CAST).
- Se actualiza el test si existe (`HistorialProformas.test.tsx`); si no, se agrega uno mínimo cubriendo los 3 caminos nuevos (aceptada, rechazada, enviada).

## Changelog

- Bump `APP_VERSION` a `13.209.2`.
- Entrada en `CHANGELOG.md`: fix del badge de proformas en el embarque para reflejar el estado del cliente.

## Fuera de alcance

- No se cambia la lógica del listado global de proformas.
- No se altera el flujo de aprobación interna ni el portal público.
- No se corrigen datos históricos: los estados en BD ya son consistentes, era sólo un problema de presentación.
