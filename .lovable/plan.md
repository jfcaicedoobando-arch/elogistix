## Ronda de cierre: bugs 7, 8, 15, 21, 24 + residual Fase B

Cerramos los pendientes que quedaron parciales/abiertos de rondas anteriores. Cada fix incluye migración + guardrail test + entrada en CHANGELOG y bump de `APP_VERSION`.

### Fase R.1 — Bug 7 completo (eliminar embarque + proformas huérfanas) · v13.301.92

**Problema:** `eliminar_embarque_completo` no cuenta proformas vivas como dependencia, y `convertir_proformas_a_factura` no valida que el embarque siga vivo. Vía abierta: borrar embarque con proforma sin facturar → la proforma queda huérfana pero facturable.

- Migración:
  - Agregar count de `proformas` (estado_aprobacion ≠ 'borrador' vacío, no facturadas) al bloque de motivos en `eliminar_embarque_completo`. Extender `MotivosBloqueoEmbarque` (server + cliente) con `proformas`.
  - En `convertir_proformas_a_factura`, `RAISE` si el embarque asociado tiene `deleted_at IS NOT NULL` (código `LC_EMBARQUE_ELIMINADO`).
- Cliente:
  - Extender `MotivosBloqueoEmbarque` en `services` y el adaptador `motivosADependencias`.
  - Renderizar la nueva categoría en `DialogEmbarqueBloqueadoAlert`.
- Tests: guardrail SQL que confirma el nuevo count y el `RAISE` en la RPC de conversión.

### Fase R.2 — Bug 15 completo (guarda DB para re-cotizar) · v13.301.93

**Problema:** UI ya oculta el botón, pero `recotizar_cotizacion` no valida en BD → un cliente API puede versionar una cotización con embarques vinculados.

- Migración: en `recotizar_cotizacion`, verificar `EXISTS (SELECT 1 FROM embarques WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL)` y `RAISE` con código `LC_COTIZACION_CON_EMBARQUES`.
- Servicio `versionado/index.ts`: mapear el error a una clase de dominio (`CotizacionConEmbarquesError`) para que el modal lo muestre traducido.
- Tests: guardrail que verifica presencia del check en la migración más reciente + test unitario del servicio.

### Fase R.3 — Bug 21 completo (transiciones NC proveedor en BD) · v13.301.94

**Problema:** El estado (`Borrador → Vigente → Aplicada/Cancelada`) sólo se enforce en cliente. API puede aplicar una NC en 'Borrador' o 'Cancelada'.

- Migración: trigger `BEFORE UPDATE` en `proveedor_notas_credito` que valide la matriz de transiciones (`transicion_nc_proveedor_valida`), similar al pattern de Fase G para embarques. Bloquea también `Aplicada → *` (inmutable).
- Además, trigger `BEFORE INSERT` en la tabla puente `proveedor_nc_aplicaciones` (o equivalente) que exija `estado = 'Vigente'` en la NC padre.
- Tests: guardrail SQL + unit test asegurando que se levantan los errores esperados.

### Fase R.4 — Bug 24 real (aprobación previa a pago proveedor) · v13.301.95

**Problema:** `pagos_proveedor` no valida `estado_aprobacion = 'aprobada'` en el INSERT. La mitigación por RLS admin-only no impide que un admin pague una factura aún no aprobada.

- Migración: trigger `BEFORE INSERT` en `pagos_proveedor` que verifique `proveedor_facturas.estado_aprobacion = 'aprobada'` (y `<> 'cancelada'`). Código `LC_CXP_SIN_APROBACION`.
- Cliente: mapear error en `useRegistrarPagoProveedor` + toast.
- Tests: guardrail + RLS fixture.

### Fase R.5 — Bug 8 (eliminar pago con REP timbrado) · v13.301.96

**Problema:** Se puede borrar un `pagos_factura` cuyo REP ya está `Timbrado` sin cancelar antes el CFDI de pago.

- Migración: trigger `BEFORE UPDATE` en `pagos_factura` que, cuando `NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL`, verifique `OLD.estado_rep NOT IN ('Timbrado','EnCancelacion')`. Código `LC_PAGO_CON_REP_TIMBRADO`.
- UI: en `FacturaPagosSection`, ocultar/deshabilitar el botón "Eliminar" cuando `estado_rep IN ('Timbrado','EnCancelacion')` con tooltip explicativo.
- Tests: guardrail SQL + test de UI (RTL) que oculta el botón.

### Fase R.6 — Residual Fase B (revert cancelación considera borradores vivos) · v13.301.97

**Problema:** En `revertir_proforma_al_cancelar_sustitucion`, el check de "facturas vivas" excluye `'Borrador'`. Escenario documentado: MXN timbrada + borrador USD vivo → cancelar MXN libera la proforma → re-conversión duplica.

- Migración: incluir `'Borrador'` en la lista de estados vivos para el sibling-check del revert (mismo criterio que `eliminar_factura_borrador` de Fase C). Filtrar por conceptos_factura.proforma_id_origen compartido.
- Backfill: query de diagnóstico (no destructivo) para detectar proformas actualmente en `pendiente` con borradores USD vivos consumiéndolas — reportar count, no mutar.
- Tests: guardrail SQL que asegura `'Borrador'` presente en el check, y test de dominio que reproduce el escenario MXN timbrada + borrador USD.

### Detalles técnicos comunes

- Cada migración usa `ALTER FUNCTION`/`CREATE OR REPLACE FUNCTION` con `SECURITY DEFINER` y `SET search_path = public` según convención del repo.
- Todos los `RAISE EXCEPTION` usan códigos `LC_*` para que `mapSupabaseError` los traduzca en UI.
- CHANGELOG: una entrada por fase, formato `## [X.Y.Z] - YYYY-MM-DD`.
- Bump `APP_VERSION` una vez por fase.
- Guardrails vitest ubicados en `src/lib/__tests__/` siguiendo el patrón `*-fase-*.test.ts`.

### Orden de ejecución

R.1 → R.2 → R.3 → R.4 → R.5 → R.6, verificando `bun run ci:fast` entre cada fase (como en rondas anteriores). Después de cada fase espero tu "revisa y continúa" antes de saltar a la siguiente.
