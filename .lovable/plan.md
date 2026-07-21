
# Plan · Validación + Fases pendientes (correcciones v2-2)

## Fase 0 · Auditoría de lo ya corregido (FIX-01 → FIX-18)

Objetivo: confirmar que cada fix aplicado en versiones anteriores sigue vivo y no tiene regresiones. **No se toca código en esta fase**; sólo lecturas + grep + tests dirigidos + una corrida completa de CI.

Checklist de verificación por fix (comando esperado → resultado esperado):

| Fix | Verificación |
|---|---|
| FIX-01 | `grep -rn "lopezbenavides\|1234567890" src/ scripts/ supabase/ e2e/ *.cjs 2>/dev/null` → 0 hits (excluyendo docs/tests) |
| FIX-02 / FIX-16 | `grep -rn "pp\.factura_id\b" supabase/migrations` → 0; correr `validar_cierre_embarque` sobre embarque real de staging |
| FIX-03 | Convertir la misma proforma dos veces → 2ª vez no aparece en lista; verificar índice `uq_facturas_vivas_por_proforma` en pg |
| FIX-04 | `grep -n "facturapi_id.*is.*null\|claimTag" supabase/functions/facturapi-emitir/*.ts`; test concurrente `facturapi-emitir/*_test.ts` |
| FIX-05 | Verificar `siguiente_folio` RPC + índice único `uq_cotizaciones_org_folio` |
| FIX-06 | `git ls-files \| grep -x .env` → vacío; `.env.example` existe |
| FIX-07 | `grep -rn "createEmbarqueFromCotizacion\|conversiones/embarques" src` → sólo RPC; guard `cotizacion_ya_convertida` presente |
| FIX-08 / FIX-23 | Trigger `assert_factura_viva_para_pago` resta NCs `Aplicada` + hace `FOR UPDATE` |
| FIX-10 / FIX-11 | `grep -rn "\|\| 1\b" src/features/embarques/domain src/features/facturacion src/lib/financial` → 0; `useBanxicoTipoCambio` rechaza fallback |
| FIX-12 | `grep -rn "toISOString().slice(0" src/features/facturacion src/features/embarques/components/TabTracking` → 0 |
| FIX-13 | Definición vigente de `calcular_comision_pago` usa `convertir_a_mxn` |
| FIX-14 | Correr `usePagoProveedorForm.test.tsx` completo |
| FIX-15 | `actualizar_embarque_completo` acepta `p_expected_updated_at` |
| FIX-17 / FIX-18 | Correr `facturaManual.test.ts` (11 casos) + `parseInputNumero.test.ts` |

Comandos finales de la fase:
```bash
bun run lint -- --max-warnings 0
bunx tsgo --noEmit
bun run test:fast
bun run audit:all
```

Entregable: reporte breve marcando cada fix ✅ / ⚠️ (con evidencia) y lista de regresiones detectadas — sólo esas se corrigen antes de pasar a Fase 1.

---

## Fases de remediación (fáciles → difíciles)

Cada fase = una entrega atómica con: código + tests + `CHANGELOG.md` + bump `APP_VERSION`. Se ejecutan **en orden**; después de cada una: `lint + tsgo + test:fast` en verde antes de continuar.

### Fase 1 · Higiene y guardrails de repositorio (FÁCIL · 1 sesión)
**Incluye:** FIX-46 (limpieza `.lockb`, `all_exports.txt`, `audit_tests.py`, dumps, `remotion/`), FIX-06 residuales (allowlist gitleaks), FIX-48 parcial (gitleaks en push a main, Sentry desactivado si falta DSN), FIX-47 parcial (quitar `isolate` duplicado en `vitest.config.ts`).
Riesgo: bajísimo, sólo archivos "muertos" y config.

### Fase 2 · Guards SQL cortos y UX destructivo (FÁCIL/MEDIO · 1 sesión)
**Incluye:**
- FIX-21 — guards `estado='Aceptada' AND embarque_id IS NULL` en RPC de conversión (una migración corta).
- FIX-25 — `portal_responder_cotizacion` valida `fecha_vigencia >= CURRENT_DATE`.
- FIX-34 — envolver 6 acciones destructivas en `AlertDialog`/`DoubleConfirmDeleteDialog` (`NotasCreditoSection`, `CatalogoClavesSATCard`, `TabPuertos/Navieras/TiposContenedor`, `FacturaConceptosEditor`).
- FIX-37 — reemplazar `confirm()`/`alert()` nativos por `AlertDialog` (`PlantillasMensajeEditor`, `CatalogoClavesSATCard.parts`, `FacturaTimbradoCard`) + `aria-label` en botones-ícono.

