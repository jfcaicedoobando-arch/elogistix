# Plan Fase 3 — Módulo Costeo

Entrega en orden: **(A) Editor matriz de tarifas → (B) Vista Top 3 → (C) Lookup desde wizard de cotización**. Todo en USD. Versión objetivo: **12.73.0**.

---

## A. Editor matriz de tarifas (`/costeo/tarifas`)

Reemplazar el placeholder actual de `CosteoTarifas.tsx` por un editor real.

**UI**
- Tabla con filtros: ruta (PortSelect origen/destino), agente, tipo contenedor, estado (vigente / vencida / reemplazada), rango de fechas.
- Acciones por fila: editar, duplicar (precarga form con `vigente_desde = hoy`), marcar reemplazada, ver historial.
- Botón "Nueva tarifa" → dialog con form.

**Form de tarifa** (campos)
- Ruta (FK `costeo_rutas`), agente (FK `costeo_agentes`), naviera (FK `navieras`, informativa), tipo contenedor (FK `tipos_contenedor`).
- Flete base USD, vigente_desde, vigente_hasta, notas.
- **Sub-sección "Recargos"** → editor de filas dinámicas sobre `costeo_tarifa_recargos`: concepto (BAF / LSS / ISPS / THC Origen / Otro), monto USD, notas. Add/remove rows.
- Total calculado (flete + recargos) visible en footer del form.

**Reglas de vigencia (ambos mecanismos)**
- Estado derivado: `vigente` si hoy ∈ [desde, hasta] y `reemplazada_por IS NULL`; `vencida` si hoy > hasta; `reemplazada` si `reemplazada_por IS NOT NULL`.
- Al guardar nueva tarifa para misma `(ruta, agente, tipo_contenedor)` con `vigente_desde` posterior, la(s) tarifa(s) previa(s) vigentes se marcan `reemplazada_por = nueva.id` automáticamente (trigger o lógica en service).
- Tarifas vencidas/reemplazadas quedan en histórico (no se eliminan); se ocultan por default y se ven con filtro.

**Cambios DB**
- `costeo_tarifas`: agregar `reemplazada_por uuid REFERENCES costeo_tarifas(id) ON DELETE SET NULL` (si no existe). Forzar `moneda = 'USD'` (CHECK).
- `costeo_tarifa_recargos`: confirmar columnas (`concepto`, `monto_usd`, `notas`); CHECK moneda USD.
- Trigger `costeo_tarifas_marcar_reemplazadas` BEFORE INSERT.

**Archivos**
- `src/features/costeo/services/tarifas.ts`, `hooks/useCosteoTarifas.ts`, `hooks/useTarifaRecargos.ts`.
- `routes/CosteoTarifas.tsx` (≤200 líneas, partir si crece).
- `components/TarifaForm.tsx`, `components/TarifaRecargosEditor.tsx`, `components/TarifaEstadoBadge.tsx`.

---

## B. Vista Top 3 (`/costeo/buscar`)

Pantalla de consulta dedicada (independiente del wizard).

**UI**
- Filtros: puerto origen, puerto destino, tipo contenedor, fecha de salida (default hoy).
- Resultados: 3 cards ranqueadas con: agente + proveedor, naviera, flete USD, recargos desglosados, **total flete + recargos**, badge carta garantía (verde / ámbar vencida / rojo sin), costo demoras día 6 USD (de `calcular_costo_demoras`), días libres, días de crédito del agente.
- Criterio de orden: `total_usd ASC`, desempate 1 = `dias_credito DESC`, desempate 2 = `dias_libres_demoras DESC`.
- Banner ámbar si la naviera no tiene condiciones cargadas.

**Cambios DB**
- Extender vista `costeo_tarifas_vigentes_v` (ya existe) con `SUM(recargos)`, `total_usd`, `dias_credito` del agente. `security_invoker = on`.
- Nueva función `get_top_tarifas(p_origen_id, p_destino_id, p_tipo_contenedor_id, p_fecha date)` SECURITY DEFINER que devuelve top 3 ordenado.

**Archivos**
- `routes/CosteoBuscar.tsx`, `components/TopTarifasResults.tsx`, `components/TarifaResultCard.tsx`.
- `services/topTarifas.ts`, `hooks/useTopTarifas.ts`.
- Sidebar: nuevo item "Buscar tarifa" bajo Costeo.

---

## C. Integración con wizard de cotización

Acción de **solo consulta** (no escribe sin confirmación) en el step de costos del wizard.

**UI**
- Botón "Buscar tarifa Costeo" en `CotizacionWizard` step de costos (cuando incoterm/modo = marítimo FCL y hay puerto origen/destino + tipo contenedor).
- Abre dialog con misma UI del Top 3 precargado con datos del wizard.
- Al elegir una opción → inserta filas en `cotizacion_costos` (1 por concepto: flete base + cada recargo), referenciando `costeo_tarifa_id` y `costeo_tarifa_recargo_id`. Mantiene posibilidad de edición manual posterior.

**Cambios DB**
- `cotizacion_costos`: agregar columnas opcionales `costeo_tarifa_id`, `costeo_tarifa_recargo_id` (trazabilidad). No rompe RLS existentes.

**Archivos**
- `src/features/cotizaciones/components/BuscarTarifaCosteoDialog.tsx`.
- Edit puntual en `CotizacionWizard` step de costos para botón + handler.

---

## Detalles técnicos

- **RLS**: todas las nuevas tablas/cambios usan `organization_id` + `organization_members` (patrón ya en uso).
- **GRANT** completos en cada `CREATE TABLE` / función nueva.
- **Multi-tenant**: filtrar por `organization_id` actual en todos los hooks.
- **Power of 10**: componentes ≤200 líneas, sin `any`, manejar `{ data, error }` siempre, cleanup en effects, paginación en listas largas (filtros sirven como ventana).
- **i18n**: es-MX, montos en USD con `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' })`.
- **Memorias a actualizar**: `mem://features/costeo-tarifas-maritimas` (editor real + recargos) y añadir `mem://features/costeo-top3-lookup`.

## Migraciones (orden)
1. `costeo_tarifas`: add `reemplazada_por`, CHECK moneda USD, trigger auto-reemplazo.
2. Vista `costeo_tarifas_vigentes_v` extendida + función `get_top_tarifas`.
3. `cotizacion_costos`: add `costeo_tarifa_id`, `costeo_tarifa_recargo_id`.

## Fuera de alcance
- Import Excel masivo (Fase 4).
- Auto-cálculo de garantías/demoras en facturación al cliente (Fase 4).
- Tarifas aéreas / LCL / terrestre (futuro).

## Changelog
`## [12.73.0] - 2026-06-10` con bullets: editor matriz tarifas + recargos dinámicos, vista Top 3 con desempate por crédito, lookup desde wizard de cotización.
