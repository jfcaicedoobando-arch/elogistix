# Quick wins — TMS/ERP vertical forwarder

Enfoque: cerrar brechas visibles frente a CargoWise/Magaya **sin tocar contabilidad general**, aprovechando lo que ya existe (embarques, tracking, costeo tarifa-first, portal cliente, CFDI, auditoría IA).

## Criterio de "quick win"
- Se apalanca en tablas/servicios existentes (embarques, conceptos_costo, proveedor_facturas, tracking_externo).
- Entregable en ≤ 1-2 sprints cada uno.
- Mueve la aguja comercial: aparece en demo o en RFP de forwarder.

---

## Ranking propuesto (top 6)

### 1. HBL / MBL como entidad de primera clase  ⭐ mayor impacto/esfuerzo
Hoy `embarques.bl_master` y `bl_house` son strings sueltos.
- Nueva tabla `bl_documentos` (tipo `HBL|MBL`, numeración por serie tenant, shipper/consignee/notify, marks & numbers, freight terms, cláusulas).
- Generador PDF (`src/pdf/documents/BLDocument.tsx`) siguiendo patrón de `ProformaDocument`.
- Serie de folios por org (reutilizar patrón `folio_secuencias` / `factura_series`).
- Vincular 1 MBL ↔ N HBL ↔ N contenedores (ya existe `embarque_contenedores`).
- Impresión, envío por email (reutilizar `factura_envios` / `useEnvioDocumentoForm`).

### 2. Manifiesto de carga consolidada (LCL / co-loading)
Ya hay lógica LCL (`shipment-lcl-logic`), falta el **manifiesto**.
- Vista "consolidado": agrupa N HBL bajo 1 MBL con totales de peso/volumen/piezas.
- PDF manifiesto + export CSV para agente destino.
- Nuevo tab en detalle de embarque MBL "Consolidación".

### 3. Portal de agente/corresponsal (nomination + status)
Ya existe `agente_users` + `SIDEBAR_COSTEO_ITEMS` con Agentes.
- Bandeja de "shipments nominados a mí" (RLS por `agente_users`).
- Update de eventos operativos (ATD, ATA, descarga, entrega) desde el portal → escribe en `eventos_embarque`.
- Upload de POD / documentos destino → reutiliza `documentos_embarque` + storage.
- Cierra el loop internacional sin comprar CargoWise eHub.

### 4. Tracking en vivo con 2 navieras reales (MSC + Maersk)
Ya existe `tracking_externo` + `tracking_intentos` + `tracking_webhook_log`.
- Edge function `sync-tracking-msc` y `sync-tracking-maersk` (API pública/gratuita o scraping estable).
- Cron cada 6h vía `pg_cron` sobre embarques activos.
- Badge "Tracking en vivo" en tarjeta de embarque cuando `tracking_externo.updated_at < 24h`.
- Vale más como diferencial que 10 navieras a medias.

### 5. Purchase Order + match 2-way contra factura de proveedor
Ya hay `proveedor_facturas` + `conceptos_costo` (presupuesto) + `proveedor_facturas_conceptos` (vínculo).
Falta el paso previo:
- Tabla `ordenes_compra` (proveedor, embarque, conceptos esperados, moneda, folio interno).
- Generar OC desde tarifa aplicada o desde conceptos de costo pre-embarque.
- Al capturar factura de proveedor: match automático OC ↔ factura con tolerancia % (ya tienes `siguiente_folio_proveedor`, extender patrón).
- Cierra el hueco de "control de gasto antes de que llegue la factura" que hoy no existe.

### 6. Reporte builder mínimo + export xlsx firmado
Ya usas `xlsxwriter` en tests y hay múltiples PDF documents.
- Página `/reportes/personalizados` con selector de módulo (embarques / facturas / cxp / cartera) + columnas + filtros guardables por usuario.
- Export xlsx con `bitacora_actividad` de quién lo generó.
- Evita depender del equipo para cada consulta ad-hoc.

---

## Fuera de este lote (razones)
- **Aduana / pedimentos** → no es quick win, requiere integración VUCEM y expertise fiscal aduanero. Va a 6 meses.
- **GL / partida doble** → decisión estratégica: enfoque vertical NO lo necesita si el cliente conserva su contador con Contpaqi/Aspel. Mantener margin-accounting y exportar pólizas a Contpaqi (mini-win futuro).
- **API REST pública + webhooks** → sí es quick win técnico, pero sin cliente que lo pida hoy. Priorizar cuando el #1 forwarder lo pida.
- **EDI INTTRA / booking a naviera** → alto valor pero requiere contratos comerciales con carriers, no es solo código.

---

## Detalles técnicos por quick win

### #1 HBL/MBL — Esqueleto
```text
bl_documentos
  id (uuid pk)
  organization_id (uuid, RLS)
  embarque_id (uuid fk)
  tipo ('HBL'|'MBL')
  numero (unique per org+tipo, folio_secuencias)
  serie_id (fk factura_series-like)
  shipper_snapshot jsonb
  consignee_snapshot jsonb
  notify_snapshot jsonb
  marks_numbers text
  freight_terms ('PREPAID'|'COLLECT')
  clausulas text
  emitido_en timestamptz
  emitido_por uuid
```
- GRANT SELECT/INSERT/UPDATE a authenticated + RLS por `organization_id`.
- Trigger que copia shipper/consignee del embarque al emitir (snapshot inmutable).

### #4 Tracking naviera
- Secret `MAERSK_API_KEY` y `MSC_API_KEY` vía `secrets--add_secret`.
- Edge function con `wrapEdgeHandler` (ver `mem://technical/process-email-queue-regeneration`).
- Guardar cada intento en `tracking_intentos`; si cambia `estado`, escribir evento en `eventos_embarque`.
- UI: reutilizar `useSidebarAlerts` + card en detalle embarque.

### #5 Ordenes de compra
```text
ordenes_compra
  id, organization_id, embarque_id (nullable, puede ser gasto operativo)
  proveedor_id, folio_interno (OC-XXXXXX por org)
  moneda, subtotal, iva, total
  estado ('Borrador'|'Emitida'|'Recibida'|'Facturada'|'Cerrada')
  fecha_emision, fecha_esperada
ordenes_compra_conceptos
  oc_id, concepto, cantidad, precio_unitario, subtotal
```
- Función `match_oc_factura(_oc_id, _factura_id)` con tolerancia default 2%.
- UI en `/cxp/por-capturar`: si el proveedor tiene OC abiertas, sugerirlas antes que embarques.

---

## Secuencia sugerida (para 1 dev fullstack ~8 semanas)

```text
Semana 1-2 : HBL/MBL entidad + PDF (#1)
Semana 3   : Portal agente básico + eventos (#3 fase 1)
Semana 4-5 : Tracking MSC + Maersk vivo (#4)
Semana 6   : Manifiesto consolidado LCL (#2)
Semana 7-8 : Órdenes de compra + match (#5)
Backlog    : Reporte builder (#6) según demanda comercial
```

## Salidas esperadas
- Guion de demo forwarder que muestre: emisión HBL → nominación agente destino → tracking en vivo → OC → factura proveedor conciliada → cierre con margen.
- Actualizar `.lovable/audit-erp-completeness.md` sección "Roadmap 3 meses" con esta lista y checkboxes.
- `CHANGELOG.md` + bump `APP_VERSION` por cada quick win entregado.

## Fuera del alcance de este plan
- No implemento código en este turno (estamos en plan mode).
- Cada quick win se abrirá con su propio plan de implementación cuando lo aprueben.
