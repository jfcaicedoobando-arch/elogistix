## Fase P.2 — Garantías re-evaluables con máquina de estados y bitácora

### Contexto
La Fase P.1 quedó verde tras 4 correcciones (SAFE-CAST, split de archivo, título duplicado, regresión de `pagosProveedor`). El siguiente hallazgo abierto de la auditoría Ronda 4 es **Bug 21 aplicado a garantías**: hoy `embarque_garantias_contenedor.estado` se actualiza con un `UPDATE` directo desde el cliente, sin validar la transición, sin bitácora y sin gate de rol. Es posible saltar de `pendiente` → `liberado` sin pasar por `depositado`, marcar `liberado` sin `fecha_liberacion`, o cambiar el `monto_deposito_usd` una vez que ya se depositó — todo silenciosamente.

### Objetivo
Convertir la garantía en un objeto **re-evaluable con historia**: transiciones validadas por trigger, RPC única con gate de rol, y bitácora inmutable por cambio.

### Cambios propuestos

**1) Migración `v13.301.88`**

- Grafo dirigido de transiciones (función `public.transicion_garantia_valida(prev text, next text) returns boolean`):
  ```text
  pendiente   → depositado | retenido
  depositado  → liberado   | retenido
  retenido    → liberado                (excepción manual justificada)
  liberado    →  (terminal)
  ```
- Trigger `trg_garantia_transicion_valida` (BEFORE UPDATE OF estado) — lanza `LC_GARANTIA_TRANSICION_INVALIDA` si `NEW.estado` no está en el conjunto permitido desde `OLD.estado`.
- Trigger `trg_garantia_congelar_monto` (BEFORE UPDATE) — si `OLD.estado ∈ {depositado,retenido,liberado}` y cambia `monto_deposito_usd`, lanza `LC_GARANTIA_MONTO_CONGELADO`.
- Trigger `trg_garantia_fechas_requeridas` (BEFORE UPDATE) — al pasar a `depositado` exige `fecha_deposito` y `monto_deposito_usd > 0`; al pasar a `liberado` exige `fecha_liberacion`. Errores `LC_GARANTIA_FECHA_DEPOSITO_REQUERIDA`, `LC_GARANTIA_MONTO_REQUERIDO`, `LC_GARANTIA_FECHA_LIBERACION_REQUERIDA`.
- Tabla `public.embarque_garantias_historial` (id, garantia_id fk, organization_id, estado_anterior, estado_nuevo, monto_deposito_usd, referencia_deposito, notas, changed_by uuid, changed_at) con RLS scoped por org y grants `authenticated`/`service_role`.
- Trigger `trg_garantia_historial` (AFTER INSERT OR UPDATE OF estado, monto_deposito_usd, referencia_deposito, notas) que serializa el cambio.
- RPC `public.set_garantia_estado(p_id uuid, p_estado text, p_fecha date, p_monto numeric, p_referencia text, p_notas text)` SECURITY DEFINER, `search_path=public`, role gate `admin|admin_org|operador|super_admin`, valida org y aplica el UPDATE en un solo statement (para que los tres triggers se disparen coherentes). Devuelve la fila.
- `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated, service_role`.

**2) Cliente**
- `src/features/embarques/services/garantias.ts`: reemplazar `updateGarantia` por `setGarantiaEstado(input)` que llama al RPC. Extraer mapeo de errores a `garantiasErrors.ts` para no rebasar 200 líneas.
- `useUpdateGarantia` hook: usar el nuevo servicio y añadir toasts accionables en español (5 códigos + `UNKNOWN`).
- `useGarantiasColumns.tsx`: al confirmar `depositado` sin monto/fecha, prevenir el submit y mostrar toast `LC_GARANTIA_MONTO_REQUERIDO`.

**3) Tests**
- **Guardrail nuevo** `src/lib/__tests__/garantias-fase-p2.test.ts` (≥10 asserts):
  - Existen 3 triggers (`transicion`, `congelar_monto`, `historial`).
  - Los 5 `RAISE EXCEPTION` con códigos `LC_GARANTIA_*`.
  - Tabla `embarque_garantias_historial` con RLS + policy scoped + grants.
  - RPC `set_garantia_estado` es SECURITY DEFINER con `search_path=public`.
  - Cascada de roles autorizados.
  - `REVOKE/GRANT` restrictivo.
- **Unit tests** `src/features/embarques/services/__tests__/garantias.test.ts` extendido: 5 tests nuevos que cubren happy path del RPC y los 4 mapeos de error principales.

**4) Bitácora**
- `CHANGELOG.md` + `APP_VERSION = 13.301.88`.

### Fuera de alcance (P.3)
- Materializar automáticamente una `proveedor_factura` cuando `estado = retenido` (queda para P.3 junto con matching parcial de PFC).
- Reversar `liberado → depositado` (por ahora es terminal; si se necesita, se genera una nueva garantía).

### Riesgos
- Ninguna garantía existe hoy en producción (0 filas) → los triggers no bloquean datos preexistentes.
- El `UNIQUE` sobre `embarque_contenedor_id` sigue siendo 1:1; la historia vive en la tabla nueva sin duplicar la garantía viva.

### Verificación
1. Aplicar migración vía `supabase--migration`.
2. `bun run ci:fast` — típecheck + lint + vitest completo debe quedar verde.
3. Verificar que los guardrails L, M, N, O y P.1 siguen pasando (57 asserts) + los 10+ nuevos de P.2.