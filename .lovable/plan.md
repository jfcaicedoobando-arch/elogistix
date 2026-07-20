# Plan: aplicar auditoría de 48 fixes por fases

La auditoría es enorme (48 fixes, 4 sprints). Verifiqué los más críticos y **son reales**. Aplicar todo en un turno es imprudente (riesgo de romper facturación fiscal). Propongo trabajarlo por **fases**, empezando por Sprint 0. Después de cada fase: correr CI, subir versión, y esperar tu OK antes de la siguiente.

## Verificaciones ya hechas (confirmando que los bugs son reales)

- ✅ **FIX-01**: `debug-login.cjs`, `debug-login2.cjs`, `debug-login3.cjs`, `audit-tmp.cjs` existen y contienen `lopezbenavides` en texto plano. `.env` está en el repo. `.gitignore` NO lo excluye.
- ✅ **FIX-02**: **ya resuelto** en `v13.302.12` (mi último cambio). Marco esta fila como completada; también aprovecharé para meter **FIX-16** (usar `monto_en_moneda_factura` + `pp.deleted_at IS NULL`) en una nueva migración.
- ✅ **FIX-04**: `facturapi-emitir` sí tiene el guard no-atómico en línea 64. Riesgo doble timbrado real.
- ✅ **FIX-11**: `useNotaCreditoDraft.ts:92` tiene `|| 1` en TC — bug real.
- ✅ **FIX-46**: existen `bun.lock`, `bun.lockb` y `package-lock.json` simultáneamente.

## Fase A — Sprint 0 (esta iteración, si apruebas)

Todo lo que bloquea producción o pone en riesgo fiscal/seguridad. Incluye migraciones + código.

1. **FIX-01 · Purgar credenciales del repo** — eliminar los 4 `.cjs`, agregar `.env` y `.env.*` a `.gitignore`, crear `.env.example`. Te aviso por chat que **debes rotar manualmente** la contraseña del usuario expuesto (yo no puedo).
2. **FIX-16 (combo con FIX-02)** — nueva migración `validar_cierre_embarque` que además usa `monto_en_moneda_factura` y filtra `pp.deleted_at IS NULL`.
3. **FIX-03 · Restaurar `estado_proforma='facturada'`** — nueva migración que redefine `convertir_proformas_a_factura` con el `UPDATE` final + `FOR UPDATE` + índice único parcial anti doble-facturación.
4. **FIX-04 · Claim atómico anti doble-timbrado CFDI** — migración con índice único `uq_facturas_facturapi_id` + refactor de `facturapi-emitir/index.ts` con claim `PENDING:<uuid>` antes de llamar a FacturAPI, liberación en fallo, timeout 30 s en `facturapiClient.ts`.
5. **FIX-05 · Folio de cotización atómico** — migración con `folio_secuencias`/RPC `siguiente_folio` (ya existe patrón similar para embarques) + `crear.ts` usa la RPC.
6. **FIX-07 (+ FIX-21) · Conversión cotización→embarque transaccional** — refactor `useCotizacionConversions` para usar la RPC existente `crear_embarque_borrador_desde_cotizacion` con guard `estado='Aceptada' AND embarque_id IS NULL`; eliminar path multi-await del cliente.

Al terminar Fase A: bump a `v13.303.0`, entrada CHANGELOG, `bun run ci:fast`, y espero tu OK para Fase B.

## Fases siguientes (para próximas iteraciones, no ahora)

- **Fase B — Sprint 1 (integridad financiera):** FIX-08 a FIX-32 (sobrepago con NCs, PNL sin Sustituida, política TC≠1 unificada con helper `tcValido`, fechas MX timezone, comisiones EUR, optimistic locking, factura manual cuadrada, IVA por línea con trigger, webhooks dedupe, conciliación 1-a-1, etc.).
- **Fase C — Sprint 2 (UX sistémico):** FIX-33 a FIX-39 (manejo `isError`, confirmaciones destructivas, labels a11y, `NumericInput`, botones-ícono con `aria-label`, grids responsive).
- **Fase D — Sprint 3 (gobierno/seguridad dura):** FIX-40 a FIX-48 (rate limit `demo-access`, CORS estricto, no filtrar PII, cast audit gate en CI, `saldo_factura` SECURITY INVOKER, higiene repo, CSP).

## Detalles técnicos

- **No tocar:** `src/components/ui/` (shadcn), `src/integrations/supabase/types.ts` (autogen).
- **Convenciones respetadas:** transacciones multi-tabla → RPC; hooks/services/domain; `useTasaIVA`; RLS + `organization_id` intactos.
- **Cada migración** cumple regla GRANT + RLS + POLICY del proyecto.
- **Tests:** por cada fix crítico, agrego test de regresión (unit o SQL).
- **CI:** `bun run ci:fast` al final de cada fase; si falla, arreglo antes de cerrar.
- **Cambio manual pendiente que Lovable NO puede hacer:**
  - Purgar historial de git con `git filter-repo`/BFG para las credenciales de FIX-01.
  - Rotar la contraseña del usuario expuesto.
  - Rotar el DSN de Sentry si fue commiteado.

## Riesgos y por qué fases

- Fase A toca **facturación fiscal (CFDI)**. Un bug aquí = timbrado incorrecto real ante el SAT. Prefiero enviarlo, validarlo tú en producción y luego seguir.
- Las 48 fixes en un solo commit harían casi imposible bisectar si algo regresa.
- Los `|| 1` en TC (FIX-11) están regados en 7 archivos — merecen su propia fase con helper único y pruebas.

## ¿Confirmas Fase A?

Si dices "sí", ejecuto los 6 fixes de arriba, subo a `v13.303.0` y te reporto qué pasó con CI. Si prefieres empezar por otro subconjunto (p. ej. solo FIX-01 + FIX-04 porque son los más urgentes), dímelo.
