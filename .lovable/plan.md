# Auditoría de rendimiento — por qué la app "se siente lenta"

Analicé base de datos (métricas reales de consultas), patrones de fetch en el frontend, re-renders y assets. **No cambié nada de código.**

## Diagnóstico en una frase

La lentitud **no viene del volumen de datos** (la base es pequeña: 253 embarques, 231 facturas, 176 facturas de proveedor, 828 MB total, disco al 17%). Viene de que **cada consulta paga un "peaje" fijo muy alto** de seguridad multi-tenant, y de que **la app pide lo mismo varias veces**.

Analogía: la bodega tiene pocas cajas, pero en cada pasillo hay un guardia que revisa tu credencial **caja por caja**. Mover 200 cajas tarda más por los 200 chequeos que por el peso.

## Hallazgos, ordenados por impacto esperado

### 1. Peaje de RLS por fila (impacto ALTO — afecta TODA la app)
Hay **90 políticas RESTRICTIVE** que llaman `rls_tenant_scope_ok(organization_id)`. Como el argumento cambia en cada fila, Postgres **no puede cachear** el resultado (no hay "InitPlan"), así que ejecuta `has_role(auth.uid(), 'super_admin')` + `org_scope()` **una vez por fila leída**.

Evidencia dura: `cxp_por_pagar()` promedia **93 ms** (máx 310 ms) sobre una tabla de 176 filas; `auditoria_revisiones` promedia **85 ms** sobre 396 filas. Con índices correctos (los verifiqué: sí existen), esas cifras deberían ser de 2–5 ms. La diferencia es el peaje.

Mejora propuesta: reescribir el guard para que el chequeo de tenant sea comparación directa contra un valor cacheado una sola vez por consulta (p. ej. `organization_id = (select org_scope())` y el bypass de super_admin como `(select has_role(...))` en un OR **no correlacionado**). Esto conserva el aislamiento y elimina la llamada por fila.

### 2. Consultas duplicadas de la misma RPC caraObtener (impacto ALTO — fácil)
- `cxp_por_pagar()` se llama desde **dos query keys distintas**: la bandeja (`bandejas.cxpPorPagar`) y el badge del sidebar (`cxp.porPagarCount`, en `src/features/cxp/services/cxpPorPagarCount.ts:10`). React Query no las deduplica porque las llaves difieren → **la RPC más cara de la app corre el doble**. Peor: el badge trae **todas las filas completas** solo para hacer `data.length`.
  - Registro real: **650 llamadas, 60.8 s acumulados** — la consulta #1 del ranking.
- El contador de "por capturar" (`useEntrantesPorCapturarCount.ts:33`) tiene `refetchInterval: 60_000` y acumula **2,385 llamadas**.
- `sidebar_alert_counts()`: **775 llamadas, 16.6 s**, con `refetchInterval` de 5 min sobre datos de granularidad diaria.

Mejoras: reutilizar una sola query key para "por pagar" (o una RPC dedicada que devuelva solo el `count`), subir intervalos de badges a 15–30 min (o solo invalidar tras mutaciones) y hacer que los contadores devuelvan un número, no filas.

### 3. RPCs de reportes que agregan todo en cada carga (impacto MEDIO-ALTO)
`dashboard_summary` y `cxc_aging_clientes` recorren `facturas` + `pagos_factura` + `proveedor_facturas` con varios `GROUP BY` y un `LATERAL` de tipo de cambio DOF **por fila**, en cada apertura de Dashboard y Cartera. Hoy aguanta por el bajo volumen, pero es lo primero que se degradará al crecer.

Mejora: precalcular por embarque/factura (columna o tabla de apoyo mantenida por trigger) o cachear el resumen con `staleTime` largo + invalidación por mutación.

### 4. Assets iniciales pesados (impacto MEDIO en la primera carga)
- `public/favicon.png` = **126 KB** (es una copia exacta de `icon-512.png`) y se declara en `index.html:11` como icono 512 → se descarga en cada primera visita. Un favicon debería pesar 2–5 KB.
- `public/librecarga-logo.png` = **118 KB** en PNG (debería ser WebP < 20 KB).
- `og-image.jpg` = 118 KB (solo lo usan redes sociales, aceptable).
- Fuente Inter con **6 pesos** (`index.html:28`); normalmente bastan 3 (400/600/700).

### 5. Bundle: sin estrategia de vendor chunks (impacto MEDIO, riesgo alto de tocar)
`vite.config.ts` eliminó `manualChunks` a propósito (causaba pantalla blanca por imports circulares de recharts/@react-pdf). Las rutas **sí** están lazy-loaded (77 rutas en `appRoutes.lazy.ts`) y `xlsx`/`@react-pdf`/`recharts` se cargan con `import()` dinámico — esto ya está bien hecho. Queda medir el peso real por chunk con `ANALYZE=true` antes de tocar nada.

### 6. Lo que ya está sano (no hay que arreglarlo)
- `staleTime: 60s`, `refetchOnWindowFocus: false` globales en `src/lib/query/queryClient.ts`.
- Sin N+1 por fila; sin `lodash`; `date-fns` con imports nombrados.
- Virtualización activa (`@tanstack/react-virtual`) en tablas y bitácora.
- `AuthContext` memoiza su value; hay preload de rutas en idle.
- Índices parciales `WHERE deleted_at IS NULL` presentes en `facturas` y `proveedor_facturas`.
- Salud de base: memoria 50%, conexiones 14/60, 0 reinicios. **No hace falta subir el tamaño de la instancia.**

## Orden de ejecución recomendado

| # | Acción | Esfuerzo | Ganancia esperada |
|---|--------|----------|-------------------|
| 1 | Deduplicar `cxp_por_pagar` + contadores que devuelvan `count` | Bajo | −40% de tiempo de BD acumulado |
| 2 | Subir intervalos de refetch de badges (5 min → 30 min) | Muy bajo | Menos ruido constante de red |
| 3 | Reescribir `rls_tenant_scope_ok` para evitar evaluación por fila | Medio-alto (requiere pruebas de aislamiento) | Consultas de 90 ms → 5–15 ms en toda la app |
| 4 | Comprimir favicon/logo y recortar pesos de Inter | Bajo | Primera carga más rápida |
| 5 | Cachear/precalcular `dashboard_summary` y `cxc_aging_clientes` | Medio | Dashboard y Cartera instantáneos |
| 6 | Medir bundle con `ANALYZE=true` y decidir splits seguros | Bajo (solo medir) | Datos para decidir |

## Notas técnicas

- El punto 3 es el de mayor impacto pero el más delicado: toca 90 políticas de aislamiento multi-tenant. Debe ir con las suites de RLS del CI verdes y validación con Super Admin + tenant normal antes de publicar.
- Las 17,983 transacciones revertidas desde el último reinicio son acumuladas (en gran parte guards `LC_*` funcionando como se espera); no indican un problema de rendimiento por sí solas.
- Este documento es solo el reporte solicitado. Dime cuáles puntos apruebas y armo el plan de implementación con cambios reales, CHANGELOG y bump de versión.
