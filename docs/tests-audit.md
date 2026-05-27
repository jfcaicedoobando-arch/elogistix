# Auditoría de tests — v11.59.1

Fecha: 27/05/2026 · Estado actual: **109 archivos / 716 tests** (incluye 18 suites en `services/` tras el Bloque A: crm, embarque, auth, organization). Diagnóstico original sobre 108/724 sigue vigente como histórico.

## Resumen ejecutivo

| Categoría | Encontrados | Reales | Acción |
|---|---|---|---|
| Tests con `.skip` / `.only` / `.todo` | 0 | 0 | Solo CI gate preventivo |
| Aserciones triviales (`expect(true).toBe(true)`) | 0 | 0 | — |
| Tests con imports rotos | 0 | 0 | — |
| Tests "huérfanos" (sin source 1:1) | 26 | 0 | Falsos positivos → mantener con comentario `@cubre` |
| Duplicados reales (mismo input/expectativa) | 3 bloques | 3 bloques | **Eliminar** |
| Re-tests de barrel legacy | 1 archivo | 1 archivo | **Refactorizar** (mantener solo coverage único) |

**Net:** ~10 tests redundantes a eliminar de 724. Suite real ≈ 714 tests sin pérdida de cobertura.

---

## 1. Huérfanos (26) — clasificación detallada

Todos los 26 tests sin par 1:1 fueron verificados: **sus imports resuelven correctamente**. Son tests que cubren un sub-módulo, un barrel `index.ts`, edge-cases en archivo separado, o tests de arquitectura sin source. Ninguno requiere borrado.

| Test | Cubre | Decisión |
|---|---|---|
| `components/__tests__/BitacoraActividad.test.tsx` | `components/shared/BitacoraActividad.tsx` | Mover a `components/shared/__tests__/` |
| `components/shared/dataTable/__tests__/DataTable.{e2e,perf,regression}.test.tsx` | `DataTable` + `VirtualDataTable` | Mantener (suites especializadas) |
| `hooks/__tests__/useAdminOrgDetalle.test.ts` | `types/appRole` (helpers de roles) | Renombrar → `types/__tests__/appRole.test.ts` |
| `hooks/__tests__/useConfiguracionState.test.ts` | `hooks/configuracion/useConfiguracionState` | Mover a `hooks/configuracion/__tests__/` |
| `hooks/__tests__/useEmbarquesListData.test.ts` | helper interno (sin imports) | Renombrar a `mapEmbarques.test.ts` |
| `hooks/__tests__/useListPageState.test.ts` | `hooks/shared/useListPageState` | Mover a `hooks/shared/__tests__/` |
| `hooks/__tests__/usePermissions.test.tsx` | `hooks/shared/usePermissions` | Mover a `hooks/shared/__tests__/` |
| `hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx` | `useAuditoriaEjecutivo` (edge-cases) | Mantener (sufijo `.edge` es convención) |
| `hooks/crm/__tests__/renderPlantilla.test.ts` | helper interno de `usePlantillasMensaje` | Mantener |
| `lib/__tests__/architecture.test.ts` | reglas arquitectónicas (sin source) | Mantener (test de arquitectura) |
| `lib/browserStorage/__tests__/browserStorage.test.ts` | barrel `lib/browserStorage/index.ts` | Mantener |
| `lib/contacto/__tests__/resolverValorContactoDesdeTexto.test.ts` | barrel `../index` | Mantener |
| `lib/financial/__tests__/financialUtils.edge.test.ts` | edge-cases de `financialUtils` | **Ver §3** (tiene duplicados) |
| `lib/formatters/__tests__/formatters.test.ts` | barrel `lib/formatters/index.ts` | **Ver §3** (tiene duplicados) |
| `lib/mappers/__tests__/cotizacionBuildPaso1.test.ts` | `lib/mappers/cotizacion.ts` | Mantener (split por función) |
| `lib/mappers/__tests__/cotizacionPaso1.test.ts` | `lib/mappers/cotizacion.ts` | Mantener (split por función) |
| `lib/mappers/__tests__/embarqueRoundtrip.test.ts` | `embarqueToDb` + `embarqueFromDb` | Mantener (integración) |
| `lib/storage/__tests__/storageUtils.test.ts` | barrel `lib/storage/index.ts` | Mantener |
| `services/__tests__/csfService.test.ts` | `services/csf/index.ts` | Mantener |
| `services/__tests__/idempotency.integration.test.ts` | 3 módulos cross-service | Mantener (integración) |
| `services/__tests__/tracking.test.ts` | `services/tracking/index.ts` | Mantener |
| `services/crm/__tests__/computeLeaderboard.test.ts` | barrel `../index` | Mantener |
| `services/facturas/__tests__/{huecoFacturacion,proyeccion}.test.ts` | barrel/módulos correspondientes | Mantener |

