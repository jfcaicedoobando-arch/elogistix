# Auditoría de Tests — Plan de Mejora

**Estado actual:** 407 archivos de test · 0 violaciones de higiene · cobertura 29% líneas / 46.8% funciones.
**Hallazgo principal:** la suite es grande pero **superficial**. Muchos tests verifican que algo fue invocado sin validar el contrato, y los hooks-controlador más críticos del negocio no tienen test alguno.

---

## Parte A — Tests existentes a MEJORAR (15 prioritarios)

### A.1 Asserts vagos → asserts específicos (5 tests)
Reemplazar `toBeTruthy()`, `toHaveBeenCalled()`, `rejects.toBeTruthy()` por verificación de contrato real.

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/features/proveedor/hooks/__tests__/useProveedores.test.tsx:23,30` | `toHaveBeenCalledWith({page,pageSize,organizationId})` + verificar payload de insert |
| 2 | `src/features/tesoreria/hooks/__tests__/useTesoreria.test.tsx:26` | Validar args del query + assert sobre `result.current.data.semanas[0]` |
| 3 | `src/features/cxp/hooks/__tests__/useCxP.test.tsx:48` | `toHaveBeenCalledWith({proveedor_factura_id, monto, moneda})` |
| 4 | `src/lib/roles/__tests__/roleCatalog.test.ts:31-32` | Snapshot o values concretos por rol (no solo truthy) |
| 5 | `src/features/auditoria/hooks/__tests__/useAuditoriaEjecutivo.test.tsx:244` | Regex de fecha es-MX en `generadoEn` |

### A.2 Eliminar `as any` en fixtures (4 tests)
| # | Archivo | Cambio |
|---|---------|--------|
| 6 | `src/pdf/documents/__tests__/cotizacionSections.test.tsx` (+ 6 archivos PDF) | Crear `src/test/fixtures/cotizacionFactory.ts` con `satisfies CotizacionData` |
| 7 | `src/features/embarques/hooks/__tests__/useEmbarqueSubmitOrchestrator.test.tsx:70` | Tipar `mockParams` con `Parameters<typeof submit>[0]` |
| 8 | Auditar el resto: `rg "as any" src -g "*.test.*" -l` (≈39 archivos) | Migrar gradualmente a factories tipadas |

### A.3 Agregar error paths faltantes (4 tests)
| # | Archivo | Casos a agregar |
|---|---------|-----------------|
| 9 | `src/features/embarques/hooks/__tests__/useEmbarqueSubmitOrchestrator.test.tsx` | falla `resolverExpediente`, falla `subirDocumentos`, modo "existente" |
| 10 | `src/features/embarques/hooks/__tests__/useEmbarqueFullQuery.test.tsx` | error de red, datos parciales, cambio de id |
| 11 | `src/features/crm/services/__tests__/etapas.test.ts:36,45,52` | `rejects.toThrow("mensaje específico")` en lugar de truthy |
| 12 | `src/contexts/__tests__/AuthContext.test.tsx` | Escenario con usuario autenticado, cálculo de `effectiveRole`, flujo `signOut` |

### A.4 Test name ≠ assert (3 tests)
| # | Archivo | Cambio |
|---|---------|--------|
| 13 | `src/features/embarques/hooks/__tests__/useEmbarqueEstadoActions.test.tsx:47-48` | Verificar valor concreto de transición (`"Confirmado" → "En tránsito"`), no `typeof === "string"` |
| 14 | `src/features/cotizacion/services/__tests__/informativa.test.ts:93` | `toMatchObject({id, folio})` en lugar de `toBeTruthy()` |
| 15 | `src/services/observability/__tests__/logClientError.test.ts:47` | Añadir `expect(invoke).toHaveBeenCalledOnce()` tras el `not.toThrow()` |

---

## Parte B — Tests FALTANTES (priorizado por impacto)

### B.1 Hooks-controlador críticos sin test (TOP 10)
Total ≈4,500 líneas de lógica pura sin cobertura.

1. `useNuevaFacturaProveedorForm.ts` (CXP + CFDI parsing)
2. `useNuevoEmbarqueWizard.ts` (wizard 5 pasos)
3. `useCotizacionWizardSteps.ts` (funnel ventas)
4. `useTabProformasPendientesController.ts` (aprobación facturación)
5. `useEmbarquesPageController.ts` (pantalla operativa principal)
6. `useCotizacionDetalleHandlers.ts` (edición inline)
7. `useOperacionesData.ts` (KPIs dashboard)
8. `useTabProyeccionController.ts` (proyección cobranza)
9. `useFacturacionPageController.ts` (orquestador facturación)
10. `usePortalData.ts` (riesgo de data-leak entre clientes)

**Patrón:** `renderHook` + `_supabaseChainMock` + 3-5 casos cada uno (happy + 2-3 error paths + edge case).

### B.2 Edge Functions con cobertura insuficiente (TOP 5)
1. `user-management` — falta cubrir `handlers.ts` (240) y `clientHandlers.ts` (218)
2. `cxc-recordatorios` — solo 18 líneas de test
3. `parse-cfdi-xml` — falta CFDI 3.2, complementos de pago, retenciones
4. `process-email-queue` — falta cobertura de `messageProcessor.ts` y `queueAuth.ts`
5. `auditoria-weekly-digest` — falta org vacía, >1000 eventos, nulls

### B.3 Tests de integración interna (5 flujos cross-módulo)
1. Cotización → Embarque (conversión con costos heredados)
2. Embarque → Proforma → Factura (CFDI emitida)
3. Factura proveedor (CFDI) → Conciliación bancaria
4. Comisión devengada → Liquidación → afectación saldo
5. Portal cliente — aprobación de cotización end-to-end interno

### B.4 RLS SQL — tablas financieras sin test
Ampliar `supabase/tests/rls/` con: `comisiones_devengadas`, `liquidaciones_comision`, `cuentas_bancarias`, `bbva_movimientos`, `proveedor_facturas`, `pagos_factura`, `pagos_proveedor`, `cotizacion_costos`, `factura_notas_credito`. **Mayor riesgo regulatorio del sistema.**

### B.5 NO testear (denominador limpio)
`*Columns.tsx`, `src/pages/marketing/**`, `landingCopy.ts`, `src/types/**`. Ya excluidos en `vitest.config.ts` — confirmar que las exclusiones aplican a archivos nuevos.

---

## Estrategia 80/20 (29% → 45% cobertura)

| Movimiento | Esfuerzo | Δ Cobertura estimado |
|------------|----------|----------------------|
| B.1 — 10 hooks-controlador (40-50 tests) | Alto | +5-8 pts líneas, +8-10 pts funciones |
| B.3 — 5 tests integración interna | Medio | +3-4 pts líneas (cubren 3-4 archivos c/u) |
| B.2 — Profundizar edge functions | Medio | Riesgo seguridad (admin) |
| B.4 — RLS financiero | Bajo | Riesgo regulatorio multi-tenant |
| A.1-A.4 — Mejorar 15 tests existentes | Bajo | 0 pts pero ↑ calidad/regresión real |

---

## Detalles técnicos

- Patrón base de mock: `src/test/utils/_supabaseChainMock.ts` (ya usado por servicios de tesorería).
- Factories tipadas: nueva carpeta `src/test/fixtures/` con builders `satisfies T`.
- Sin tocar `vitest.config.ts` (umbrales actuales ya tienen ratchet plan).
- Cada PR debe actualizar `CHANGELOG.md` + bumpear `APP_VERSION` (regla del proyecto).
- Edge functions: usar `supabase--test_edge_functions` para validar.

---

## Orden de ejecución propuesto

**Fase 1 (1 sesión):** A.1 + A.4 — fix de asserts vagos (alto ROI, bajo riesgo).
**Fase 2 (1 sesión):** A.2 — factories tipadas + reemplazo de `as any` en PDF tests.
**Fase 3 (2-3 sesiones):** B.1 — hooks-controlador TOP 5 (#1-#5).
**Fase 4 (1 sesión):** B.4 — RLS financiero (riesgo regulatorio).
**Fase 5:** B.3 integración + B.2 edge functions + resto de B.1.

¿Quieres que arranque por la **Fase 1** (fix rápido de asserts vagos) o prefieres que ataque directo la **Fase 3** (los hooks-controlador sin cobertura, que es donde más se mueve la aguja)?
