# Bug: chip EIR de la timeline sale 0 para operadores (Valeria)

## Diagnóstico verificado
- Valeria (`coordinador_logistico`, org **Elogistix**) tiene **20 embarques en EIR** en BD.
- El RPC `dashboard_summary()` sí devuelve `EIR: 20` en `conteoPorEstado`.
- Pero en el dashboard, para roles operadores, el scope por defecto es **"Mis embarques"** (`useDashboardController.ts`, línea 36). En ese scope el `conteoPorEstado` se **recalcula en el cliente** a partir de 4 listas (`alertasDemora`, `proximosArribos`, `profitArribosEsteMes`, `embarquesMesSiguiente`), todas alimentadas por el CTE `activos` del RPC que **excluye EIR y Cerrado**.
- Resultado: cuando el scope es "mios", el conteo EIR siempre es 0 aunque haya embarques.

## Analogía
Es como filtrar tu bandeja de entrada por "correos de hoy" y luego contar cuántos son del mes pasado. El filtro ya sacó esos correos, así que el contador da 0 aunque existan.

## Fix (mínimo y quirúrgico)

### 1. Migración BD — `dashboard_details()`
Agregar un CTE `embarques_eir` (id + operador + estadoReal, límite 500, sin desglose financiero) y emitirlo en la respuesta como `embarquesEir`. Payload extra pequeño; no cambia nada existente.

### 2. Frontend — `useDashboardData.ts`
Exponer `embarquesEir` (arreglo `{id, operador, estadoReal}`) tras parsearlo del payload.

### 3. Frontend — `useDashboardController.ts`
En la rama `scope === "mios"`, filtrar `embarquesEir` por `operador === email` y sumar al `conteo.EIR`. Sin cambios en `totalActivos` (EIR nunca fue "activo").

### 4. Test regresión
Nuevo caso en `useDashboardController.test.tsx` que verifique que, con scope "mios" y un EIR asignado al operador, el `conteoPorEstado.EIR` sea > 0.

### 5. Versionado
- `APP_VERSION` → `13.303.13`
- Nueva entrada en `CHANGELOG.md` describiendo el bug y el fix.

## Archivos tocados
- `supabase/migrations/<nueva>.sql` (via herramienta de migración)
- `src/features/dashboard/hooks/useDashboardData.ts`
- `src/features/dashboard/hooks/useDashboardController.ts`
- `src/features/dashboard/hooks/__tests__/useDashboardController.test.tsx` (nuevo caso)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Fuera de alcance
- No modifico `dashboard_summary()` (ya cuenta EIR correctamente para scope "todos").
- No cambio la definición de "activos" ni la semántica de `totalActivos`.
- No toco el listado `/embarques?estado=EIR` (ya funciona correctamente).
