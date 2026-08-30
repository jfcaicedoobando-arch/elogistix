# Auditoría de bugs vigentes — Embarques, cotizaciones, estados/cierre, contenedores, concurrencia y multi-tenant (HEAD)

Modo solo lectura: no modifiqué ningún archivo, migración, configuración ni dato. Método: 2 subagentes por dominio + verificación directa contra el **esquema vivo** (`pg_proc`, `pg_trigger`, privilegios) y contra el código de HEAD.

## Verificación explícita de RPCs recientes contra el esquema vivo

| Comprobación | Resultado |
|---|---|
| 190 RPCs invocadas desde `src/` y edge functions existen en `public` del esquema vivo | ✅ 0 faltantes |
| Firmas vivas vs. nombres de parámetros en los call sites (embarques, cotizaciones, contenedores, cierre, garantías, papelera, idempotencia) | ✅ coinciden (incl. `p_expected_updated_at`, `p_contenedores`, `p_request_id`) |
| `EXECUTE` para `authenticated` en cada RPC llamada desde el cliente | ✅ concedido en todas |
| `EXECUTE` para `anon` en RPCs `SECURITY DEFINER` | ✅ ninguna (sólo `check_ratelimit` y `embarques_listado`, esta última `SECURITY INVOKER`, con RLS aplicada) |
| Funciones `SECURITY DEFINER` sin `search_path` fijo | ✅ 0 |
| Tablas `public` sin RLS | ✅ 0 |
| Cuerpos vivos revisados uno a uno | `cerrar_embarque`, `reabrir_embarque`, `validar_cierre_embarque`, `avanzar_estado_embarque`, `transicion_embarque_valida`, `sincronizar_contenedores_embarque`, `set_garantia_estado`, `aprobar_factura_proveedor`, `org_scope` |

Nota: no pude *ejecutar* las RPCs de negocio (el rol de consulta no tiene `EXECUTE`; están correctamente restringidas a `authenticated`), así que la verificación de ejecución fue de firma, privilegios y cuerpo compilado en la base viva, no de invocación.

---

## (A) Bugs confirmados

### A-1 · El congelamiento por "embarque Cerrado" no cubre garantías — CRÍTICO
- **Evidencia (esquema vivo):** el trigger `trg_bloquear_cierre` (`tg_bloquear_si_embarque_cerrado`) está sólo en `conceptos_costo`, `conceptos_venta`, `documentos_embarque`, `embarque_contenedores`, `eventos_embarque`, `seguros_embarque`. **No** existe en `embarque_garantias_contenedor`. El cuerpo vivo de `set_garantia_estado(p_id, p_estado, …)` no consulta `embarques.estado` en ningún punto.
- **Frontend:** `src/features/embarques/components/tabs/TabGarantias.tsx` sólo deshabilita por `isPending`; no hay gate por estado del embarque.
- **Escenario:** se cierra el embarque (`cerrar_embarque` congela `cerrado_snapshot`/`pnl_base`); después, un operador libera o re-monta la garantía del contenedor vía `set_garantia_estado` sin pasar por `reabrir_embarque`.
- **Impacto:** movimiento de dinero (garantía USD) sobre un expediente cerrado, snapshot y P&L congelados quedan desincronizados, sin motivo ni registro en `cierre_embarque_log`.

### A-2 · Tampoco cubre CxC/CxP ni comisiones del embarque cerrado — ALTO
- **Evidencia (esquema vivo):** la lista de triggers confirma que `pagos_factura`, `pagos_proveedor`, `facturas`, `proveedor_facturas`, `comisiones_devengadas` y `embarque_facturas_entrantes` sólo tienen `trg_guard_soft_delete`, nunca `trg_bloquear_cierre`.
- **Escenario:** embarque en `Cerrado`; se registra o elimina un pago de cliente/proveedor ligado a sus facturas.
- **Impacto:** el P&L "definitivo" y el resultado por embarque cambian después del cierre contable, sin reapertura ni trazabilidad. Es la misma invariante que A-1, en el lado financiero.

