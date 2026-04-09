

# Detalle de Cotización en Portal de Clientes

## Problema
Las cards de cotizaciones en el portal no son clickeables porque no existe una página de detalle ni una ruta para `/portal/cotizaciones/:id`.

## Plan

### 1. Crear página `PortalCotizacionDetalle.tsx`
Vista de solo lectura adaptada del `CotizacionDetalle.tsx` interno, mostrando:
- Encabezado: folio, estado (badge), nombre del cliente
- Datos generales: modo, tipo, incoterm, origen, destino, vigencia, tiempo de tránsito
- Mercancía (reutilizar `SeccionMercanciaCotizacionDetalle`)
- Conceptos de venta USD y MXN (reutilizar `TablaConceptosGenerico`)
- Resumen de totales (reutilizar `ResumenTotalesCotizacion`)
- Notas (si existen)
- **Sin** acciones de cambio de estado, edición, P&L interno ni generación de embarques

### 2. Agregar hook `usePortalCotizacion` en `usePortalData.ts`
Query individual: `select("*")` de `cotizaciones` filtrado por `id` y validando que el `cliente_id` pertenezca al usuario.

### 3. Agregar ruta en `App.tsx`
Nueva ruta `/portal/cotizaciones/:id` → `PortalCotizacionDetalle`.

### 4. Hacer clickeables las cards en `PortalCotizaciones.tsx`
Agregar `onClick` + `useNavigate` para navegar a `/portal/cotizaciones/${c.id}`. Estilo cursor-pointer y hover.

### 5. Changelog
Nueva entrada v7.8.0.

## Archivos
| Archivo | Cambio |
|---|---|
| `src/pages/portal/PortalCotizacionDetalle.tsx` | **Nuevo** — vista de detalle solo lectura |
| `src/hooks/usePortalData.ts` | Nuevo hook `usePortalCotizacion` |
| `src/App.tsx` | Ruta `/portal/cotizaciones/:id` |
| `src/pages/portal/PortalCotizaciones.tsx` | Cards clickeables con navigate |
| `src/pages/Changelog.tsx` | Nueva entrada |

