# Catálogo de productos/servicios para cotizaciones

Sí, tu razonamiento tiene todo el sentido. Hoy `catalogo_claves_sat` es solo un mapeo texto→clave SAT que actúa como resolver al facturar. La idea es evolucionarlo a un **catálogo maestro de productos/servicios** que además controle qué se puede vender.

## Analogía rápida

Piensa en el catálogo como el **menú de un restaurante**: el mesero (vendedor) sólo puede capturar platillos que están en el menú. Cada platillo trae precargado su categoría fiscal (clave SAT), si lleva IVA y qué unidad usa. Los tickets viejos (cotizaciones históricas) siguen intactos, pero cualquier ticket nuevo tiene que elegir del menú.

## Alcance confirmado

- **Extender** `catalogo_claves_sat` (no crear tabla nueva).
- **Estricto**: en cotizaciones nuevas sólo se elige de la lista, sin texto libre.
- **Campos**: nombre visible, clave SAT, tipo IVA (16%/0%/exento), unidad SAT.
- **Históricos**: no se tocan.

## Cambios de base de datos

Migración única sobre `catalogo_claves_sat`:

1. Renombrar semánticamente sin romper: mantener columna `patron` como **`nombre`** (alias lógico, seguirá llamándose `patron` en BD para no romper el resolver; la UI lo mostrará como "Producto/Servicio"). El unique index por org ya garantiza no duplicados.
2. Agregar columnas:
   - `tipo_iva text NOT NULL DEFAULT 'gravado_16'` con CHECK (`'gravado_16' | 'tasa_0' | 'exento'`).
   - `tasa_iva_default numeric` (0.16, 0.00 o NULL para exento; derivada del tipo).
   - `clave_unidad_sat text NOT NULL DEFAULT 'E48'` (E48 = Unidad de Servicio, default).
   - `nombre_unidad text` (para mostrar, opcional).
3. Backfill: todas las filas actuales quedan `gravado_16` / `E48`.
4. Nuevo RPC `resolver_producto_sat(p_org, p_nombre_exacto)` que devuelve la fila completa (clave SAT, tipo IVA, tasa, unidad) — usado al insertar en cotización.
5. El resolver actual `resolver_clave_sat` (por ILIKE) se conserva sólo como fallback para facturas desde proformas viejas.

**No se agrega columna a `conceptos_venta`.** Al insertar concepto de cotización, el frontend selecciona un producto del catálogo y guarda los campos derivados (descripción = nombre del producto, tipo_iva, tasa_iva_aplicada). Esto respeta históricos.

## Cambios en la UI

### Módulo Configuración → tarjeta actual `CatalogoClavesSATCard`

Se renombra a **"Catálogo de productos y servicios"** y se le agregan columnas al formulario/tabla:
- Nombre (antes "Patrón").
- Clave SAT.
- Tipo IVA (select: 16% / 0% / Exento).
- Clave unidad SAT (select con las más comunes: E48 Servicio, XPP Paquete, KGM Kilogramo, TNE Tonelada, H87 Pieza).
- Activo, prioridad, notas.

Validación: nombre único por org (case-insensitive, ya está el index).

### Wizard/editor de cotizaciones

Reemplazar el `Input` de texto libre para descripción del concepto por un **`ProductoServicioSelect`** (Command/Combobox con búsqueda) que:
- Lista productos activos del catálogo de la org.
- Al elegir uno: autocompleta descripción (=nombre), guarda `tipo_iva` y `tasa_iva_aplicada` derivados. Cantidad, precio unitario y moneda siguen siendo capturados manualmente.
- No permite guardar el renglón si no hay producto seleccionado (modo estricto).
- Si el catálogo está vacío, muestra un aviso con link a Configuración y bloquea agregar renglones.

### Editor de facturas

No cambia el flujo actual — sigue usándose el resolver por patrón para conversiones de proformas viejas. Facturas manuales nuevas también pueden usar el nuevo select (opcional, ver "Fuera de alcance").

## Cambios en servicios/RPC

- `crearConceptoVenta` (o equivalente al insertar en `conceptos_venta`): recibe `producto_id` en vez de `descripcion` cruda; hace un fetch al catálogo y guarda los campos derivados.
- `convertir_proformas_a_factura`: sin cambios (sigue usando `resolver_clave_sat` como fallback para históricos).
- Cotizaciones existentes con conceptos texto libre: se muestran tal cual en modo lectura; si el usuario intenta **agregar** un renglón nuevo a una cotización vieja, aplica la regla estricta.

## Detalles técnicos

- Componente nuevo: `src/features/cotizaciones/components/ProductoServicioSelect.tsx` (usando `Command` de shadcn, filtrando por `nombre ILIKE`).
- Hook: `useProductosCatalogo(organizationId)` con react-query, cache 5min.
- Migración: `supabase/migrations/*_catalogo_productos_extend.sql`.
- Tipo TypeScript: extender `Row` en `CatalogoClavesSATCard.tsx` y agregar tipo `ProductoCatalogo` en `src/features/configuracion/types.ts`.
- Actualizar el select del wizard donde hoy se captura descripción del concepto (típicamente en el paso "Conceptos" del wizard de cotización).
- Bump `APP_VERSION` a **13.169.0** y entrada en `CHANGELOG.md`.

## Fuera de alcance (para confirmar en otro turno si lo quieres)

- Precios sugeridos por producto (dijiste sólo nombre/clave/IVA/unidad).
- Categorías / agrupación.
- Aplicar la restricción estricta también a facturas manuales.
- Backfill que mapee conceptos históricos a productos.

## Riesgos

- Cotizaciones viejas mostrarán descripciones que no existen en el catálogo — se despliegan sin problema (lectura), pero al editar un renglón viejo el usuario deberá elegir un producto del catálogo. Aviso claro en el editor.
- Si dos organizaciones tienen productos con el mismo nombre, no hay colisión: el unique index es por `(organization_id, lower(patron))`.
