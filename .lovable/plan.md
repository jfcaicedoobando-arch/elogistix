# Mostrar cotización origen en el detalle del embarque

## Problema

En `/embarques/:id` no hay ninguna referencia visible a la cotización que originó el embarque, aunque `embarques.cotizacion_id` exista. Hoy sólo se usa internamente (tracking, fases, herencia).

## Solución

Agregar un chip "Generado desde **COT-XXXX**" en `EmbarqueDetalleHeader.tsx`, debajo del nombre del cliente, que navega a `/cotizaciones/{cotizacion_id}`.

### Cambios

1. **Nuevo hook** `useCotizacionFolio(cotizacionId)` en `src/features/cotizacion/hooks/useCotizacionQueries.ts`:
   - Query liviana `select('folio').eq('id', id).maybeSingle()`.
   - `staleTime: 5 min`, `enabled: !!cotizacionId`.
   - Devuelve `{ folio: string | null, isLoading }`.

2. **`EmbarqueDetalleHeader.tsx`**:
   - Consumir el hook con `embarque.cotizacion_id`.
   - Si hay folio, renderizar debajo del `cliente_nombre`:
     ```
     <Link to=`/cotizaciones/${embarque.cotizacion_id}`>
       <Badge variant="outline">
         <FileText className="h-3 w-3 mr-1" /> Generado desde {folio}
       </Badge>
     </Link>
     ```
   - Si `cotizacion_id` existe pero el folio no se pudo resolver (cot. eliminada), mostrar badge inactivo "Cotización origen no disponible".

3. **Sin cambios de BD ni de tabs**: el dato ya existe en `embarque.cotizacion_id`.

## Verificación

- En `/embarques/79fe05dc-...` (ELIMP00272, vinculado a COT-2026-0076) debe verse el chip y navegar a la cotización.
- En embarques sin `cotizacion_id` no debe aparecer nada.

## Versionado

- `APP_VERSION` → `13.66.1`.
- Entrada en `CHANGELOG.md` describiendo el cambio.

## Archivos afectados

- `src/features/cotizacion/hooks/useCotizacionQueries.ts` (hook nuevo)
- `src/features/cotizacion/services/queries.ts` (helper `fetchCotizacionFolio`)
- `src/features/embarques/components/EmbarqueDetalleHeader.tsx`
- `src/constants/appVersion.ts`, `CHANGELOG.md`
