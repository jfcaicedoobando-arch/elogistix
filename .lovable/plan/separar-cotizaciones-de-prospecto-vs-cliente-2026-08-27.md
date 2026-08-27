# Separar cotizaciones de prospecto vs. cliente

## Lo que ya existe (confirmado en BD)

La tabla `cotizaciones` ya tiene todo lo necesario para distinguir:

- `es_prospecto` (boolean): cotización a prospecto, sin alta de cliente.
- `prospecto_empresa / prospecto_contacto / prospecto_email / prospecto_telefono`: datos del prospecto sin contaminar el catálogo de clientes.
- `oportunidad_id`: vínculo al pipeline del CRM.
- `DialogConvertirProspecto.tsx`: flujo de conversión prospecto → cliente ya iniciado.

Es decir: **una sola tabla, dos mundos**. El prospecto cotiza sin ser cliente; al aceptar, se convierte. Lo que falta es hacer visible y operativa esa separación.

## Analogía

Es como la bandeja de un restaurante: las cotizaciones a prospecto son "cotizaciones de mostrador" (rápidas, muchas, descartables); las de cliente son "banquetes" (detalladas, con historial). Misma cocina, pero no revuelves los tickets en la misma pila.

## Cambios propuestos

### 1. Segmentación en el listado de cotizaciones
- Tabs o filtro segmentado en la vista principal: **Clientes** (default) | **Prospectos** | **Todas**, usando `es_prospecto`.
- Badge "Prospecto" en la columna cliente cuando `es_prospecto = true` (muestra `prospecto_empresa` en lugar del cliente).
- Los KPIs de la página (`CotizacionesKpis`) se calculan por segmento: tasa de conversión y cotizaciones enviadas de prospectos no se mezclan con el pipeline de clientes activos.

### 2. Folios distinguibles (opcional, recomendado)
- Prefijo distinto en el folio para cotizaciones a prospecto (ej. `COT-P-000123` vs `COT-000123`), vía `folio_secuencias` con secuencia separada. Facilita identificarlas en PDF y correos.

### 3. Refuerzo de la regla de negocio (BD)
- Validación (trigger o CHECK vía trigger, según reglas del proyecto): si `es_prospecto = true`, `cliente_id` debe ser NULL y `prospecto_empresa` obligatoria; si `es_prospecto = false`, `cliente_id` obligatorio. Hoy ambos campos son nullable sin candado.
- Al convertir prospecto → cliente (alta oficial por el módulo de Clientes), las cotizaciones del prospecto se re-vinculan: `cliente_id` nuevo, `es_prospecto = false`, conservando historial.

### 4. CRM: embudo limpio
- Vista de la oportunidad muestra sólo sus cotizaciones (ya vía `oportunidad_id`).
- Reporte "cotizaciones sin respuesta" (`cotizacionesSinRespuesta.ts`) filtrable por segmento para seguimiento de prospectos.

### 5. Sin cambios de permisos
- Las RLS actuales por organización ya cubren ambos tipos; no se tocan políticas salvo el trigger de validación del punto 3.

## Detalles técnicos

- Tabla: `public.cotizaciones` (sin nuevas tablas; se reutilizan columnas existentes).
- Archivos principales: `src/features/cotizacion/components/CotizacionesFilterSelects.tsx`, `CotizacionesKpis.tsx`, `cotizacionesColumns.tsx`, servicios de listado en `src/features/cotizacion/services/`.
- Migración nueva: trigger de validación prospecto/cliente + secuencia de folio `COT-P` (si se aprueba el punto 2), con GRANTs y RLS según estándar.
- Tests: casos de validación del trigger y del filtro por segmento.
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION`.

## Verificación

- Listado muestra tabs Clientes/Prospectos con conteos correctos.
- No se puede guardar cotización de prospecto sin empresa ni de cliente sin `cliente_id`.
- Al convertir un prospecto, sus cotizaciones históricas quedan ligadas al cliente nuevo.
