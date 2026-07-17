## Diagnóstico

El consecutivo de embarques se disparó porque la lógica que "realinea" la secuencia `embarque_consecutivo_seq` mezcla los folios de la organización real con los folios sintéticos del demo.

**Los hechos**

- El último folio bueno era `ELIMP00318` (era originalmente `ELIMP00304`, se renombró el 13-jul junto con `00317`).
- La organización demo (`de100000-…`) siembra embarques con expediente literal `DEMO-2026-001`, `DEMO-2026-002`, `DEMO-2026-003`, `DEMO-2026-004`.
- La migración `20260713190941` corre este cálculo para alinear la secuencia:
  ```
  MAX( regexp_replace(expediente, '\D', '', 'g')::bigint )
  ```
  Esa regla borra todos los caracteres no numéricos, así que `DEMO-2026-004` se traduce a `2026004`. Como toma el máximo entre eso y el valor previo de la secuencia con `GREATEST`, la secuencia queda envenenada para siempre por los demos.
- La misma expresión bugueada vive en el "drift stub" de CI (`supabase/tests/rls/_ci_drift.sql`) y también estuvo en la migración `20260713165742`.
- Resultado real hoy en BD: el `MAX` numérico salta de `318` (folios reales) a `2026004` (demo), y desde el 14-jul los nuevos embarques nacen como `ELIMP20260`, `ELIMP20261`, … `ELIMP20268`. La secuencia interna hoy está en `2,026,800` (envenenada). El siguiente embarque nacería con folio de 7 dígitos.

En analogía: la máquina que reparte tickets se "sincroniza" mirando el ticket más alto que haya en la sala, pero cuenta como tickets los gafetes de los invitados de demostración que empiezan con "2026". Un gafete demo pisa a un ticket real y la máquina brinca al 2 millones.

## Alcance de la corrección

1. **Excluir demo del cálculo, siempre**. La única fuente válida para realinear la secuencia son los folios con formato estricto `^EL[A-Z]{3}[0-9]+$`. Se aplica en:
   - Nueva migración de realineación (usa la misma fórmula estricta que la migración `20260713165828`, no la bugueada).
   - `supabase/tests/rls/_ci_drift.sql`, para que CI no reintroduzca la fórmula bugueada.

2. **Renombrar los 9 folios contaminados** de la organización real (`00000000-…-000001`), para dejarlos en la secuencia esperada por operaciones (`00319`…`00327`, ya que `00317` y `00318` existen y no se tocan):
   ```
   ELIMP20260 → ELIMP00319
   ELIMP20261 → ELIMP00320
   ELIMP20262 → ELIMP00321
   ELIMP20263 → ELIMP00322
   ELIMP20264 → ELIMP00323
   ELIMP20265 → ELIMP00324
   ELIMP20266 → ELIMP00325
   ELIMP20267 → ELIMP00326
   ELIMP20268 → ELIMP00327
   ```
   El rename se hace por `id`, deshabilitando temporalmente el trigger de "self-lock" del embarque, igual que hizo la migración `20260713165257` cuando renombró `00150→00317` y `00304→00318`. Índice único parcial se respeta.

3. **Resetear `embarque_consecutivo_seq`** a `setval(seq, 327, true)` para que el próximo folio sea `ELIMP00328`.

4. **Bitácora + changelog**: registrar el rename en `bitacora_actividad` con acción `renombrar_expediente` referenciando el folio viejo y el nuevo, y agregar entrada `## [X.Y.Z]` en `CHANGELOG.md` con bump de `APP_VERSION`.

5. **Comunicar al usuario**: los folios "20260-20268" ya no existirán; quien tenga una captura de pantalla o un correo con esos folios debe buscar por el equivalente `00319-00327`.

## Riesgos y mitigaciones

- **Referencias por texto al folio viejo**. Buscamos en `notificaciones_cliente`, `bitacora_actividad`, `factura_envios`, `email_send_log` y campos JSON de `detalles`. Si aparecen, la migración lanza un aviso pero no reescribe historial (se puede hacer en una fase 2 si el usuario lo pide).
- **Facturas ya timbradas contra los folios viejos**. Confirmar antes de correr: `SELECT id, folio, embarque_id FROM facturas WHERE embarque_id IN (…los 9…)`. El folio del embarque nunca viaja al CFDI (el CFDI usa su propia serie/folio), así que el rename es seguro fiscalmente.
- **Cache de React Query**. Al ser un cambio de `expediente`, invalidamos `queryKeys.embarques.*` en la próxima carga con un simple refresh del usuario.

## Detalles técnicos

Archivos a crear/editar (una vez aprobado el plan):

- Nueva migración `supabase/migrations/<ts>_fix_expediente_seq_y_renombrar_folios.sql`:
  1. Deshabilita `trg_bloquear_embarque_self` sobre `public.embarques`.
  2. `UPDATE public.embarques SET expediente = 'ELIMP0031X', updated_at = now() WHERE id = '<uuid>'` para cada uno de los 9 folios afectados.
  3. Rehabilita el trigger.
  4. `PERFORM setval('public.embarque_consecutivo_seq', 327, true);` blindado por un `DO $$` que primero recalcula con el filtro estricto `^EL[A-Z]{3}[0-9]+$` y toma el `GREATEST(actual_estricto, 327)`.
  5. `INSERT INTO public.bitacora_actividad …` una fila por rename (organización real, `usuario_id = '00000000-…-000000'` como agente sistema, módulo `Embarques`, acción `renombrar_expediente`, `detalles = jsonb_build_object('anterior', …, 'nuevo', …, 'motivo', 'fix-secuencia-contaminada-por-demo')`).
- Editar `supabase/tests/rls/_ci_drift.sql` (línea 147+): reemplazar el `setval` bugueado por la fórmula estricta con `substring(expediente FROM 6)::bigint WHERE expediente ~ '^EL[A-Z]{3}[0-9]+$'`, para que CI ya no reintroduzca la contaminación.
- Bump de `src/constants/appVersion.ts` (patch) y entrada en `CHANGELOG.md` describiendo el fix + los renames.
- No hay cambios en frontend: `resolverExpediente` y `generar_expediente` ya funcionan bien; el bug estaba en cómo se realineaba la secuencia.

## Cómo verificamos que quedó bien

1. `SELECT expediente FROM embarques WHERE organization_id = '00000000-…-000001' ORDER BY expediente DESC LIMIT 12;` — debe mostrar `ELIMP00327` hasta `ELIMP00312` en orden decreciente y ninguno con `2026…`.
2. `SELECT last_value FROM embarque_consecutivo_seq;` — debe ser `327`.
3. Crear un embarque de prueba desde una cotización aceptada y confirmar que sale `ELIMP00328`.
4. Correr `bun run ci:fast` para asegurar que la nueva migración pasa el snapshot de RLS y no rompe tests.
