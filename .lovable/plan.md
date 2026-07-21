## Contexto

En la pestaña **Garantías** del embarque, la columna 4 ("Depósito USD") es un input editable enlazado a `embarque_garantias_contenedor.monto_deposito_usd`. Hoy la fila de garantía se crea automáticamente cuando se agrega un contenedor mediante el trigger `crear_garantia_contenedor()`, que **sólo mira `costeo_navieras_condiciones`** matcheando por `naviera_id` a partir del nombre `embarques.naviera`. Nunca consulta la tarifa (`costeo_tarifas`) que se usó al convertir la cotización en embarque, aunque el embarque sí guarda `tarifa_id_aplicada` / `tarifa_id_original`.

Verificado en BD para el embarque abierto en el preview (`e7558e76…`):
- `naviera = "WHLC"`, `tarifa_id_aplicada = NULL`, `tarifa_id_original = NULL`, `cotizacion.tarifa_id = NULL` (embarque legacy sin tarifa formal).
- No existe fila en `costeo_navieras_condiciones` para Wan Hai en la organización → por eso la columna aparece vacía.

**Analogía:** hoy es como si al abrir un pedido nuevo copiáramos el precio del catálogo general de la marca; queremos que primero mire el contrato específico (la tarifa) que se cotizó, y sólo si no hay contrato caiga al catálogo general.

## Cambios propuestos

### 1. Extender la fuente de precarga en el trigger de garantías

Modificar `crear_garantia_contenedor()` (función usada por el trigger `trg_crear_garantia_contenedor` de `embarque_contenedores`) para resolver los datos en este orden de prioridad:

1. **Tarifa aplicada al embarque** (`embarques.tarifa_id_aplicada` → `costeo_tarifas`) para obtener `naviera_id` sin depender del match por texto y para leer `dias_libres_demoras` específico.
2. **Condición de la naviera** (`costeo_navieras_condiciones` por ese `naviera_id`) para `deposito_contenedor_usd`, `tiene_carta_garantia`, `carta_garantia_vigente_hasta` y `dias_libres_demoras_default` como fallback.
3. Comportamiento actual (match por nombre en `embarques.naviera`) como último fallback, para no romper embarques legacy sin tarifa.

Reglas mantenidas:
- Si hay carta garantía vigente → `monto=0`, `estado='liberado'`.
- Si no hay ninguna fuente → `monto=0`, `estado='pendiente'` (igual que hoy).

### 2. Alinear el cálculo de "fecha límite devolución"

Ajustar `calc_fecha_limite_devolucion_garantia()` para preferir `costeo_tarifas.dias_libres_demoras` (per-tarifa) sobre `costeo_navieras_condiciones.dias_libres_demoras_default` (per-naviera org-wide) cuando el embarque tenga tarifa aplicada. Esto respeta overrides de tarifa que hoy se ignoran silenciosamente.

### 3. RPC de repoblado manual (para filas ya creadas)

Nueva RPC `refrescar_garantia_desde_tarifa(p_embarque_id uuid)` (SECURITY DEFINER, permisos por membresía) que:
- Recorre las garantías del embarque cuyo `estado = 'pendiente'` (para no pisar depósitos ya movidos; el trigger `_garantia_congelar_monto_trg` ya bloquea cambios en otros estados).
- Aplica la misma lógica de resolución (tarifa → condición → nombre) y actualiza `monto_deposito_usd`, `tiene_carta_garantia`, `naviera_id`.

Esto permite "reprocesar" embarques legacy o casos donde la tarifa/condición se configura después.

### 4. UI: botón "Precargar desde tarifa" en la tab

En `TabGarantias.tsx`, agregar un botón secundario visible cuando `canEdit` y exista al menos una garantía en estado `pendiente`. Al hacer clic:
- Llama a `refrescar_garantia_desde_tarifa`.
- Invalida el query `garantias(embarqueId)` para refrescar la tabla.
- Toast con resumen (`N filas actualizadas` / mensaje si no hubo cambios).

Si el embarque no tiene tarifa aplicada ni condición configurada para la naviera, el botón sigue funcionando pero el toast indica "No hay tarifa ni condición configurada para precargar" — evitando pisar valores capturados manualmente.

### 5. Changelog + versión

Bump `APP_VERSION` a `13.303.82` y agregar entrada en `CHANGELOG.md`.

## Detalles técnicos

**Migración SQL** (una sola migración con dos `CREATE OR REPLACE FUNCTION` + una `CREATE OR REPLACE FUNCTION` para el RPC):

```text
crear_garantia_contenedor():
  v_tarifa_id  := SELECT tarifa_id_aplicada FROM embarques WHERE id = NEW.embarque_id
  IF v_tarifa_id IS NOT NULL:
      SELECT naviera_id, dias_libres_demoras
      FROM costeo_tarifas WHERE id = v_tarifa_id
  ELSE:
      resolver naviera_id por nombre (comportamiento actual)
  SELECT cnc.* FROM costeo_navieras_condiciones cnc
    WHERE naviera_id = v_naviera_id AND organization_id = v_org
  → prefill monto_deposito_usd, tiene_carta_garantia, estado

calc_fecha_limite_devolucion_garantia():
  usar COALESCE(costeo_tarifas.dias_libres_demoras,
                costeo_navieras_condiciones.dias_libres_demoras_default, 0)

refrescar_garantia_desde_tarifa(p_embarque_id uuid) RETURNS int:
  SECURITY DEFINER, valida membresía org, sólo toca estado='pendiente'.
```

**Frontend**:
- `src/features/embarques/services/garantias.ts`: agregar `refrescarGarantiasDesdeTarifa(embarqueId)` (wrapper de `supabase.rpc(...)`).
- `src/features/embarques/components/TabGarantias.tsx`: botón + `useMutation` que invalide `['garantias', embarqueId]`.
- Sin cambios en columnas ni en `useGarantiasColumns`.

**No cambia:**
- Guardrails de congelación de monto (`_garantia_congelar_monto_trg`) ni transiciones de estado.
- Tabla `costeo_demoras_venta_tarifa` (venta al cliente) — es otro flujo (facturación de demoras) y no toca el depósito.

## Fuera de alcance (documentado, no se implementa aquí)

- Backfill masivo de embarques legacy sin tarifa: se resuelve caso por caso con el botón; un job de backfill queda para una fase futura.
- Editar el trigger para tocar filas ya `depositado/liberado/retenido`: se respeta la congelación existente.