### Fase 3 · Búsquedas seguras y captura de dinero (MEDIO · 1 sesión)
**Incluye:**
- FIX-24 — helper `escapeOrIlike` en `src/lib/` y aplicarlo en `cobranza.ts`, `proveedorFacturas.ts`, `sugerirEmbarques.ts` + búsquedas CRM.
- FIX-36 — reemplazar `<Input type="number">` por `NumericInput` en los 5 sitios listados; sin `Number("") → 0` silencioso.
- FIX-42 — quitar `keyPrefix/keyLen/tokenPrefix` de logs y usar `redactEmail` en `handle-email-unsubscribe`.

### Fase 4 · Integridad financiera restante (MEDIO/ALTO · 2 sesiones)
**Incluye:**
- FIX-19 — trigger BD `AFTER INSERT/UPDATE/DELETE` en `conceptos_factura` que recalcula `facturas.subtotal/iva/total`; `monto_iva` por concepto; corregir `calc_pago_retenciones` para prorratear sobre `total`.
- FIX-20 — quitar defaults congelados 17.5/19.0 de `embarques.tipo_cambio_*`; RPC de creación toma TC vivo o deja NULL.
- FIX-22 — tabla `facturapi_webhook_events` + dedupe + límite 256 KB en `req.text()`.
- FIX-26 — parser CFDI sin `slice(0,10)` en cuadre/precarga; aplicar política `tcValido` en TipoCambio.
- FIX-28 — índices únicos parciales en `bbva_movimientos.pago_factura_id` / `pago_proveedor_id` + guard en updates de conciliación.

### Fase 5 · Data ops + CORS + rate limits (ALTO · 2 sesiones)
**Incluye:**
- FIX-27 — import BBVA: signos reales, ventana de siglo, dedupe robusto, límite XLSX.
- FIX-29 — exports con tope + keyset pagination; imports con chunking 500/lote.
- FIX-30 — mover UPDATE→DELETE→INSERT de recargos de tarifas a RPC transaccional; validar `monto > 0` con error visible.
- FIX-31 — cleanup de Storage en fallo de creación de embarque (o subir docs post-creación).
- FIX-32 — timeout 30 s FacturAPI + LRU 200 en `exchange-rates` + validación fechas.
- FIX-40 — `demo-access`: rate limit por IP + reseed cada 6 h + CORS estricto.
- FIX-41 — reemplazar `Access-Control-Allow-Origin: *` por `buildCors` en las ~15 edge functions autenticadas.
- FIX-43 — rate limit + verificación de entropía en `tracking-public`.

### Fase 6 · UX transversal (ALTO — mayor esfuerzo · 3 sesiones)
**Incluye:**
- FIX-33 — manejo de `isError` en `DataTable` + recorrer los ~70 page-controllers; regla eslint local.
- FIX-35 — `FormField` autogenera `id`/`htmlFor`; regla `jsx-a11y/label-has-associated-control`; corregir 345 labels sueltos por módulo.
- FIX-38 — grids responsive con breakpoints + migrar tablas crudas a `DataTable`.
- FIX-39 — pulido menor: `PageSkeleton` uniforme, `mode: "onBlur"`, touch targets ≥ 40px.

### Fase 7 · Gobierno y seguridad dura (ALTO · 2 sesiones)
**Incluye:**
- FIX-44 — regenerar `cast-audit.md`; gate CI si HIGH > 0 en archivos nuevos; migrar los 93 `as unknown as` empezando por `useMutationWithFeedback.ts`.
- FIX-45 — `saldo_factura` a `SECURITY INVOKER` o filtro `organization_id`.
- FIX-47 restante — reactivar `react-hooks/*` por dominio; thresholds de coverage por path para módulos financieros.
- FIX-48 restante — CSP en hosting (o meta), auditoría de secretos extendida a pares email+password.

---

## Detalles técnicos

- Cada fase respeta convenciones del repo: capas `page → hook → service → cliente`, transacciones multi-tabla como RPC, `useTasaIVA`/`financialUtils.ts` para IVA, `organization_id` en toda fila, `src/components/ui/` intocable, `tcValido` como única puerta de conversión, `hoyMx`/`ymMx` para fechas.
- Migraciones: cada RPC redefinida lleva `GRANT EXECUTE` a `authenticated`/`service_role` según su patrón vigente y no se remueve RLS.
- Tests: cada fase agrega tests unitarios para su lógica y (cuando aplica) un caso de regresión que reproduzca el bug pre-fix.
- Versionado: bump `APP_VERSION` y entrada `CHANGELOG.md` al final de cada fase con `## [X.Y.Z] - YYYY-MM-DD` + bullets breves.
- CI gate al terminar cada fase:
  ```bash
  bun run lint -- --max-warnings 0
  bunx tsgo --noEmit
  bun run test:fast
  bun run audit:all
  ```

## Fuera de alcance de este plan
- FIX-01 rotación de contraseña + purga de historial git (acción manual del usuario, no de Lovable).
- Publicación / deploy en producción — se hace al terminar cada fase con aprobación explícita del usuario.
