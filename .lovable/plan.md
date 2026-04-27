# Auditoría v8.99.22 — Fase 11 (Colores hardcoded — design system)

## Hallazgo crítico

Un barrido con `grep` sobre todo `src/` detectó **17 ocurrencias de colores Tailwind crudos** (`text-emerald-600`, `text-red-600`, `text-blue-600`, `text-green-600`, `text-emerald-500`) distribuidas en **10 archivos**, todas violando el design system del proyecto que exige el uso de tokens semánticos HSL (`text-success`, `text-destructive`, `text-info`, `text-warning`).

Estos colores crudos rompen:
- **Dark mode**: el verde/rojo crudos se ven sobresaturados frente al tema HSL.
- **Consistencia**: el mismo concepto (profit positivo) se renderiza con dos verdes distintos en pantallas adyacentes.
- **White-label**: bloquea cualquier customización futura del tema por organización.

## Archivos afectados

| Módulo | Archivo | Color crudo |
|---|---|---|
| Cotizaciones | `PasoResumenCotizacion.tsx` | `text-emerald-600`, `text-red-600` (profit) |
| Cotizaciones | `ResumenPL.tsx` | `text-emerald-600`, `text-red-600` (profit) |
| Cotizaciones | `TablaCostosDetalle.tsx` | `text-emerald-600`, `text-red-600` (profit x2) |
| Cotizaciones | `TablaCostosLocal.tsx` | `text-emerald-600`, `text-red-600` (profit x2) |
| Facturación | `HistorialFacturas.tsx` | `text-red-600` PDF, `text-blue-600` XML (con hover) |
| Facturación | `HistorialProformas.tsx` | `text-red-600` PDF, `text-blue-600` XML |
| Facturación | `DialogMarcarFacturada.tsx` | `text-red-600` PDF, `text-blue-600` XML |
| Facturación | `Facturacion.tsx` | `text-red-600` PDF, `text-blue-600` XML |
| Portal | `PortalEmbarqueDocumentos.tsx` | `text-green-600` (estado Validado) |
| Dashboard | `DashboardStatusCards.tsx` | `text-emerald-500`, `text-emerald-600` (arribos) |

## Mapeo de reemplazos

```
text-emerald-600  →  text-success
text-emerald-500  →  text-success
text-green-600    →  text-success
text-red-600      →  text-destructive
text-blue-600     →  text-info
hover:text-red-700  →  hover:text-destructive/80
hover:text-blue-700 →  hover:text-info/80
```

Tokens ya definidos en `tailwind.config.ts` líneas 33, 63, 67, 71.

## Plan de acción

1. Aplicar los reemplazos en los 10 archivos (cambio mecánico, sin lógica nueva).
2. Agregar entrada `v8.99.22` al inicio de `src/content/changelog/v8/chunks/0.ts` documentando el barrido y los archivos normalizados.
3. Verificar `tsc --noEmit` (sin cambios de tipos esperados — solo strings de className).

## Detalles técnicos

- Solo cambios de presentación. Sin tocar DB, hooks, lógica de negocio ni rutas.
- `src/components/ui/toast.tsx` se excluye intencionalmente: usa `text-red-300/400` dentro de la variante `destructive` de shadcn — son parte del sistema base de shadcn y no representan datos del dominio.
- Sin riesgo de regresión visual: los tokens ya se usan exitosamente en `EmbarquesActivosTable`, `ProfitTable` y `TabCostos` (verificados en fases 7-10).
