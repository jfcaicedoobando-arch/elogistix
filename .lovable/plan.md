## Objetivo

Enriquecer `/proformas/:id` mostrando la información que hoy sólo aparece en el PDF y reorganizar el layout para que la lectura sea clara y jerarquizada, sin cambiar la lógica de negocio.

## Info del PDF que hoy NO se ve en la vista

- **Cliente** completo: RFC + dirección (calle, ciudad, estado, CP). En vista sólo aparece `cliente_nombre`.
- **Embarque**: Modo, Tipo, Incoterm, Origen → Destino, Contenedores (número/tipo), Descripción de la mercancía, BL House / HAWB. En vista sólo se ve el expediente.
- **BL Master / MAWB** de la proforma (columna existe pero no se pinta).
- **Términos de pago**: Vigencia (emisión + 30 días), Método de pago ("Transferencia electrónica"), Días de crédito consolidados con Folio factura externa.
- **Timeline de estados**: `enviada_at`, `aceptada_at`, `rechazada_at`, `fecha_facturacion` (con quién aceptó/envió).

## Cambios

### 1. Datos (backend queries)

`src/features/proformas/services/queries.ts` → extender `fetchProformaPorId`:

- Ampliar el `select` para traer también:
  - `clientes:cliente_id (rfc, direccion, ciudad, estado, cp)`
  - `embarques:embarque_id (modo, tipo, incoterm, bl_house, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, descripcion_mercancia, contenedores:embarque_contenedores(numero_contenedor, tipo_contenedor))`
- Tipar `ProformaDetalleFull` con dos campos nuevos `cliente_full` y `embarque_full` (nullables — proformas consolidadas pueden no tener embarque_id).

### 2. Reorganización visual del contenedor `ProformaDetalle.tsx`

Nuevo orden (2 columnas en `md+`, 1 columna en móvil):

```text
┌──────────────────────────────────────────────────────────┐
│ HEADER: nº folio + badges + Total destacado              │
│         Fecha emisión · Vigencia · Expediente · BL       │
│         [Acciones proforma]                              │
├──────────────────────────────┬───────────────────────────┤
│ Facturar a (cliente + RFC +  │ Datos del embarque        │
│ dirección completa)          │ Modo/Tipo/Incoterm/Ruta   │
│                              │ Contenedores + mercancía  │
├──────────────────────────────┴───────────────────────────┤
│ Términos de pago (vigencia, método, días crédito, folio) │
├──────────────────────────────────────────────────────────┤
│ Timeline (emitida / enviada / aceptada / facturada)      │
├──────────────────────────────────────────────────────────┤
│ Conceptos (tabla — sin cambios de columnas)              │
├──────────────────────────────────────────────────────────┤
│ Totales USD / MXN                                        │
├──────────────────────────────────────────────────────────┤
│ Notas                                                    │
├──────────────────────────────────────────────────────────┤
│ Factura asociada                                         │
└──────────────────────────────────────────────────────────┘
```

Aumentar el `max-w-5xl` a `max-w-6xl` para permitir la rejilla de 2 columnas cómoda.

### 3. Componentes nuevos (en `src/features/proformas/components/detalle/`)

Cada uno ≤200 líneas (Power-of-10 #4).

- **`ProformaHeaderCard.tsx`** — número, badges, total destacado, meta (fecha, vigencia, expediente, BL Master, BL House, operador). Sustituye el header actual + `DatosGeneralesCard`.
- **`ClienteBillToCard.tsx`** — nombre, RFC, dirección multi-línea. Fallback a `proforma.cliente_nombre` si no hay `cliente_full`.
- **`EmbarqueDatosCard.tsx`** — modo, tipo, incoterm, origen/destino resueltos con la prioridad Port > Airport > City, ruta, contenedores (reutiliza `resumirContenedores` del PDF extrayéndolo a `src/features/proformas/domain/embarque.ts`), descripción de mercancía. Oculta si es consolidada o no hay embarque.
- **`TerminosPagoCard.tsx`** — vigencia (emisión + 30), método pago ("Transferencia electrónica"), días crédito (`formatDiasCredito`), folio factura externa.
- **`TimelineProforma.tsx`** — línea horizontal con puntos: Emitida → Enviada → Aceptada/Rechazada → Facturada. Muestra timestamp bajo cada punto y `nombreDesdeEmail(aceptada_por/enviada_por)`. Estados sin fecha aparecen apagados.

Se conservan y se reordenan los ya existentes `TotalesCard`, `NotasCard`, `FacturaAsociadaCard`, `AccionesProforma`, `EstadoBadges`, `TotalDestacado` (los reagrupamos dentro del nuevo header).

### 4. Helper compartido

Extraer `vigenciaPlus30` y `resumirContenedores` de `src/pdf/documents/ProformaHeader.tsx` a `src/features/proformas/domain/proforma.ts` (o nuevo `proformaHeaderHelpers.ts`) para reutilizar sin duplicar lógica y sin cambiar el PDF.

### 5. Housekeeping

- Bump `APP_VERSION` a `13.164.0`.
- Entrada en `CHANGELOG.md` bajo `[13.164.0]`: `feat(proformas): vista de detalle enriquecida — cliente completo, embarque, términos de pago, timeline; nueva rejilla 2 columnas.`

## Fuera de alcance

- No se modifica el PDF ni el flujo de creación/envío/aceptación.
- No se agregan campos nuevos en la BD (todo ya está persistido).
- No se toca la tabla de conceptos ni el cálculo de totales.

## Detalles técnicos

- Los `bl_house`, `descripcion_mercancia`, `modo`, `tipo`, `incoterm`, contenedores, etc. ya viven en `embarques` / `embarque_contenedores` y se pueden traer en el mismo `select` sin N+1.
- `EmbarqueDatosCard` respetará la memoria "Priority: Port > Airport > City" para resolver origen/destino.
- El timeline usará el memory rule de manejo de fechas (`formatDate` con locale es-MX ya existente).
- El nuevo card layout usa tokens semánticos (`bg-card`, `text-muted-foreground`, `text-accent`) — no hex hardcodeados.
