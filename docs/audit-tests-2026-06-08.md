# Auditoría de Tests — 2026-06-08

> Auditoría de los **308 archivos de prueba** del proyecto realizada con 7 subagentes en paralelo.
> Foco: detectar problemas REALES de calidad (falsos positivos, mocks rotos, cobertura insuficiente, tests muertos), no estilo.

## Resumen ejecutivo

| Severidad | Total |
|-----------|------:|
| 🔴 CRITICAL | **8** |
| 🟠 HIGH     | **30** |
| 🟡 MEDIUM   | **36** |
| 🔵 LOW      | **19** |
| **Total hallazgos** | **93** |
| **Archivos con hallazgos** | **57 de 308** (~18.5%) |
| **Archivos limpios** | **251** |

### Distribución por área

| Área | Archivos | C | H | M | L | Limpios |
|---|---:|---:|---:|---:|---:|---:|
| services parte 1 | 34 | 0 | 0 | 5 | 6 | 23 |
| services parte 2 | 34 | 0 | 5 | 10 | 2 | 17 |
| features (auditoria + embarques) | 62 | 4 | 5 | 4 | 3 | 46 |
| hooks + contexts | 68 | 1 | 3 | 5 | 2 | 58 |
| lib | 59 | 2 | 3 | 4 | 2 | 46 |
| pdf + generators + components | 37 | 1 | 14 | 3 | 0 | 21 |
| edge functions + e2e | 14 | 0 | 0 | 5 | 4 | 6 |
| **TOTAL** | **308** | **8** | **30** | **36** | **19** | **217**\* |

\* La diferencia (251 vs 217) se debe a archivos contabilizados como "limpios" en su sección pese a tener un único hallazgo LOW informativo.

### Higiene global (`bun run audit:tests`)

- ✅ 0 `.only`, 0 `.skip` sin issue, 0 `xit`/`xdescribe`.
- ⚠️ 1 título duplicado entre archivos: `it("retorna 0 con lista vacía", …)` en `src/lib/financial/__tests__/costosUSD.test.ts:17` y `financialUtils.test.ts:136,149` → ver H-2.
- ✅ 0 llamadas de red reales (`fetch` sin mock).
- ⚠️ 1 `expect(true).toBe(true)` tautológico (`BreadcrumbContext.test.tsx:27` → ver C-3).

---

## Top hallazgos CRITICAL (8) — acción inmediata

### C-1 — Tests que copian código en lugar de importarlo (3 archivos)
Los tests **redefinen localmente** la lógica bajo prueba en vez de importarla. Si la implementación real cambia, el test sigue verde.

- `src/lib/__tests__/sentry.test.ts:6-24` — replica `isReactRefreshHmrError` / `isReactRefreshStackTrace`.
- `src/hooks/__tests__/useAdminOrgDetalle.test.ts:1-122` — no importa el hook; redefine `groupConfigByCategoria` y `MemberRow`.
- `supabase/functions/parse-csf/validate_test.ts:6-11` — replica `validateFile` con comentario «copia local del helper».

**Fix:** exportar las funciones desde el módulo real e importarlas. Eliminar la copia.

### C-2 — Tests sin aserción real de comportamiento
- `src/pdf/render/__tests__/descargarPdf.test.ts:22-28` — `expect(async () => { /* vacío */ }).not.toThrow()` siempre pasa. El cuerpo ni siquiera llama a `descargarPdf`.
- `src/contexts/__tests__/BreadcrumbContext.test.tsx:27` — termina con `expect(true).toBe(true)` después de renderizar el hook sin validar estado.

### C-3 — Mocks ad-hoc de Supabase rotos (4 archivos en `features/auditoria/services`)
Construyen una cadena thenable manual con `this._data` en lugar de usar el utilitario `createSupabaseMock` central. Si el SUT agrega un operador (`.range()`, `.match()`, `.throwOnError()`), el mock falla silenciosamente y permite tests verdes contra escenarios irreales.

- `src/features/auditoria/services/__tests__/comentarios.test.ts:4-20`
- `src/features/auditoria/services/__tests__/revisiones.test.ts:4-20`
- `src/features/auditoria/services/__tests__/snapshots.test.ts:4-18`
- `src/features/auditoria/services/__tests__/snooze.test.ts:12-37`

**Fix:** migrar a `createSupabaseMock()` (ver `src/test/utils/_supabaseChainMock.ts` y `mem://technical/testing-mock-patterns`).