### A-3 · `aprobar_factura_proveedor` sin bloqueo pesimista ni re-chequeo de estado — ALTO (concurrencia)
- **Evidencia (cuerpo vivo):** `SELECT * INTO v_row FROM proveedor_facturas WHERE id = p_id AND deleted_at IS NULL;` **sin `FOR UPDATE`**, guard `IF v_row.estado_aprobacion <> 'pendiente'` y luego `UPDATE … WHERE id = p_id` **sin** repetir `AND estado_aprobacion = 'pendiente'`.
- **Escenario:** doble clic o dos aprobadores simultáneos sobre la misma factura pendiente: ambas transacciones leen `pendiente`, ambas pasan el guard y ambas aplican el `UPDATE`.
- **Impacto:** doble ejecución de efectos: `_cxp_validar_aprobacion` / `_cxp_desvincular_por_rechazo` (desvincula conceptos de costo del embarque), doble asiento en `bitacora_actividad`, y sobreescritura de `aprobada_por`/`motivo_rechazo`. Una aprobación y un rechazo concurrentes pueden dejar la factura "aprobada" con conceptos ya desvinculados.
- **Contraste:** `aprobar_nota_credito_proveedor` y `cambiar_estado_embarque` sí usan `SELECT … FOR UPDATE` + `UPDATE … WHERE estado = <esperado>` (`LC_ESTADO_CONCURRENTE`). Esta RPC quedó fuera de ese endurecimiento.

---

## (B) Bugs probables (evidencia fuerte, requieren reproducción)

### B-1 · RPCs `SECURITY DEFINER` que ignoran el tenant activo del super admin — MEDIO/ALTO
- **Evidencia (esquema vivo):** el patrón canónico es `org_scope()` (respeta `super_admin_org_activa`), pero **64 funciones `SECURITY DEFINER`** usan `current_user_org_id()` con salida incondicional `OR has_role(auth.uid(),'super_admin')`, sin comparar contra el tenant activo. Ejemplos verificados: `set_garantia_estado`, `eliminar_pago_cliente`, `eliminar_pago_proveedor`, `registrar_pago_cliente_lote`, `registrar_pago_proveedor_lote`, `cancelar_liquidacion_comision`, `eliminar_embarque_completo`, `purgar_embarque_cascade`, `validar_cierre_embarque`, `pnl_financiero_embarque`.
- **Por qué es probable y no confirmado:** al ser `SECURITY DEFINER` las políticas `RESTRICTIVE` de `org_scope()` no aplican, así que la protección de "consola de plataforma" queda fuera del camino; falta reproducir una escritura real con sesión de super admin apuntando a otro tenant para confirmar el cruce.
- **Impacto potencial:** un super admin operando en el tenant A puede escribir/eliminar registros del tenant B por id, sin que ninguna capa lo frene.

### B-2 · Ventana de carrera al cambiar de tenant (super admin) — MEDIO
- **Evidencia:** `src/lib/contexts/organization/useSuperAdminOrgs.ts:80-101` — `activeId` se actualiza en el cliente y se limpia el caché de inmediato, pero `setSuperAdminOrg(id)` (que persiste `super_admin_org_activa`, base de `org_scope()`) es asíncrona.
- **Escenario:** una RPC disparada en esa ventana resuelve `org_scope()` con el tenant **anterior** mientras la UI ya muestra el nuevo.
- **Impacto:** lecturas o escrituras atribuidas al tenant equivocado durante milisegundos. `tenantSeq` + `queryClient.clear()` mitigan el caché, no la escritura.

