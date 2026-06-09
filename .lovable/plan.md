# Iteración 2 — Cotización informativa (tarifario)

## Concepto

Se añade un segundo tipo de cotización: **informativa** (tarifario). Sirve sólo como referencia comercial: lista N rutas/servicios con sus tarifas vigentes durante un período. **No se convierte en embarque**. La cotización tradicional ("transaccional") sigue funcionando idéntica.

Esto **reemplaza** la multi-ruta terrestre pendiente: la necesidad de comparar varias rutas se cubre con la informativa.

## Modelo de datos

Migración a `public.cotizaciones`:

- `tipo_documento text not null default 'transaccional'` — valores: `'transaccional' | 'informativa'`.
- `vigencia_desde date null` — sólo informativa.
- `vigencia_hasta date null` — sólo informativa.
- `tarifas_informativas jsonb not null default '[]'` — array de filas tarifa:
  ```
  {
    id, modo, modalidad_equipo, origen, punto_intermedio, destino,
    tipo_contenedor, unidad_medida, precio, moneda, notas
  }
  ```
- Índice parcial en `(organization_id, tipo_documento)` para listados.
- Constraint suave vía trigger: si `tipo_documento='informativa'` ⇒ requiere `vigencia_desde`, `vigencia_hasta`, al menos 1 fila en `tarifas_informativas`; bloquea conversión a embarque.

No se toca `cotizacion_costos` ni `conceptos_venta` (siguen siendo de la transaccional).

## Flujo UI

**Punto de entrada** (`/cotizaciones/nueva`): primer paso pide elegir tipo:
- **Transaccional** → wizard actual sin cambios.
- **Informativa** → wizard reducido nuevo (3 pasos).

**Wizard informativa:**
1. **Datos generales**: cliente/prospecto, operador, vigencia desde/hasta, notas.
2. **Tarifas**: tabla editable de N filas (agregar/eliminar/reordenar). Por fila: modo, modalidad de equipo (si terrestre), origen, punto intermedio (si Porta Contenedor), destino, tipo de contenedor (si marítimo FCL), unidad de medida, precio, moneda. Permite mezclar modos en una misma informativa.
3. **Resumen + guardar** (sin sección de costos/utilidad, sin conceptos_venta, sin IVA detallado por concepto — sólo precios listados).

**Listado de cotizaciones**: columna y filtro por **Tipo** (Transaccional / Informativa). Badge visual distinto.

**Detalle informativa**:
- Sin botones "Convertir a embarque" ni "Crear borrador".
- Botón principal: **Descargar PDF tarifario**.
- Acción secundaria: **"Generar cotización transaccional"** que abre el wizard normal precargado con una fila elegida (queda para iteración futura si lo prefieres; en esta iteración sólo se documenta como no implementado).

## PDF tarifario

Nuevo documento `TarifarioDocument`:
- Encabezado con marca, vigencia (DD/MM/YYYY – DD/MM/YYYY), cliente.
- Tabla comparativa de tarifas (una fila por servicio).
- Bloque de notas y condiciones generales.
- Reutiliza `BrandHeader`, `DataTable`, `Footer`.

## Validaciones y reglas

- `validatePaso1` y demás validadores actuales sólo aplican a transaccional.
- Validador nuevo `validateInformativa`: cliente o prospecto, vigencia_desde ≤ vigencia_hasta, ≥1 fila válida (origen, destino, precio > 0, moneda).
- Conversión a embarque (`crearEmbarqueBorradorDesdeCotizacion`, `convertirCotizacionAEmbarques`) bloqueada server-side cuando `tipo_documento='informativa'`.
- Permisos: misma matriz que cotización transaccional (rol comercial/operador puede crearlas).

## Detalles técnicos

- **Migración** `supabase/migrations/...`: agrega columnas + trigger validador + backfill (`update cotizaciones set tipo_documento='transaccional' where tipo_documento is null`). Sin GRANT nuevos (la tabla ya tiene RLS+grants).
- **Tipos**:
  - `src/types/cotizacion.ts`: agregar `tipo_documento`, `vigencia_desde`, `vigencia_hasta`, `tarifas_informativas: TarifaInformativa[]` a `CotizacionRow` y `CreateCotizacionInput`.
  - Nuevo `src/types/cotizacionInformativa.ts` con `TarifaInformativa` y defaults.
  - `CotizacionFormValues` extendida con bloque opcional informativa.
- **Mappers**: `cotizacionForm.ts` y `cotizacion.ts` mapean nuevos campos; cuando `tipo_documento='informativa'` forzar `incoterm='N/A'`, `tipo_movimiento=''`, `tipo_carga` libre, sin costos.
- **Payload builders** (`payloadBuilders.ts`): nuevo `buildCotizacionInformativaInsertPayload` separado para mantener funciones cortas (Power of 10).
- **Servicios**:
  - `src/services/cotizacion/mutations/crearInformativa.ts` (nuevo).
  - Bloqueos en `conversiones/embarques.ts` si tipo_documento != 'transaccional'.
- **UI**:
  - `src/pages/cotizaciones/NuevaCotizacion.tsx`: selector de tipo de documento al inicio (modal o paso 0).
  - Nuevo `src/components/cotizacion/informativa/WizardInformativa.tsx` (≤200 líneas) + subcomponentes `SeccionTarifasInformativas.tsx`, `FilaTarifaEditor.tsx`.
  - Listado `Cotizaciones.tsx`: añadir columna y filtro tipo_documento.
  - `EditarCotizacion.tsx`: rutear al wizard correcto según tipo.
- **PDF**: `src/pdf/documents/TarifarioDocument.tsx` + test snapshot mínimo.
- **Hooks**:
  - `useCotizacionWizardForm` queda como está (transaccional).
  - Nuevo `useCotizacionInformativaForm` paralelo.
- **Constantes** `src/constants/cotizacionInformativa.ts`: monedas, unidades de medida sugeridas.
- **Memoria** `mem://features/cotizacion-informativa`: nueva entrada en índice describiendo el flag y bloqueos.
- **Versionado**: `APP_VERSION` → `12.68.0`, entrada en `CHANGELOG.md`.

## Fuera de alcance (siguiente iteración)

- "Generar cotización transaccional desde fila de tarifario".
- Vigencia/override por fila (hoy es vigencia global de cabecera).
- Renovación automática o versionado histórico de tarifarios.
- Publicación al portal del cliente (se evalúa después).