### C-4 — Edge case crítico de dominio financiero sin cubrir
- `src/lib/financial/__tests__/costosUSD.test.ts` — `aUSD(monto, "MXN", 0, _)` produce `Infinity` y no hay test que lo detecte. Función pura de cálculo de costos en USD; un `tcUSD = 0` por mala carga del tipo de cambio se propagaría a totales.

---

## Top hallazgos HIGH (30) — priorizados

### H-1 — Barrel tests con sólo `toBeDefined()` (6 archivos)
Verifican únicamente que los re-exports existen. No detectan ninguna regresión funcional. Equivalen al typecheck que ya corre el CI.

- `src/services/comisiones/__tests__/index.test.ts`
- `src/services/cxp/__tests__/index.test.ts`
- `src/services/presupuesto/__tests__/index.test.ts`
- `src/services/profit/__tests__/index.test.ts`
- `src/services/tesoreria/__tests__/index.test.ts`
- `src/features/auditoria/services/__tests__/index.test.ts`

**Fix:** eliminar o reemplazar por un único smoke (`expect(Object.keys(idx).length).toBeGreaterThan(0)`); idealmente cubrir el comportamiento real desde los tests de cada submódulo.

### H-2 — Tests de PDF que sólo verifican `toBeDefined` sobre el stub (10 archivos)
Todos renderizan un Document con datos no triviales pero la única aserción es `expect(getByTestId("pdf-doc")).toBeDefined()` (o `length > 0`). El stub central siempre devuelve ese nodo, por lo que el contenido (folio, cliente, totales) **nunca se valida**.

- `src/pdf/documents/__tests__/CotizacionDocument.test.tsx:18,24`
- `src/pdf/documents/__tests__/ProformaConsolidadaDocument.test.tsx:16,27`
- `src/pdf/documents/__tests__/ProformaDocument.test.tsx:21-33` (además, dos `it` idénticos: test duplicado/muerto).
- `src/pdf/documents/__tests__/ProformaHeader.test.tsx:17,30`
- `src/pdf/documents/__tests__/RentabilidadDocument.test.tsx:22,33`
- `src/pdf/documents/__tests__/ReporteCarteraDocument.test.tsx:7,14`
- `src/pdf/documents/__tests__/ReporteEERRDocument.test.tsx:16,23`
- `src/pdf/documents/__tests__/ReporteEjecutivoDocument.test.tsx:34,48`
- `src/pdf/documents/__tests__/ReportePresupuestoDocument.test.tsx:15,22`
- `src/pdf/documents/__tests__/ReporteTesoreriaDocument.test.tsx:13,21`

**Fix patrón:** sustituir por `expect(screen.getByText("COT-001")).toBeInTheDocument()` para folio/cliente/totales clave. El stub ya expone los `<Text>` con `data-testid="pdf-text"`.

### H-3 — Tests de tema PDF sin valores concretos (3 archivos)
Sólo verifican existencia de claves del StyleSheet (`expect(styles.page).toBeDefined()`).

- `src/pdf/theme/__tests__/styles.test.ts:6-15`
- `src/pdf/theme/__tests__/stylesContent.test.ts:6-20`
- `src/pdf/theme/__tests__/stylesLayout.test.ts:5-18`

**Fix:** validar valores críticos (`fontSize`, `padding`, `backgroundColor`) que romperían el layout si cambian.

### H-4 — Mocks de Supabase con estado mutable compartido (2 servicios)
`_data` se muta directamente sobre el objeto del chain y no se resetea entre `it()`. Si los tests se reordenan, el test de error path recibe el `data` del anterior.

- `src/services/organization/__tests__/index.test.ts:11-35` — además, el test de error coexiste con `_data` válido del test previo.
- `src/services/notificaciones/__tests__/index.test.ts:11-66` — mock ad-hoc complejo con dos terminales (`range` + `then`) que pueden divergir del comportamiento real de Supabase JS v2.

### H-5 — Triple `vi.mock` del mismo módulo
- `src/hooks/facturacion/__tests__/useTabProformasController.test.tsx:12-24` — `@/hooks/shared` se mockea tres veces; sólo prevalece la última, descartando silenciosamente los mocks de `useOrgFilter` y `useToast`.

**Fix:** consolidar en un único `vi.mock` con todos los exports.

### H-6 — Hooks con sólo "smoke tests"
- `src/features/embarques/hooks/__tests__/useProformas.test.tsx` — sólo verifica `typeof refetch === "function"` y `mutate` defined; no ejecuta flujo.
- `src/features/embarques/hooks/__tests__/useTrackingLinks.test.tsx` — único test verifica `mutate` defined.
- `src/hooks/profit/__tests__/useProfit.test.tsx:28-37` — `expect(result.current).toBeDefined()` y un segundo `it` sin aserciones de datos.