### B-3 · `registrar_pago_liquidacion` sin clave de idempotencia — BAJO
- **Evidencia:** a diferencia de `registrar_pago_cliente_lote` / `registrar_pago_proveedor_lote`, no recibe `p_request_id` ni usa `idempotency_claim`. El doble pago sí está bloqueado por `SELECT … FOR UPDATE` + `WHERE fecha_pago IS NULL AND estado='Generada'`.
- **Impacto:** en reintento de red el usuario ve un error genérico (`LC_LIQUIDACION_YA_PAGADA`) en lugar de la respuesta cacheada, más asientos de bitácora redundantes. Sin daño financiero.

### B-4 · `pnl_base` de comisiones se congela antes del recálculo de cierre — BAJO/MEDIO
- **Evidencia:** en el flujo de cierre, `v_pnl` se calcula una vez **antes** del loop que recalcula comisiones pendientes (`calcular_comision_pago`) y ese mismo valor se guarda luego en `comisiones_devengadas.pnl_base`/`calculo_snapshot`.
- **Pendiente de confirmar:** si `calcular_comision_pago` escribe cifras que `pnl_financiero_embarque` vuelve a leer. Si no lo hace, es inocuo.

### B-5 · Prorrateo de costos cotización→embarque entre todos los contenedores — BAJO
- **Evidencia:** `supabase/schema/embarques/_crear_embarque_replicar_conceptos.sql:59-81` — con `unidad_medida <> 'BL'` el costo se reparte por partes iguales entre **todos** los `p_target_ids`, sin considerar la `cantidad` original de `cotizacion_costos`.
- **Impacto:** un costo cotizado para 1 contenedor se diluye entre los 3 del embarque; el total no cambia, la asignación por contenedor sí.

### B-6 · `EIR` y `Por liquidar` fuera de `ESTADOS_ACTIVOS` — BAJO (posible decisión de producto)
- **Evidencia:** `src/features/embarques/constants/embarqueConstants.ts:33` no incluye `EIR` ni `Por liquidar`; ese arreglo filtra `src/features/embarques/services/dashboardOperador.ts:49` y `src/features/portal-agente/routes/AgenteInicio.tsx:40`.
- **Impacto:** embarques en cierre operativo desaparecen del tablero del operador y del portal del agente aunque sigan abiertos. Puede ser intencional (los cubre la tarjeta "Pendientes administrativos"); requiere definición de producto.

---

## (C) Revisado y descartado (no reportar como bug)

- **Máquina de estados:** `transicion_embarque_valida` (cuerpo vivo) es coherente con la UI, incluyendo estados laterales (`En Proceso`, `Llegada`, `Cotización`) y la corrección BUG-09 que impide `Cerrado → Cancelado` directo.
- **`set_garantia_estado`** sí tiene `SELECT … FOR UPDATE` (contrario a una sospecha inicial): no hay carrera ahí, el problema es el cierre (A-1).
- **Idempotencia y locks:** `idempotency_keys`, `cron_locks`, `ratelimit_buckets` con `FOR UPDATE` y scope correcto.
- **Caché por tenant:** `queryClient.clear()` completo en cambio de usuario y de tenant cierra el riesgo de query keys sin `organization_id`.
- **Bloqueo optimista:** `actualizar_embarque_completo` y las mutaciones de cotización reciben `expected_updated_at` desde los hooks.
- **Higiene de seguridad:** 0 tablas sin RLS, 0 `SECURITY DEFINER` sin `search_path`, 0 RPCs `DEFINER` ejecutables por `anon`.

## Prioridad sugerida
1. A-1 y A-2 (una sola decisión: extender el candado de cierre a garantías, pagos, facturas y comisiones).
2. A-3 (`FOR UPDATE` + `WHERE estado_aprobacion='pendiente'`; fix de una migración corta).
3. B-1 (migrar los 64 `DEFINER` a `org_scope()`), luego B-2.

**Requiere definición de producto:** B-6 (¿`EIR`/`Por liquidar` deben seguir en el tablero del operador?) y el alcance de A-2 (¿un embarque cerrado debe rechazar todo pago, o sólo advertir?).
