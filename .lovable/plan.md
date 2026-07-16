## Objetivo

Que el badge de estado de una factura distinga tres situaciones que hoy se ven idénticas:

| Situación hoy | Se ve como | Debería verse |
|---|---|---|
| Cancelación enviada al SAT esperando aceptación del receptor (`estado='Cancelada'` + `acuse_cancelacion_status='pending'`) | "Cancelada" rojo | **"En cancelación"** ámbar |
| Cancelación aceptada por el SAT (`accepted`) | "Cancelada" rojo | **"Cancelada"** rojo (sin cambio) |
| Sustituida por otra factura (`estado='Sustituida'`) | "Sustituida" cae al fallback gris (no está registrada) | **"Sustituida"** muted+línea diagonal implícita, tono destructive tenue |

Aplica en:
- Detalle de factura (`FacturaDetalleHeader`)
- Tabla de facturación (`facturacionColumns` → `StatusBadge` dominio `factura`)

## Cambios

### 1. Helper puro nuevo — `src/features/facturacion/domain/facturaBadgeEstado.ts`
```ts
export function deriveFacturaBadgeEstado(
  estado: string | null | undefined,
  acuseStatus: string | null | undefined,
): string
```
Reglas:
- `Cancelada` + `pending` → `"En cancelación"`
- `Sustituida` → `"Sustituida"`
- resto → `estado` tal cual
Tests: matriz 6 casos.

### 2. Registry — `src/lib/status/statusRegistry.ts`
- Agregar `"En cancelación"` y `"Sustituida"` a `DOMAIN_STATUSES.factura`.
- Agregar en `EXTRA`:
  - `"En cancelación"`: `bg-warning/15 text-warning border border-warning/30` (mismo tono que "Pendiente")
  - `"Sustituida"`: `bg-muted text-muted-foreground border border-destructive/30` (gris con borde rojo tenue, para diferenciarlo de "Borrador")

### 3. Detalle — `FacturaDetalleHeader.tsx`
- Recibir `acuseStatus` opcional (o el `factura` completo).
- Reemplazar `<Badge className={getEstadoColor(estado)}>{estado}</Badge>` por `<StatusBadge domain="factura" status={deriveFacturaBadgeEstado(estado, acuseStatus)} />`.
- Actualizar callsite en `FacturaDetalle.tsx` para pasar `factura.acuse_cancelacion_status`.

### 4. Tabla — `facturacionColumns.tsx`
- Cambiar la `statusColumn` por un `ColumnDef` inline que use `StatusBadge` con el estado derivado (accesa a `estado` + `acuse_cancelacion_status` de la row).
- Mantener `enableSorting` sobre el string derivado para que "En cancelación" y "Sustituida" agrupen bien.

### 5. Servicio + RPC
La tabla se llena vía RPC `facturas_listado` que hoy **no** devuelve `acuse_cancelacion_status`. Se agrega la columna al SELECT del RPC y al tipo `FacturaListItem`:
- Migración SQL: `CREATE OR REPLACE FUNCTION public.facturas_listado(...)` añadiendo `f.acuse_cancelacion_status` a las columnas retornadas (sin cambiar firma de parámetros).
- `facturasCrud.ts`: extender `FacturaListItem` con `acuse_cancelacion_status: string | null` y mapearlo en el `rows.map`.

### 6. CHANGELOG + APP_VERSION
- Bump a **13.301.17** en `src/constants/appVersion.ts`.
- Entrada nueva en `CHANGELOG.md`.

## Fuera de alcance

- Filtros del dropdown "Estado" en `TabFacturasEmitidas` (siguen filtrando por `estado` de BD; el filtro semántico "En cancelación" queda para otra iteración si lo piden — no es lo que el usuario pidió).
- Otras vistas donde aparecen facturas (bandejas, dashboard) — se pueden migrar en un turno posterior si lo piden.

## Diagrama del flujo de derivación

```text
estado='Cancelada' ─┬─ acuse='pending'  → "En cancelación" (ámbar)
                    └─ acuse='accepted' → "Cancelada"       (rojo)
estado='Sustituida' ────────────────────→ "Sustituida"      (gris + rojo tenue)
estado=otro         ────────────────────→ estado            (sin cambio)
```