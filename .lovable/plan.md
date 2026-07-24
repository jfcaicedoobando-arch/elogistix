## Pendientes tras la auditoría E2E T3

Comparé la auditoría contra el repo actual (v13.312.16). Lo aplicado en v13.312.15/16: job `multi-tenant`, 13 envs gating, helper `requireFixture`, gate anti-skip en mutators, `@visual` fuera de CI, spec 18 sin `waitForTimeout`, H1/H3 fixes SQL.

**Lo que queda** — analogía: pusimos los interruptores y el tablero de alarmas; ahora falta cambiar los focos viejos, cubrir las habitaciones sin cámara, y calibrar el sensor de imagen.

### Estado numérico
- `waitForTimeout` residuales: **17** en 8 specs (13, 14, 15, 17, 19, 20, 26, 27).
- Specs con `test.skip` crudo (no usan `requireFixture` todavía): **6** (07, 08, 09, 10, 11, 12) → `E2E_STRICT_FIXTURES=1` aún no promueve fallo real.
- Baselines visuales spec 27: **0 PNGs** en repo → falla en CI si sale del `--grep-invert`.
- Tests "smoke sin aserción de negocio": **~38 de 64** (~59%), concentrados en 13–17, 19, 20.
- **Módulos sin E2E** (§3 auditoría): notas de crédito, cancelación CFDI como flujo, conciliación bancaria, descarga CFDI en portal, CxC aging real, crear cotización, costeo, admin provisioning.

---

### Ola 3 — Higiene mecánica (bajo riesgo, alto orden)

1. Migrar los 17 `waitForTimeout` restantes a `waitForLoadState("networkidle")` / `waitForResponse` / `expect.poll`. Por spec: 20 (5), 15 (3), 17 (3), 26 (2), 13/14/19/27 (1 c/u).
2. Adoptar `requireFixture()` en los 6 specs 07–12 en lugar de `test.skip` crudo — así `E2E_STRICT_FIXTURES=1` (input del dispatch) los promueve a fallo cuando queramos auditar cobertura real.
3. Spec 06: cuando `E2E_CROSS_ORG_*` degrada a UUID dummy, promover el `console.warn` a `test.info().annotations` + `requireFixture` → deja de quedar verde sin secrets reales.
4. Spec 27: sustituir la máscara frágil `.text-xl, .text-2xl` por `data-e2e-mask="dynamic-count"` en los 3 nodos del timeline (una línea por componente).

### Ola 4 — Cobertura crítica fiscal/dinero (§3 prioridades 1–3)

Nuevos specs conectados al proyecto `chromium-mutators` con gating por `E2E_FISCAL`:

5. **`28-nota-credito.spec.ts`** — emisión NC contra factura sandbox → verifica saldo/estado → aplica → cancela NC. Cleanup FK-safe con tag `E2E_TEST`.
6. **`29-cancelar-cfdi.spec.ts`** — cancelación motivo 02/04 como flujo (no cleanup): duplica sandbox → cancela → `facturapi-reconciliar-cancelaciones` → verifica estado SAT/acuse en UI.
7. **`30-portal-descarga-cfdi.spec.ts`** — portal cliente descarga PDF+XML de factura (`facturapi-descargar`); afirma que llega binario válido y filename correcto.

### Ola 5 — Cobertura secundaria (§3 prioridades 4–9)

8. **`31-conciliacion-bancaria.spec.ts`** — matching en `/tesoreria/conciliacion` (spec 04 se llama así pero no lo prueba).
9. **`32-cxc-aging-real.spec.ts`** — validar buckets 0-30/31-60/… con fechas conocidas (no solo "no todos dicen hoy" como el spec 23).
10. **`33-crear-cotizacion.spec.ts`** — wizard cotización completo hasta enviar (hoy nadie lo envía).
11. Enriquecer specs 13–17, 19, 20: añadir una aserción de negocio por spec (heading semántico, presencia de dato de tenant, valor de KPI > 0), sin retirar el chequeo de overflow.

### Ola 6 — Visuales spec 27

12. Preparar corrida `bunx playwright test --project=chromium-internal --grep "@visual" --update-snapshots` contra staging estable, revisar los PNGs generados, commitearlos bajo `e2e/specs/27-visual-regression.spec.ts-snapshots/`, luego retirar el `--grep-invert "@visual"` del workflow.

---

### Detalles técnicos

- **Riesgo cero**: Ola 3 completa (mecánica, sin nueva lógica).
- **Requiere secrets nuevos en GitHub**: Olas 4/5 dependen de `E2E_FISCAL=1`, `E2E_PROFORMA_NUMERO`, `E2E_FACTURA_SANDBOX_ID` (nuevo, para 28/29/30), `E2E_CUENTA_BANCO_ID` (nuevo, para 31). El workflow ya expone estas envs con guard silencioso — sin secrets, los specs `requireFixture` skippean; con `E2E_STRICT_FIXTURES=1` fallan.
- **Sandbox FacturApi**: Olas 4/5 timbran contra sandbox — los specs deben tener cleanup con cancelación motivo 02 en `afterAll`, patrón ya probado en spec 08.
- **Ratchet de cobertura**: cada spec nuevo baja el % `smoke` (hoy 59%) hacia meta ~40%.
- **Versión y CHANGELOG**: bump por ola (13.312.17 → 20).

### Recomendación de orden

Ola 3 se puede mergear sola esta semana (bajo riesgo). Antes de Ola 4 necesito de ti: (a) confirmar que sandbox FacturApi está estable en staging, (b) los 2 secrets nuevos (`E2E_FACTURA_SANDBOX_ID`, `E2E_CUENTA_BANCO_ID`). Ola 6 requiere elegir una ventana con staging "congelado".

### Qué NO propongo (fuera de scope T3)

- Reescribir POs para adopción 100% (~24 specs) — costo alto, beneficio marginal dado que la mayoría usa `getByRole`.
- Portal agente y CRM completos — módulos aparte, plan separado.
- Onboarding/signup — depende de decisión de producto sobre auto-signup público (hoy bloqueado).
