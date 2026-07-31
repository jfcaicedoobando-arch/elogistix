# Ronda 7 UI/UX — patrones adaptados a Libre Carga

El documento subido pertenece a otro ERP (LiftGo, renta de montacargas). Sus migraciones y diffs no aplican aquí: no existen `src/features/fleet`, `forklifts`, `src/features/portal/pages/*` ni las tablas que tocan. Lo que sí es reutilizable son los **patrones UI/UX** de la ronda. Este plan los traduce a los módulos equivalentes de Libre Carga, sólo en capa de presentación.

Nada de SQL, nada de reglas de negocio.

## Lo que ya está verificado en el código

- `src/lib/formatters/dates.ts` no fija zona horaria en `formatDateTimeShort`, `formatFechaHora` ni `formatFechaLarga`: la fecha/hora se renderiza en la zona del navegador, así que un usuario fuera de México puede ver un día distinto al del listado.
- No hay ningún `overflow-x-auto` en `src/features/portal`, pero sí hay 4 componentes con `<Table>`: el desglose de factura, documentos del embarque, timeline y tarjeta de documento. A 402–698 px las columnas se cortan.
- El portal **ya** tiene barra inferior de navegación (`PortalBottomNav`), filtros móviles y estados vacíos con CTA — esos puntos de la ronda 7 ya están cubiertos y no se tocan.
- `EmptyState` ya soporta acción primaria y secundaria, pero en Facturas y Embarques del portal el título/descripción siempre dicen "No se encontraron… ajusta los filtros", incluso cuando el cliente aún no tiene ningún registro. Cotizaciones sí distingue ambos casos.

## Cambios propuestos

### 1. Zona horaria fija America/Mexico_City (equivale a R7-FE-02)
Fijar `timeZone: "America/Mexico_City"` como default en los formateadores de fecha/hora, con opción de sobrescribir. Así el detalle y el listado siempre muestran el mismo día, independientemente de la laptop del usuario. Se añaden tests con reloj congelado y `TZ` simulada.

### 2. Tablas del portal con scroll horizontal (equivale a R7-FE-05)
Envolver las 4 tablas del portal en un contenedor con scroll horizontal y ancho mínimo, para que a 402 y 698 px no se corten importes ni fechas.

### 3. Estados vacíos "primera vez" vs "sin resultados" (equivale a R7-FE-06)
En Facturas y Embarques del portal, distinguir los dos casos igual que ya hace Cotizaciones: sin registros → mensaje de bienvenida orientado a qué esperar; con filtros activos → "ajusta los filtros" + botón de limpiar.

### 4. Objetivos táctiles ≥44 px en el portal (equivale a R7-FE-08/09)
Auditar en 402 px los controles del portal (menú de usuario, campanita, botones de descarga, toggles de vista, barra inferior) con captura real y subir a alto/ancho mínimo táctil sólo los que midan menos de 44 px. Sin rediseño, sólo tamaño y área de toque.

### 5. Nombres accesibles y microcopy (equivale a R7-FE-07 b/c/d)
Barrido acotado: `Select` sin etiqueta accesible en el portal, y textos crudos en inglés o sin acento que se muestren al cliente. Se corrige sólo lo que aparezca en pantalla del portal.

## Fuera de alcance

- Las 3 migraciones (folios, cartera vencida, saneo de flota) y su apéndice de seed: son de otra base de datos.
- Badges derivados de flota, `repaired_at`, kanban de mantenimiento, catálogos de equipo: no existen en Libre Carga.
- Cambios de lógica de negocio, RLS o cálculo financiero.

## Detalles técnicos

- Archivos: `src/lib/formatters/dates.ts` (+ tests en `src/lib/formatters/__tests__`), `src/features/portal/components/factura/PortalFacturaConceptosTable.tsx`, `PortalEmbarqueDocumentos.tsx`, `PortalEmbarqueTimeline.tsx`, `PortalDocumentoCard.tsx`, `src/features/portal/routes/PortalFacturas.tsx`, `PortalEmbarques.tsx`, y los componentes de `src/features/portal/components/layout/` que fallen la medición táctil.
- Verificación: capturas Playwright a 402, 698 y 1366×768 antes/después; `bun run typecheck` y los tests unitarios de formateadores.
- Cierre: entrada en `CHANGELOG.md` y bump de `APP_VERSION` a `13.372.0`.
