# Paso 3 — Distinguir facturas timbradas en sandbox vs producción

Persistir el ambiente (`sandbox` | `live`) en el que se emitió cada CFDI y marcar visualmente con un badge naranja "SANDBOX" únicamente cuando corresponda. Aplica a facturas, notas de crédito y complementos REP.

## 1. Migración de BD

Nueva columna `ambiente ambiente_facturapi` (enum con valores `sandbox`, `live`), nullable, en tres tablas:

```text
CREATE TYPE public.ambiente_facturapi AS ENUM ('sandbox', 'live');

ALTER TABLE public.facturas               ADD COLUMN ambiente ambiente_facturapi;
ALTER TABLE public.factura_notas_credito  ADD COLUMN ambiente ambiente_facturapi;
ALTER TABLE public.pagos_factura          ADD COLUMN ambiente ambiente_facturapi;
```

**Backfill (mismo migration):**
- `UPDATE facturas SET ambiente='sandbox' WHERE facturapi_id IS NOT NULL AND ambiente IS NULL;` (4 filas)
- `UPDATE factura_notas_credito SET ambiente='sandbox' WHERE facturapi_id IS NOT NULL AND ambiente IS NULL;` (0)
- `UPDATE pagos_factura SET ambiente='sandbox' WHERE facturapi_rep_id IS NOT NULL AND ambiente IS NULL;` (0)

**RPC `facturas_listado`:** re-crearlo para incluir `ambiente` en el RETURNS TABLE (mantiene todas las demás columnas y filtros).

## 2. Edge functions — escribir `ambiente` al timbrar

Las 3 funciones ya usan `resolveFacturapiKey` que devuelve `ambiente`. Solo hay que incluirlo en el `.update({...})` posterior al timbrado exitoso.

- `supabase/functions/facturapi-emitir/index.ts` (facturas) — agregar `ambiente: resolved.data.ambiente` al update de la línea ~183.
- `supabase/functions/facturapi-emitir-nota-credito/index.ts` — mismo cambio en su update final.
- `supabase/functions/facturapi-emitir-rep/index.ts` — mismo cambio en su update final.

Sin cambios de contrato ni CORS. Sin nuevos tests obligatorios (la wiring es un solo campo derivado del auth ya cubierto por `facturapiAuth_test.ts`).

## 3. Servicio de listado

`src/features/facturacion/services/facturasCrud.ts`:
- Añadir `ambiente: FacturaRow["ambiente"]` a `FacturaListItem`.
- Mapearlo desde la RPC en `rows.map(...)`.

## 4. UI — badge "SANDBOX" (solo sandbox)

Componente reutilizable nuevo: `src/features/facturacion/components/AmbienteBadge.tsx`
- Props: `ambiente: 'sandbox' | 'live' | null | undefined`.
- Si `ambiente !== 'sandbox'` → devuelve `null` (nada visible).
- Si es `sandbox` → `<Badge>` con clases `bg-orange-100 text-orange-800 border-orange-300` y texto `"SANDBOX"`, tooltip explicando que este CFDI se emitió en modo de pruebas y **no es válido ante el SAT**.

Puntos donde se muestra:
- `FacturaDetalleHeader.tsx` — al lado del número, junto al badge "Sin timbrar".
- `facturacionColumns.tsx` — dentro de la columna de "Número" (o inmediatamente después del texto) en cada fila.
- `FacturaTimbradoCard.tsx` — badge visible junto al UUID cuando la factura está timbrada.
- Detalle de nota de crédito y sección de pagos REP: mismo badge donde ya se muestra el UUID/folio del complemento.

Sin otros cambios visuales (facturas de producción quedan iguales, como pidió el usuario).

## 5. Registro

- Bump `APP_VERSION` → `13.172.0` (feature).
- Entrada en `CHANGELOG.md`: "Ambiente de timbrado persistido (sandbox/live) en facturas, notas de crédito y REP. Badge visual `SANDBOX` en detalle, listado y complementos. Backfill histórico marca las 4 facturas existentes como `sandbox`."

## Detalles técnicos

- Enum `ambiente_facturapi` centraliza los valores válidos y evita strings libres.
- La columna sigue nullable porque futuras filas antes del deploy podrían no traer el campo; el trigger no es necesario porque el update explícito en las 3 edge funcs lo cubre.
- No se toca `facturapi_credenciales.ambiente` — ese sigue siendo la config activa por org; la columna nueva es el snapshot histórico por documento.
- No hay cambios de RLS (heredan las políticas existentes de la tabla).

## Fuera de alcance

- No se cambia el flujo de cancelación (`facturapi-cancelar-*`) porque no crea documentos nuevos; conserva el ambiente ya guardado.
- No se filtra la lista por ambiente (no fue pedido).
- No se agrega badge en el portal del cliente (esas facturas ya se timbrarán en producción una vez migren).
