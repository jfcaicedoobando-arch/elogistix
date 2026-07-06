## Objetivo

Cerrar la Ola A con **verificación + tests** y arrancar la **Ola B** del módulo de Compras.

Analogía: ya instalamos los candados de la Ola A (sobrepago, cierre sin pago). Ahora hay que **probar que las llaves funcionan** y empezar a montar los **atajos de productividad** de la Ola B.

---

## Parte 1 — Verificación Ola A (sin cambios de código)

Revisar en runtime que las 4 piezas quedaron bien:

1. **A1 · CFDI** — abrir "Nueva factura de proveedor" y confirmar que "Subir XML" pre-llena campos (ya existente, sólo smoke test).
2. **A2 · Duplicados** — `existeFacturaDuplicada` en el submit + UUID único en BD (ya cubierto). Confirmar que error se traduce.
3. **A3 · Sobrepago servidor** — verificar que el trigger `trg_check_no_sobrepago` está activo en `pagos_proveedor` con `supabase--read_query`.
4. **A4 · Cerrar sin pago** — verificar que el RPC `cerrar_factura_proveedor_sin_pago` existe y las columnas `es_ajuste`/`motivo_ajuste` están en `pagos_proveedor`.

Si algo falta, se corrige en el mismo turno de build.

---

## Parte 2 — Tests para Ola A

Todos en `src/features/cxp/**/__tests__/` siguiendo el patrón del proyecto (Vitest + cadena thenable para mocks Supabase, ver `mem://technical/testing-mock-patterns`).

### 2.1 Tests de servicios (unitarios, sin UI)
- **`cerrarFacturaSinPago.test.ts`** *(nuevo)* — cubre:
  - Llama al RPC con parámetros correctos (`p_factura_id`, `p_motivo`, `p_comentario`).
  - Propaga errores de RPC como `Error` con mensaje traducido.
  - Motivos válidos: `compensacion`, `condonacion`, `ajuste_historico`, `duplicada`.
- **`pagosProveedorErrors.test.ts`** *(ampliar existente)* — agregar caso:
  - Traduce `SOBREPAGO_PROVEEDOR` de PostgrestError a mensaje en español.

### 2.2 Tests de hooks
- **`useCerrarFacturaSinPago.test.tsx`** *(nuevo)* — cubre:
  - Estado `loading` mientras el RPC corre.
  - `onSuccess` invalida queries de facturas y pagos.
  - Toast de error cuando el RPC falla.

### 2.3 Tests de componentes (dialog)
- **`CerrarFacturaSinPagoDialog.test.tsx`** *(nuevo)* — cubre:
  - Motivo obligatorio: botón "Cerrar" deshabilitado hasta seleccionar.
  - Requiere escribir "CERRAR" en el input de confirmación.
  - Llama al hook con payload correcto al confirmar.

### 2.4 Tests de integridad (A2/A3)
- **`existeFacturaDuplicada.test.ts`** *(nuevo si no existe)* — proveedor+folio ya existente devuelve `true`, distinto devuelve `false`.
- **A3 se prueba en BD, no en frontend** — la prueba real la da el trigger; añadimos un test de servicio en `pagosProveedor.test.ts` que verifica que si Supabase responde con `SOBREPAGO_PROVEEDOR`, el error llega traducido al UI.

**Meta:** todos los tests nuevos deben pasar `bunx vitest run` sin bajar el umbral de coverage (memoria core).

---

## Parte 3 — Arranque Ola B

Se implementan **B1 y B4 en este ciclo** (ambos bajo riesgo, alto ROI). B2 y B3 quedan para un siguiente PR porque tocan tesorería/notificaciones y merecen su propia revisión.

### B1 · Aging por proveedor con drill-down
**Dónde:** `src/pages/compras/AgingCxP.tsx` + `useCxpAging.ts`.
- Al hacer click en una cubeta (`0-30`, `31-60`, `61-90`, `+90`) abrir modal `<AgingDrillDownDialog>` con:
  - Tabla agrupada por proveedor: nombre, # facturas, monto total, monto en la cubeta.
  - Expandible por proveedor → lista de facturas con folio, fecha, días vencidos, saldo.
  - Botón "Exportar a Excel" (reusar patrón `xlsx` del proyecto).
- Nuevo servicio `cxpAgingDrilldown.ts` con query filtrada por rango de días.
- Tests: servicio (agrupamiento correcto) + componente (renderiza filas, exportación llama al helper).

### B4 · Aprobación en lote
**Dónde:** `src/pages/compras/PorAprobar.tsx` (o equivalente) + `useAprobarFactura.ts`.
- Checkbox por fila + checkbox master en header.
- Botón "Aprobar seleccionadas (N)" en toolbar con **AlertDialog** de confirmación mostrando conteo y total MXN/USD.
- Nuevo hook `useAprobarFacturasLote` que hace las llamadas secuencialmente (no paralelas — evita saturar) con progreso, y muestra toast final con éxitos/fallos.
- Rechazo se mantiene individual (requiere motivo, memoria del proyecto).
- Tests: hook (todos ok, algunos fallan, agrega resumen), UI (checkbox master selecciona todo, botón deshabilitado si N=0).

**No incluido en este ciclo:** B2 (conciliación → notificaciones internas) y B3 (layout SPEI/BBVA). Los propongo cuando B1+B4 estén verificados.

---

## Detalles técnicos

- **Migraciones:** ninguna para tests. Para B1/B4 tampoco (usan tablas existentes: `proveedor_facturas`, `pagos_proveedor`).
- **Nuevos archivos previstos** (~8 tests + 4 features):
  - `src/features/cxp/services/__tests__/cerrarFacturaSinPago.test.ts`
  - `src/features/cxp/hooks/__tests__/useCerrarFacturaSinPago.test.tsx`
  - `src/features/cxp/components/__tests__/CerrarFacturaSinPagoDialog.test.tsx`
  - `src/features/cxp/services/__tests__/existeFacturaDuplicada.test.ts`
  - `src/features/cxp/services/cxpAgingDrilldown.ts` + test
  - `src/features/cxp/components/AgingDrillDownDialog.tsx` + test
  - `src/features/cxp/hooks/useAprobarFacturasLote.ts` + test
  - Toolbar de selección múltiple en la página de "Por aprobar"
- **Versionado:** bump `APP_VERSION` a `13.205.0` + entrada en `CHANGELOG.md` con Ola A verificada, tests añadidos y B1+B4 entregados.
- **Coverage:** cada archivo nuevo lleva su test (memoria `mem://principles/coverage-threshold`).
- **UI:** modales usan `FormDialogShell` (memoria core). Nada de estilos inline, nada de `text-white`/hex crudos.

---

## Entregables al terminar

1. Ola A verificada en BD + tests que la cubren.
2. Ola B parcial: B1 (aging drill-down) y B4 (aprobación en lote) funcionando con tests.
3. `CHANGELOG.md` y `APP_VERSION` actualizados.
4. Propuesta escrita para arrancar B2/B3 en el siguiente turno.
