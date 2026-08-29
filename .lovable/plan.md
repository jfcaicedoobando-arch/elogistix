# Auditoría v14-2: estado de los 40 hallazgos

Verificado contra el código y el CHANGELOG (v13.798.0–13.801.0).

## Ya corregidos (26 de 40)

**Críticos (2/2)**
- C-1 Doble IVA cotización → embarque (la RPC ya deriva la base de cantidad × precio_unitario).
- C-2 Cron de snapshots (acepta service_role) + A-10 (score ya no sale ficticio en 100).

**Altos (8/11)**
- A-2 KPIs de cobranza/dirección con `org_scope()` (impersonación correcta).
- A-3 EERR mensual excluye papelera.
- A-4 EERR devengado filtra org + papelera al resolver por expediente.
- A-8 Presupuesto vs Real ignora liquidaciones canceladas.
- A-9 Listados globales de Compras con `organization_id` explícito.
- A-11 Límite de crédito reconoce IVA frontera 8%.
- A-5 ya estaba corregido (el guard de pago CxP ya usaba FOR UPDATE; la auditoría lo marcó por versión vieja).

**Medios (9/17)**
- M-1 Reapertura de embarque limpia snapshots del cierre.
- M-2 Cobro EUR con pivote en MXN.
- M-3 Reportes de Compras con EUR y sin canceladas.
- M-4 Filtros de pagos/NC server-side antes del LIMIT.
- M-5 Tendencia 12m y búsqueda global respetan impersonación.
- M-6 Snapshot: pendientes reales, por_regla y misma fórmula de score.
- M-9 KPIs del portal cliente ya no salen en $0.
- M-16 Detalle 360 de cliente sin embarques en papelera.
- M-17 Sugerencias a proveedor sin embarques eliminados.

**Bajos (11/21)**
- B-1, B-5, B-6, B-7, B-9, B-11, B-12, B-13, B-14, B-15, B-16, B-18 (redondeo IVA, CSV con fecha local, candado de sobregiro en traspasos, factura $0 no timbrable, pesos/piezas validados, filtros de papelera, EUR en conciliación).

**Descartados como decisión de producto:** B-2 (1 cotización = 1 embarque) y B-21 (tracking manual).

## Falta por corregir (12 + 2 decisiones)

**Altos (3)**
1. **A-1** `consolidar_proformas`: trunca cantidades decimales a entero y aplica IVA a nivel grupo (grava al 16% conceptos de 8%).
2. **A-6** Diálogo "Registrar pago" en CxP puede pisar la captura del usuario si otro proceso actualiza el saldo (falta el guard de inicialización que ya tiene CxC).
3. **A-7** Importación de ~10k movimientos bancarios falla: query gigante sin trocear y riesgo de duplicados por límite de 1000 filas.

**Medios (8)**
- M-7 Revisiones de auditoría >90 días reaparecen como pendientes.
- M-8 Reglas de auditoría aceptan TC≤1 mientras el P&L exige TC>1.
- M-10 Sin regla que cuadre totales del embarque vs contenedores.
- M-11 Creación embarque + contenedores no atómica.
- M-12 Autosave de cotización: dos pestañas se pisan en silencio.
- M-13 Wizard de embarque sin borrador/autosave.
- M-14 Tipo de cambio sin banda de plausibilidad (acepta 0.0001 o 9999).
- M-15 Límite de crédito: fail-open, saltable y ausente en timbrado masivo.

**Bajos (pendientes):** B-3 (three-way match de 2 vías), B-4 (PUE con abonos), B-8 (guard de concurrencia con updated_at nulo), B-10 (recalculo de embarque origen), B-17 (índices únicos no parciales), B-19 (anti-solape de demoras sólo en UI), B-20 (RFC sólo por longitud).

## Propuesta de trabajo (Olas 5 y 6)

**Ola 5 — Altos restantes**
- A-1: quitar `::int`, IVA por línea con `resolverTasaConcepto`, encabezado = suma del detalle.
- A-6: patrón `initializedForRef` por factura en el diálogo CxP.
- A-7: chunking de 500 en select/insert + `assertNotTruncated`, o RPC server-side.

**Ola 6 — Medios y bajos de bajo riesgo**
- M-7, M-8, M-14 (validaciones y filtros puntuales).
- M-10 (nueva regla de auditoría), M-11 (inserción atómica en RPC).
- B-8, B-10, B-17, B-19, B-20.
- M-12, M-13 (autosave/borrador) y M-15, B-3, B-4 requieren decisión de producto antes de codificar.

**Cierre:** `bun run db:postcheck` en verde, baseline regenerada, CHANGELOG + bump de versión por cada ola.

## Detalles técnicos
- A-1: `consolidar_proformas` (última def. `20260827203505_….sql`), alinear con `calcularTotalesProforma`.
- A-6: espejo de `DialogRegistrarPago.tsx:78-103` en `usePagoProveedorForm.estado.ts`.
- A-7: `src/features/tesoreria/services/conciliacion.ts:51-96`.
- M-14: banda sugerida 5–40 MXN/USD vía zod + CHECK.
