

# Plan: Mejoras de Esfuerzo Bajo

Las 4 mejoras clasificadas como esfuerzo bajo del analisis anterior. No requieren cambios en la base de datos.

---

## 1. Historial de Embarques y Cotizaciones por Cliente

**Archivo:** `src/pages/ClienteDetalle.tsx`

- Agregar dos hooks nuevos que consulten embarques y cotizaciones filtrados por `cliente_id`
- Agregar pestanas (Tabs) al detalle del cliente: "Información", "Embarques", "Cotizaciones"
- Tab Embarques: tabla con columnas expediente, modo, ruta, estado, ETD/ETA, y totales acumulados (conteo, suma venta/costo si disponible)
- Tab Cotizaciones: tabla con columnas folio, modo, ruta, estado, subtotal, fecha
- Cards resumen arriba: Total embarques, Total cotizaciones, ademas de Contactos registrados

**Hooks nuevos en** `src/hooks/useClientes.ts`:
- `useEmbarquesCliente(clienteId)` — query a `embarques` filtrado por `cliente_id`
- `useCotizacionesCliente(clienteId)` — query a `cotizaciones` filtrado por `cliente_id`

---

## 2. Exportacion CSV en Embarques, Cotizaciones y Facturas

**Nuevo archivo:** `src/lib/exportCsv.ts`
- Funcion generica `exportToCsv(filename, headers, rows)` que genera un archivo CSV y lo descarga via `Blob` + `URL.createObjectURL`

**Archivos modificados:**
- `src/pages/Embarques.tsx` — boton "Exportar CSV" junto al boton "Nuevo Embarque", exporta los datos filtrados actualmente (expediente, cliente, modo, ruta, estado, ETD, ETA)
- `src/pages/Cotizaciones.tsx` — boton "Exportar CSV" junto a "Nueva Cotizacion", exporta filtrados (folio, cliente, modo, ruta, subtotal, estado, vigencia)
- `src/pages/Facturacion.tsx` — boton "Exportar CSV" en la tab de facturas, exporta filtradas (numero, expediente, cliente, monto, moneda, emision, vencimiento, estado)

---

## 3. Widget de Tasa de Conversion de Cotizaciones

**Archivo:** `src/pages/Cotizaciones.tsx`

- Agregar una seccion de 4 KPI cards arriba de la tabla:
  - Total cotizaciones (del periodo filtrado)
  - Aceptadas (count donde estado = 'Aceptada' o 'Embarcada')
  - Rechazadas (count donde estado = 'Rechazada')
  - Tasa de conversion (%) = Aceptadas / Total * 100
- Se calculan con `useMemo` sobre los datos ya cargados de `useCotizaciones()`, respetando los filtros activos
- No requiere queries adicionales ni cambios en DB

---

## 4. Tipos de Cambio Automaticos al Crear Embarque/Cotizacion

**Archivos modificados:**
- `src/hooks/useEmbarqueForm.ts` — al inicializar el form, llamar `useExchangeRates()` y pre-llenar `tipo_cambio_usd` y `tipo_cambio_eur` con los valores de la API (si la fuente en configuracion es "api")
- `src/hooks/useCotizacionWizardForm.ts` — mismo patron: pre-llenar tipo de cambio desde la API al abrir el wizard de nueva cotizacion
- Respetar la configuracion existente: si `fuente === 'manual'`, usar los valores guardados en `configuracion`

---

## Resumen de archivos

| Mejora | Archivos nuevos | Archivos modificados |
|--------|----------------|---------------------|
| Historial por cliente | — | `ClienteDetalle.tsx`, `useClientes.ts` |
| Exportar CSV | `src/lib/exportCsv.ts` | `Embarques.tsx`, `Cotizaciones.tsx`, `Facturacion.tsx` |
| Tasa de conversion | — | `Cotizaciones.tsx` |
| TC automatico | — | `useEmbarqueForm.ts`, `useCotizacionWizardForm.ts` |

No se requieren migraciones de base de datos. Todas las mejoras usan datos y tablas existentes.

