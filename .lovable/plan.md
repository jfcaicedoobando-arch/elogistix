## Problema

Al timbrar una factura el toast dice:

> Factura timbrada · UUID 160A0EBE…

El UUID truncado no le dice nada al usuario. Lo que necesita saber es "quedó timbrada, con qué folio, y que ya está lista para descargar/enviar".

## Cambio

Reemplazar el toast en `src/features/facturacion/hooks/useTimbrarFactura.ts` (línea 14) por un `toast.success` con:

- **Título**: `Factura timbrada correctamente` (mensaje humano, sin jerga)
- **Descripción**: `Serie <serie> · Folio <folio>` (lo que el usuario reconoce en la lista y en los PDF)
- **Duración**: 6 s para que dé tiempo a leerla

El UUID completo se sigue mostrando en el detalle de la factura (donde sí importa para conciliación con el SAT), así que no se pierde información — sólo se saca de la notificación efímera.

## Archivos afectados

- `src/features/facturacion/hooks/useTimbrarFactura.ts` — cambiar la línea del toast en `onSuccess`.
- `CHANGELOG.md` + `src/constants/appVersion.ts` — bump a `13.301.15` con nota "fix(ux): toast de timbrado muestra serie/folio en vez de UUID truncado".

## Fuera de alcance

- El toast de cancelación (línea 44) ya es claro (`CFDI cancelado` / `CFDI sustituido`).
- El toast de "timbrada pero no se envió el email" en `useTimbrarFacturaDialog.ts` sigue igual.
- No se toca la lógica de timbrado ni las query keys.

## Detalles técnicos

```ts
onSuccess: (res) => {
  toast.success("Factura timbrada correctamente", {
    description: `Serie ${res.serie} · Folio ${res.folio}`,
    duration: 6000,
  });
  qc.invalidateQueries({ queryKey: facturasKeys.all });
},
```

`TimbradoResult` ya expone `serie: string` y `folio: number` (ver `services/facturapi.ts`), así que no hay cambios de tipos ni de red.
