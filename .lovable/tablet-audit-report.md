# Auditoría tableta 768×1024 · Libre Carga

**Fecha:** 2026-07-05 · **Viewport:** 768×1024 (iPad vertical) · **Rutas:** 14 (operativo + financiero).
**Método:** Playwright headless con login `hector@lopezbenavides.com`, medición de scrollWidth vs clientWidth por ruta.

## Resultado global

| Ruta | Errores consola | Overflow `<main>` | Tablas con scroll horizontal | Estado |
|---|---|---|---|---|
| `/inicio` | 0 | 0 | 3 (chips internos ok) | ✅ |
| `/operaciones` | 0 | 0 | 0 | ✅ |
| `/embarques` | 0 | 0 | 1 (tabla listado) | 🟡 aceptable |
| `/cotizaciones` | 0 | 0 | 1 | ✅ tras fix |
| `/proformas` | 0 | 0 | 1 | 🟡 aceptable |
| `/facturacion` | 0 | 0 | 1 | ✅ tras fix |
| `/compras` | 0 | 0 | 0 | ✅ |
| `/cxp` | 0 | 0 | 1 | ✅ tras fix |
| `/cartera` | 0 | 0 | 1 | ✅ (arreglado 13.172.3) |
| `/tesoreria` | 0 | 0 | 0 | ✅ tras fix |
| `/profit/dashboard` | 0 | 0 | 0 | ✅ tras fix |
| `/profit/proyeccion` | 0 | 0 | 1 | ✅ |
| `/clientes` | 0 | 0 | 1 | 🟡 aceptable |
| `/proveedores` | 0 | 0 | 1 | 🟡 aceptable |

**Cero errores de consola, cero overflow horizontal del `<main>`.** El scroll horizontal remanente es intencional dentro de tablas densas con sticky de la primera columna.

## Fixes aplicados en 13.172.4

1. **`src/components/shared/PageHeader.tsx`** — El header apila título + acciones hasta `lg` (antes `md`). Esto arregla títulos truncados en **~25 páginas** con muchos botones: `Tesorería` ("T…" → "Tesorería"), `Cotizaciones` (descripción truncada → completa), `Profit / Dashboard Ejecutivo` ("Dashboard Eje…" → completo), `Cuentas por Pagar`, etc.
2. **`src/features/facturacion/components/HuecoFacturacionChip.tsx`** — Los montos "· USD… · MXN…" del chip se ocultan hasta `lg`. Antes rompían la fila de tabs "Emitidas / Notas de crédito" empujándolas.
3. **`src/features/cotizacion/routes/Cotizaciones.tsx`** — KPIs pasan a `xl:grid-cols-4` (2 columnas en tableta). Antes "Total…/Acep…/Rech…/Tasa …" quedaban truncados en 4 columnas apretadas.
4. **`src/features/cxp/components/CxpKpiCards.tsx`** — Mismo patrón, KPIs a `xl:grid-cols-4` para que "Por pagar MXN · 2 facturas" queden legibles.

## Impacto

- El fix del `PageHeader` es transversal: al ser el componente base de encabezado, remedia el mismo problema en todas las rutas de la app sin tocarlas una por una (patrón "fix the category, not the instance").
- No se modificó lógica de datos, hooks, RLS ni queries.
- Sin dependencias nuevas.

## Verificado

- Capturas `/tmp/tablet-audit/shots/*.png` re-generadas tras cada fix.
- 0 errores de consola en las 14 rutas.
- `main` sin scroll horizontal (720 = 720 en todos los casos).

## Fuera de alcance (queda para futuras iteraciones)

- Densidad de tablas: la tabla de `/embarques`, `/proformas`, `/clientes`, `/proveedores` sigue con scroll horizontal interno; funciona pero podría optimizarse ocultando columnas secundarias `hidden xl:table-cell`.
- Detalles y modales por ruta (`/cotizaciones/:id`, wizards de nueva factura/cotización) — no auditados en profundidad este turno.
- Portal cliente/agente y `/admin/*` — expresamente fuera del alcance acordado.
