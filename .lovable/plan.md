
# Estabilizar CI: lint verde, Power-of-10 y coverage ≥ 30%

## Diagnóstico (del zip subido)

CI del último push cerró rojo en 3 jobs. Aggregator reporta `quality=failure`, `tests=failure`, `coverage=failure`.

### 1. Lint (`eslint . --max-warnings 0`) — falla con 3 errores + 9 warnings

| Archivo | Regla | Detalle |
|---|---|---|
| `features/cliente/routes/Clientes.tsx:70` | react-hooks/exhaustive-deps | `useMemo` con dep innecesaria `navigate` |
| `features/costeo/components/CosteoTarifasTable.tsx:212` | react-hooks/exhaustive-deps | `useMemo` con dep innecesaria `rechazar` |
| `hooks/shared/useClientPagedList.ts:120` | react-hooks/exhaustive-deps | `useMemo` falta dep `f` |
| `features/bandejas/routes/Cartera.tsx` | max-lines-per-function (280>200), max-lines (305>250) | |
| `features/bandejas/routes/CxpPorPagar.tsx:37` | max-lines-per-function (224>200) | |
| `features/compras/services/conciliacionEmbarques.ts:60` | complexity (19>16) | `listarConciliacionEmbarques` |
| `features/cxp/routes/Compras.tsx:74` | complexity (17>16) | |
| `features/cxp/services/aprobacionFactura.ts:27` | complexity (19>16) | `mapApiError` |
| `hooks/shared/useServerPagedList.ts:55` | complexity (21>16) | |
| `test/helpers/assertOrgScoped.ts:14` | unused eslint-disable | |
| `test/utils/_supabaseChainMock.ts:7` | unused eslint-disable | |

### 2. Test `architecture-baseline` — Power of 10 falla con 11 archivos > 200 líneas

```text
Cartera.tsx (327)  ·  CxpPorPagar.tsx (270)  ·  Compras.tsx (258)
ComprasNotasCredito.tsx (242)  ·  CosteoTarifasTable.tsx (240)
ComprasConciliacion.tsx (228)  ·  ComprasPagos.tsx (226)
ComprasReportes.tsx (226)  ·  AgenteTarifas.tsx (210)
FacturaDetalle.tsx (206)  ·  Actividades.tsx (201)
```

Cinco de esas son rutas de Compras que introduje esta semana.

### 3. Coverage — funciones 28.93% < umbral 30%

Regla del proyecto: nunca bajar el umbral; escribir tests para el código nuevo. Los servicios y rutas de Compras (`ComprasPagos`, `ComprasNotasCredito`, `ComprasReportes`, `ComprasConciliacion`, matching) están parcialmente testeados a nivel servicio pero las rutas no.

---

## Estrategia

Tres olas ejecutables secuencialmente. Cada una deja CI un paso más cerca de verde. Bump de versión + CHANGELOG al final de cada ola.

### Ola 1 — Lint verde (v13.181.0)

**Objetivo**: `bun run lint --max-warnings 0` termina con exit 0.

1. **Errores de hooks (3)**:
   - `Clientes.tsx:70` — quitar `navigate` del array de deps del `useMemo` (o convertir en `useCallback` si se usa dentro).
   - `CosteoTarifasTable.tsx:212` — quitar `rechazar` del array de deps.
   - `useClientPagedList.ts:120` — agregar `f` al array de deps (o extraer a variable estable).

2. **Complejidad ciclomática (4 warnings)**: refactor mínimo, extraer helpers puros:
   - `conciliacionEmbarques.ts`: partir el reduce en 3 helpers puros (`agrupar`, `calcularCobertura`, `clasificar`). Ya tenemos `clasificar`, extraemos `agrupar` y `derivarMetricas`.
   - `aprobacionFactura.ts mapApiError`: pasar a tabla `code → { title, message }` en lugar de `if/else`.
   - `useServerPagedList.ts`: extraer construcción del query builder a helper.
   - `Compras.tsx (route)`: extraer los cálculos derivados del dashboard a un helper `resumenComprasDashboard`.

3. **Directivas eslint-disable inutilizadas (2 warnings)**:
   - Quitar la línea `// eslint-disable-next-line no-restricted-imports` en `assertOrgScoped.ts:14` y `_supabaseChainMock.ts:7`.

4. **max-lines / max-lines-per-function (2 warnings)** en `Cartera.tsx` y `CxpPorPagar.tsx`: se atacan en la Ola 2 (mismo trabajo que Power-of-10).

### Ola 2 — Power of 10: partir archivos > 200 líneas (v13.182.0)

**Objetivo**: `architecture-baseline` verde.

Patrón único: extraer subcomponentes de presentación a `./_sections/*.tsx` co-ubicados y hooks controllers a `./hooks/use*.ts`. Ningún cambio funcional.

| Archivo | Extraer |
|---|---|
| `Cartera.tsx` (327) | `CarteraKpis.tsx`, `CarteraTable.tsx`, hook `useCarteraController` |
| `CxpPorPagar.tsx` (270) | `CxpPorPagarKpis.tsx`, `CxpPorPagarTable.tsx` |
| `Compras.tsx` route (258) | `ComprasQuickLinks.tsx`, `ComprasUltimasFacturas.tsx` |
| `ComprasNotasCredito.tsx` (242) | `NotasCreditoFilterBar.tsx`, `NotasCreditoTable.tsx` |
| `ComprasPagos.tsx` (226) | `PagosFilterBar.tsx`, `PagosTable.tsx` |
| `ComprasReportes.tsx` (226) | `ReportesTopProveedores.tsx`, `ReportesEvolucionMensual.tsx` |
| `ComprasConciliacion.tsx` (228) | `ConciliacionKpis.tsx`, `ConciliacionTable.tsx` |
| `CosteoTarifasTable.tsx` (240) | fila y toolbar a subcomponentes |
| `AgenteTarifas.tsx` (210) | tarjeta a subcomponente |
| `FacturaDetalle.tsx` (206) | sección de pagos a subcomponente |
| `Actividades.tsx` (201) | filtro/toolbar a subcomponente |

Cada extracción es mecánica, sin tocar lógica de negocio. Los tests existentes de humo (`routes.smoke.test.tsx`) siguen cubriendo.

### Ola 3 — Coverage ≥ 30% funciones (v13.183.0)

**Objetivo**: subir funciones de 28.93% a ≥ 30%. Delta ≈ 1.1 pt. Basta agregar ~15-25 tests bien elegidos sobre helpers puros extraídos en la Ola 2 y sobre servicios ya nuevos sin tests:

- Tests para los helpers extraídos en Ola 1 (`resumenComprasDashboard`, `derivarMetricas` de conciliación, tabla `mapApiError`).
- Tests para servicios nuevos que aún no tienen test: revisar `notasCreditoGlobal` / `pagosGlobal` (ya tienen), `reportes` service (falta), `matching/matcher` (ya tiene).
- Tests para hooks de Compras (`useCarteraController` si se extrae).

Meta operativa: dejar el reporte con "functions ≥ 31%" para tener margen (memoria: no bajar el umbral, sí subir cobertura).

---

## Alcance excluido de este plan

- No se toca la lógica de negocio de ninguna ruta.
- No se cambia el UI del usuario final.
- No hay migraciones de base de datos.
- Cambios en config de eslint o vitest: prohibidos.
