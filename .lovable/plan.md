
# Mejora del modal "Detalle de factura de proveedor"

## Hallazgos de la auditoría

Revisé `DialogDetallePagosProveedor.tsx` (header + KPIs + `InfoFacturaSection` + pagos + NC + historial) contra el tipo `FacturaCxP` y contra los datos que sí guardamos en la base:

**Datos que YA existen pero NO se muestran hoy:**
1. `fecha_emision` — la fecha de expedición del CFDI. Hoy no aparece en ningún lugar del modal, solo se usa en filtros y en la tabla de aging.
2. `fecha_vencimiento` — la fecha límite de pago. Solo se insinúa cuando la factura está vencida (chip "Vencida · N d"), nunca la fecha real.
3. `dias_credito` — sí se muestra, pero suelto, sin las fechas que lo contextualizan.
4. **Conceptos del CFDI persistidos** en `proveedor_facturas_conceptos` (los que llegan del XML o del PDF con IA). Hoy solo se ven en el *preview* al capturar la factura; después de guardar desaparecen del detalle.
5. `total` — está arriba en el KPI, pero no vuelve a aparecer en la sección de Información junto al subtotal/IVA/retenciones, lo que rompe la lectura del desglose fiscal.

**Datos secundarios que también podrían sumar (opcional):**
- Fecha y hora de creación/última actualización de la factura (ya se ve en `HistorialFacturaSection`, así que lo dejamos ahí).
- Estatus SAT del UUID: ya existe (`UuidFiscalField`), ok.

## Qué construimos

### 1. Bloque "Fechas y crédito" en `InfoFacturaSection.tsx`
Reorganizar el grid de 3 columnas para que las fechas queden juntas y visibles siempre:

```text
┌─ Fechas y crédito ─────────────────────────────────────┐
│ Expedición      Vencimiento       Días de crédito      │
│ 15/03/2026      14/04/2026        30 días              │
└────────────────────────────────────────────────────────┘
```

- Formatear con `formatDate` (DD/MM/YYYY, es-MX) usando `parseLocalMx` para evitar el bug de UTC.
- Si la factura está vencida y con saldo, `Vencimiento` muestra el badge rojo `+N d` a la derecha (reutiliza el estilo actual del chip).
- El campo "Días de crédito" se mueve a este bloque (hoy está mezclado con impuestos).

### 2. Bloque "Desglose fiscal" reordenado
Mismo grid pero con orden lógico de arriba hacia abajo:
`Subtotal → IVA → IEPS (si aplica) → Retenciones → Total`
El `Total` se agrega como campo con emphasis (mono, semibold) para que el desglose cuadre visualmente con lo que muestra el header.

### 3. Nueva sección "Conceptos de la factura"
Componente nuevo `ConceptosFacturaSection.tsx` que:

- Hook nuevo `useConceptosCfdiFactura(facturaId)` → `select * from proveedor_facturas_conceptos where proveedor_factura_id = :id order by created_at`.
- Renderiza la misma tabla visual que `CfdiConceptosPreview` (columnas: #, Descripción, Cantidad, Importe, IVA, IEPS si aplica, con totales al pie), reutilizando su markup para consistencia.
- Estados: skeleton mientras carga, mensaje suave "Esta factura no tiene conceptos capturados del CFDI" cuando la lista viene vacía (típico en facturas creadas antes de v13.303.67 o cuando el proveedor no manda XML y tampoco se usó IA).
- Se coloca entre `InfoFacturaSection` y `HistorialFacturaSection` en `DialogDetallePagosProveedor.tsx > BodySections`.

### 4. Header del modal
Añadir la fecha de expedición junto al folio, para que se lea de un vistazo sin bajar:

```text
Detalle de factura de proveedor  [FP-000042]
Folio prov. A-12345 — Transportes ACME · Expedida 15/03/2026
```

## Detalles técnicos

- **Archivos nuevos:**
  - `src/features/cxp/hooks/useConceptosCfdiFactura.ts` — React Query hook (`queryKey: ["cxp", "conceptos-cfdi", facturaId]`, `enabled: !!facturaId`).
  - `src/features/cxp/components/ConceptosFacturaSection.tsx` — sección UI (~90 líneas, respeta Power of 10).
- **Archivos modificados:**
  - `src/features/cxp/components/InfoFacturaSection.tsx` — nuevo bloque de fechas, campo Total, reorden del grid.
  - `src/features/cxp/components/DialogDetallePagosProveedor.tsx` — insertar `<ConceptosFacturaSection />` y mostrar fecha en el header.
- **Sin cambios de esquema, sin nuevas RLS.** La tabla `proveedor_facturas_conceptos` ya está protegida por tenant.
- **Bump de versión:** `APP_VERSION → 13.307.6` + entrada en `CHANGELOG.md`.
- **Tests:** unit test del hook (`useConceptosCfdiFactura`) y snapshot render de `ConceptosFacturaSection` (loading, vacío, con datos con y sin IEPS).

## Fuera de alcance

- Editar los conceptos del CFDI desde el detalle (son fiscales, se preservan tal cual llegan del SAT).
- Sincronizar con la vinculación a `conceptos_costo` del embarque (eso vive en `VincularEmbarqueSection` y no se toca).
- Agregar formas/métodos de pago del CFDI (no los tenemos en el tipo `FacturaCxP` hoy — sería otro cambio de servicio).

¿Le doy con esto o quieres que también integre en este mismo turno los datos de forma de pago / método de pago / uso CFDI (requiere extender el `select` de `fetchFacturasCxP` y el tipo)?