### H-7 — Otros HIGH
- `src/features/embarques/domain/__tests__/embarqueWizardStepValidator.test.ts:42` — `expect(typeof errors === "object")` pasa con `null`, `[]`, cualquier objeto.
- `src/features/embarques/hooks/__tests__/useCotizacionHydration.test.tsx:29` — aserción síncrona sobre callback disparado en `useEffect`; debería usar `waitFor`.
- `src/lib/financial/__tests__/financialUtils.test.ts:136,149` + `costosUSD.test.ts:17` — título `"retorna 0 con lista vacía"` triplicado.
- `src/lib/parsers/__tests__/dashboardSchemas.test.ts` — schemas Zod sin caso inválido (`arribosEsteMesSchema`, `cargaPorClienteSchema`).
- `src/lib/mappers/__tests__/_helpers.test.ts` — `num("NaN")` y `num("Infinity")` no cubiertos; pueden propagar `NaN` a totales financieros.

---

## Hallazgos MEDIUM (36) — agrupados

### M-1 — Mocks sin reset entre `it()` (`mockClear`/`beforeEach` ausente)
`src/services/bitacora/__tests__/index.test.ts:6-18`, `catalogos/index.test.ts:4-17`, `configuracion/emisor.test.ts:8-14`, `csf/index.test.ts:24-32`, `dashboard/index.test.ts:1-28`, `operaciones/index.test.ts`, `planes/index.test.ts`.

### M-2 — Solo happy-path en services
Faltan tests de error path:
- `services/reportes/index.test.ts`, `services/search/index.test.ts`, `services/tracking/index.test.ts`, `services/profit/estadoResultadosDevengado.test.ts`.

### M-3 — Aserciones débiles
- `services/tesoreria/resumen.test.ts:27-36` — el test normaliza el silenciamiento de error del servicio sin verificar que se loguea.
- `services/tesoreria/flujoProyectado.test.ts:29-31` — `expect(res).toBeDefined()` tras error.
- `features/embarques/domain/.../embarqueWizardStepValidator.test.ts:42`, `useEmbarqueEstadoActions.test.tsx:31`, `useEmbarqueDocumentosActions.test.tsx`, `cotizacionSections.test.tsx:23,27`.
- `hooks/dashboard/useDashboard.test.tsx:26` — `expect(result.current.alertasDemora).toBeDefined()` pasa con `null`/`[]`/`0`.
- `hooks/catalogos/useTasaIVA.test.tsx:15-19` — dos tests funcionalmente idénticos.
- `hooks/catalogos/useExchangeRates.test.tsx:20-23` — verifica `isLoading=true` justo tras render (siempre verdadero).

### M-4 — Cobertura faltante en módulos sensibles
- `lib/domain/estadoResultados.test.ts` — moneda EUR no cubierta.
- `lib/parsers/dashboardProfit.test.ts` — `numOr0("NaN")` y `safeMargen(neg, neg)` no cubiertos.
- `lib/mappers/cotizacionBuildPaso1.test.ts` y `cotizacionPaso1.test.ts` — cobertura duplicada (mismo SUT, mismos escenarios).
- `contexts/auth/__tests__/useAuthProfile.test.ts` y `useAuthSession.test.ts` — sin tests de error de fetch.

### M-5 — E2E / Edge functions
- `e2e/specs/02-embarque.spec.ts:21-27` — `if (await firstRow.isVisible())` permite que el test pase verde sin asserts cuando no hay datos sembrados.
- `e2e/specs/04-conciliacion.spec.ts:14-16` — locator triple (`table tbody tr, [role=row], [data-empty=true]`) puede resolver al header.
- Tests tautológicos: `supabase/functions/auditoria-weekly-digest/digest_test.ts:62-68`, `auditoria-snapshot-daily/snapshot_test.ts:29-51`.

### M-6 — Perf umbrales absolutos en CI
- `src/components/shared/dataTable/__tests__/DataTable.perf.test.tsx:102,162,176,190` — ceilings absolutos (250/600/1200/2200 ms) frágiles en runners de 1 núcleo.

---

## Hallazgos LOW (19) — backlog

Aserciones `toHaveBeenCalled()` sin `toHaveBeenCalledWith`, `rejects.toBeTruthy()`, casos edge cosméticos. Ver reportes por área para detalle.

