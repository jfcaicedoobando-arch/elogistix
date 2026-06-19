## Objetivo

Hacer del **embarque la fuente de verdad de costos**, sin perder la promesa al cliente cotizada. Cuando la tarifa vinculada a la cotización ya no esté vigente o cambió de precio al momento de crear el embarque, la app debe:

1. Detectarlo automáticamente.
2. Avisar y pedir decisión a operaciones.
3. Si el delta es relevante, exigir re-aprobación de ventas antes de crear el embarque.
4. Dejar trazabilidad completa del cambio.

---

## Cambios funcionales

### 1. Revalidación al convertir cotización → embarque

Antes de ejecutar `crearEmbarqueBorradorDesdeCotizacion` / `convertirCotizacionAEmbarques`:

- Leer `cotizacion.tarifa_id` y compararlo contra `costeo_tarifas_vigentes_v` + `costeo_tarifa_recargos`.
- Calcular diferencias por concepto: precio antes vs precio hoy, recargos nuevos/eliminados, agente disponible, vigencia de carta garantía, vencimiento de tarifa.
- Resultado en 3 categorías:
  - **Sin cambios** → conversión directa, como hoy.
  - **Cambios menores** (delta ≤ umbral configurable, default 5% del costo total) → modal informativo, operaciones decide mantener o refrescar.
  - **Cambios mayores** (delta > umbral, tarifa vencida, agente sin cupo) → bloquea conversión hasta que **ventas re-apruebe** desde la cotización.

### 2. Modal de revalidación (operaciones)

Se muestra al hacer clic en "Crear embarque" desde una cotización aceptada:

- Tabla comparativa: concepto, costo cotizado, costo vigente, delta MXN/USD, % impacto.
- Avisos: "Tarifa vencida el DD/MM/YYYY", "Agente X marcó sin cupo", "Carta garantía vencida".
- Acciones disponibles según severidad:
  - Mantener costos cotizados (delta absorbido).
  - Refrescar desde tarifa vigente actual.
  - Elegir otra tarifa del módulo Costeo (reabre `BuscarTarifaDialog`).
  - Si delta > umbral: sólo "Solicitar re-aprobación a ventas".

### 3. Flujo de re-aprobación de ventas

- Se crea una **notificación interna** al operador comercial dueño de la cotización (`cotizaciones.operador`) con el delta calculado.
- La cotización pasa a estado intermedio `"Revisión por cambio de tarifa"` (nuevo valor en enum, no destructivo).
- En el detalle de cotización aparece banner amarillo + acciones:
  - **Re-cotizar con tarifa vigente** → actualiza `conceptos_venta` y `cotizacion_costos`, regenera PDF, marca para reenvío al cliente.
  - **Mantener precio al cliente** → autoriza absorber el delta; operaciones puede crear el embarque conservando los costos originales.
- Ambas acciones quedan en `bitacora_actividad` y desbloquean la conversión.

### 4. Trazabilidad en el embarque

Nuevas columnas en `embarques`:

- `tarifa_id_original UUID` — la cotizada (FK a `costeo_tarifas`, ON DELETE SET NULL).
- `tarifa_id_aplicada UUID` — la que efectivamente se usó al crear el embarque (puede ser igual, otra, o null si fue manual).
- `tarifa_delta_jsonb JSONB` — snapshot del diferencial al momento de la conversión (concepto, antes, después, delta).
- `tarifa_decision TEXT` — `"sin_cambios" | "mantenida_por_operaciones" | "refrescada" | "sustituida" | "reaprobada_ventas"`.

En el detalle del embarque, sección "Origen": mostrar de dónde vino cada costo y el historial de decisión.

### 5. Badges y visibilidad temprana

- En **lista de cotizaciones aceptadas**: badge `⚠ Tarifa vencida` o `⚠ Precio cambió` calculado en tiempo real vía la misma vista de revalidación.
- En **dashboard de operaciones**: contador "Cotizaciones aceptadas con tarifa desactualizada".
- En **dashboard comercial**: contador "Cotizaciones esperando mi re-aprobación".

### 6. Configuración global

Nueva entrada en `configuracion`:

- `tarifa_revalidacion_umbral_pct` (default 5).
- `tarifa_revalidacion_bloquea_si_vencida` (default true).

Editable desde `/admin/configuracion` por el rol admin de la organización.

---

## Detalles técnicos

**Capas a tocar (en orden):**

1. **DB** (`supabase--migration`):
  - `ALTER TABLE embarques ADD COLUMN tarifa_id_original`, `tarifa_id_aplicada`, `tarifa_delta_jsonb`, `tarifa_decision`.
  - Backfill: `UPDATE embarques SET tarifa_id_original = tarifa_id_aplicada = cot.tarifa_id, tarifa_decision = 'sin_cambios'` desde `cotizaciones`.
  - Agregar valor `"Revisión por cambio de tarifa"` al check/enum de `cotizaciones.estado`.
  - Nueva RPC `revalidar_tarifa_cotizacion(p_cotizacion_id uuid) returns jsonb` (SECURITY DEFINER, scoped por organización) que devuelve `{ estado, delta, conceptos[], avisos[] }`.
  - Actualizar `crear_embarque_borrador_desde_cotizacion` para aceptar `p_decision` y `p_tarifa_id_aplicada` y persistir las nuevas columnas.
2. **Servicios** (`src/features/cotizacion/services/`):
  - `revalidacionTarifa.ts` — wrapper de la RPC.
  - Modificar `conversiones/embarques.ts` para recibir `decision` y `tarifa_id_aplicada`.
  - Hook `useRevalidarTarifaCotizacion`.
3. **UI**:
  - `RevalidarTarifaModal.tsx` (nuevo) en `src/features/cotizacion/components/conversion/`.
  - Integrarlo en el botón "Crear embarque" de `CotizacionDetalle.tsx` y de la lista.
  - Banner + acciones de re-aprobación en `CotizacionDetalle.tsx`.
  - Badge en columnas de lista de cotizaciones.
  - Sección "Origen de costos" en `EmbarqueDetalle.tsx`.
  - Widgets de conteo en dashboards.
4. **Bitácora + notificaciones**:
  - Insertar evento `tarifa_revalidada` en `bitacora_actividad` con `delta` en metadata.
  - Crear notificación interna a `operador` cuando se solicita re-aprobación.
5. **Tests**:
  - Unit: cálculo de delta (sin cambios, menor, mayor, tarifa vencida, agente sin cupo).
  - Integration: flujo completo de revalidación → re-aprobación → creación de embarque con cada `decision`.
  - RLS: la RPC sólo regresa datos de la organización del usuario.
6. **Memoria + changelog**:
  - Bump `APP_VERSION` a `13.70.0` (cambio funcional mayor).
  - Entry en `CHANGELOG.md`.
  - Nuevo `mem://features/revalidacion-tarifa-embarque` y referencia en `mem://index.md`.

---

## Fuera de alcance (lo dejo explícito)

- No se re-sincroniza la tarifa automáticamente sin intervención humana.
- No se modifican embarques ya creados retroactivamente; el snapshot vive.
- No se cambia el modelo 1↔N de contenedores.
- No se agrega notificación por email; sólo notificación interna (se puede agregar después).

Qué pasa con el tab de conciliación, ahí los datos de la cotización son los importantes para después ver la desviación de lo cotizado contra el costo real. 