**Conclusión §1:** 0 borrados. Solo movimientos cosméticos opcionales (no en este loop para no alterar el árbol).

---

## 2. Skipped/Only/Todo

```
$ rg '\.(skip|only|todo)\(|xdescribe\(|xit\(' src --type-add 'ts:*.ts' --type-add 'tsx:*.tsx' -tts -ttsx
# (sin resultados)
```

**Conclusión §2:** Limpio. Gate de CI se añade en §5.

---

## 3. Duplicados reales — A ELIMINAR

### 3.1 `formatDate` duplicado en `uiMappings.test.ts`

`src/lib/ui/__tests__/uiMappings.test.ts` líneas 5-16 copian **textualmente** el `describe("formatDate")` de `src/lib/formatters/__tests__/formatters.test.ts` (mismo input, misma expectativa). El primero ya está cubierto.

**Acción:** Eliminar el bloque `describe("formatDate", …)` (líneas 5-16) de `uiMappings.test.ts`. Eliminar el `import { formatDate }`.

**Tests removidos:** 3.

### 3.2 `embarqueWizardSchemas.test.ts` re-testea el barrel

`src/lib/domain/embarqueWizardSchemas.ts` es un **barrel de compatibilidad** que re-exporta de `embarqueWizardCostos.ts`, `embarqueWizardDocumentos.ts`, `embarqueWizardStepValidator.ts`. Los tests de los módulos split ya cubren `validateArchivo`, `validateStepDocumentos`, `validateStepCostos`.

Sin embargo, `embarqueWizardSchemas.test.ts` mantiene coverage **único** para:
- `validateStepDatosGenerales` (2 tests)
- `validateStepRuta` (5 tests)
- `sugerirETA` (2 tests)

**Acción:** Eliminar `describe("validateArchivo")`, `describe("validateStepDocumentos")`, `describe("validateStepCostos")` del archivo. Conservar los 3 describe únicos.

**Tests removidos:** 3 (`validateArchivo`) + 2 (`validateStepDocumentos`) + 3 (`validateStepCostos`) = **8 tests duplicados**.

### 3.3 `sumarEnUSD` lista vacía duplicado

- `src/lib/financial/__tests__/costosUSD.test.ts`: `it("retorna 0 con lista vacía")` → `expect(sumarEnUSD([], 17.5, 19)).toBe(0)`
- `src/lib/financial/__tests__/financialUtils.edge.test.ts`: idéntico.

**Acción:** Eliminar del archivo `.edge` (es el caso menos representativo; el archivo edge debe enfocarse en casos extremos, no en la línea base).

**Tests removidos:** 1.

### 3.4 Falsos positivos en duplicados

- `it("vacío/null → ''")` aparece 3x en `text.test.ts` + `phone.test.ts` pero en **distintos `describe`** (`toTitleCase`, `nombreDesdeEmail`, `formatPhoneMx`). Legítimo.
- `it("convierte MXN a USD")` en `costosUSD.test.ts` (`aUSD`) vs `financialUtils.test.ts` (`convertirAUSD`). Funciones distintas. Legítimo (aunque `aUSD` es wrapper; eliminarlo sería tarea de §4).
- Resto de duplicados son títulos genéricos en bloques distintos.

---

## 4. Sugerencias para próximos sub-loops (no en éste)

- **Consolidar `aUSD` vs `convertirAUSD`:** uno es wrapper. Decidir si mantener ambos exports o deprecar uno.
- **Renombrar/mover huérfanos** (§1) para que `archivo.test.ts` viva junto a `archivo.ts`. Mejora la navegación pero es cosmético.
- **Coverage por archivo:** ejecutar `bunx vitest run --coverage --reporter=json` y revisar archivos con `% lines = 100%` pero `% branches < 80%` (tests superficiales).

## 5. CI gate (pendiente sub-loop siguiente)

Script `scripts/audit-tests.ts` que falle build si aparece:
- `.skip` / `.only` / `.todo` sin comentario `// TODO(#issue):`
- Import roto en `*.test.ts(x)`
- Bloque `describe` o `it` con título idéntico a uno existente en otro archivo (lista blanca para wrappers conscientes).

---

## Total a remover en este loop: **12 tests** (3 + 8 + 1)

Suite resultante esperada: **712 tests** verdes, 0 pérdida de cobertura.