Highlights:
- `services/__tests__/idempotency.integration.test.ts:181` — `.rejects.toBeTruthy()` en lugar de `toMatchObject`.
- `services/cxp/__tests__/pagosProveedor.test.ts:38-39` — verifica que las tablas aparecen, no qué datos se escribieron (servicio crítico de pagos).
- `services/proforma/__tests__/facturar.test.ts:30-41` — no valida la fecha de vencimiento calculada.
- `auth_test.ts:32-60` — sin caso `userId=""`/`null`.
- `e2e/fixtures/auth.ts:27-33` — login real en cada spec (sin `storageState`); ~3-5s extras por spec.
- `lib/query/__tests__/keys-shape.test.ts` — `EXPECTED_DOMAINS` hardcoded; usar diff explícito.
- Edge functions: falta cobertura 4xx/5xx del handler HTTP completo (`snapshot_test.ts`, `digest_test.ts`, `tracking_test.ts`, `validate_test.ts`).

---

## Hallazgos POSITIVOS

- ✅ `src/pdf/render/__tests__/pdfRenderLeak.test.tsx` — canary de 200 renders correctamente implementado (warm-up de 10, `global.gc()` opcional, 50 MB threshold).
- ✅ `src/lib/__tests__/architecture-baseline.test.ts` y `architecture.test.ts` — protecciones arquitectónicas activas.
- ✅ Auditoría de higiene (`audit:tests`) sin `.only`/`.skip` huérfanos.
- ✅ `_supabaseChainMock` central usado correctamente en ~30 servicios.

---

## Recomendaciones de remediación priorizadas

### Sprint 1 — CRITICAL + HIGH (sugerido)
1. Eliminar las 3 copias locales de funciones bajo prueba (C-1).
2. Reparar los 2 tests sin aserción real (C-2).
3. Migrar los 4 mocks ad-hoc de `auditoria/services` a `createSupabaseMock` (C-3).
4. Agregar test de `tcUSD=0` para `aUSD` (C-4).
5. Eliminar los 6 barrel-tests inútiles o reemplazarlos por smoke real (H-1).
6. Reescribir los 10 tests de Documents PDF con aserciones de contenido (H-2).
7. Validar valores concretos en los 3 tests de theme PDF (H-3).
8. Reset de estado en mocks de `organization` y `notificaciones` (H-4).
9. Consolidar `vi.mock` en `useTabProformasController.test.tsx` (H-5).
10. Convertir los 3 hooks "smoke-only" en tests funcionales (H-6).

### Sprint 2 — MEDIUM
- Estandarizar `beforeEach(() => vi.clearAllMocks())` en todos los services con mocks ad-hoc (M-1).
- Cubrir error-path en services restantes (M-2).
- Sustituir `toBeDefined()` débiles por aserciones de estructura (M-3).
- Cubrir branches EUR/NaN/negativo en dominio financiero (M-4).
- Sembrar datos para E2E o usar `test.skip` explícito (M-5).
- Suavizar umbrales absolutos de perf o eliminarlos (M-6).

### Sprint 3 — LOW
- Backlog de pulido: `toHaveBeenCalledWith`, `rejects.toMatchObject`, `storageState` para Playwright, cobertura HTTP 4xx/5xx en edge functions.

---

## Anexo: 8 archivos candidatos a eliminar o reescribir desde cero

Tests que aportan más ruido que cobertura real:

1. `src/services/comisiones/__tests__/index.test.ts`
2. `src/services/cxp/__tests__/index.test.ts`
3. `src/services/presupuesto/__tests__/index.test.ts`
4. `src/services/profit/__tests__/index.test.ts`
5. `src/services/tesoreria/__tests__/index.test.ts`
6. `src/features/auditoria/services/__tests__/index.test.ts`
7. `src/hooks/__tests__/useAdminOrgDetalle.test.ts` (no testea el hook real)
8. `src/pdf/render/__tests__/descargarPdf.test.ts` (cuerpo vacío)

---

**Auditores:** 7 subagentes paralelos (A1–A7) sobre 308 archivos.
**Metodología:** lectura individual de cada archivo, clasificación por 10 reglas (falsos positivos, acoplamiento a implementación, mocks rotos, solo happy-path, .skip/.only, async mal manejado, frágil/lento, test muerto, mocks Supabase incorrectos, aserciones débiles).
**Precisión > recall:** sólo se reportan hallazgos verificables con cita `archivo:línea`.
