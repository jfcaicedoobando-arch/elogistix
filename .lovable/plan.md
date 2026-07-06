
# Roadmap α→δ — Compras + Facturación (Importador puro CN→MX)

Objetivo: en ~11-14 semanas calendario Libre Carga puede ser el ERP único de un forwarder importador (5 usuarios, 200 embarques/mes), sin Excel paralelo y sin ContPAQi salvo para Contabilidad Electrónica Anexo 24 (fase ε, fuera de este roadmap).

Perfil objetivo: recibe navieras CN, agente aduanal MX, transporte doméstico. Factura al importador mexicano en MXN/USD. IVA 16% dominante, 0% ocasional en flete internacional. No emite export, no autotransporta.

---

## Fase α — Fixes críticos + Retenciones + IEPS (Semana 1-3)

Analogía: son las goteras del techo. Sin arreglarlas cualquier feature nueva se moja.

### α.1 Bug fixes bloqueadores (Semana 1)

- `supabase/functions/verificar-uuid-sat/index.ts` — cambiar tabla de `proveedor_facturas` a `facturas` (verificación de CFDIs emitidos)
- `facturapi-emitir-rep/helpers.ts` — leer `tasa_iva` real de cada concepto documento_relacionado en vez de hardcodear 0.16
- `conceptosFacturaCrud.ts:67` y `facturaManual.ts:121` — eliminar fallback silencioso a `"81141601"`; validar y lanzar error
- `facturapi-emitir/index.ts:108-115` — leer `clave_unidad` del concepto en lugar de hardcodear `"E48"`
- `proveedorFacturas.ts:83` — implementar paginación con `.range(from, to)` y cursor; eliminar `.limit(2000)`
- Añadir test de regresión para cada uno

### α.2 IEPS parsing (Semana 1-2)

- `parser.ts` — extraer nodo `cfdi:Traslado[@Impuesto="003"]` y `cfdi:Retencion[@Impuesto="003"]` del XML CFDI del proveedor
- Migración: agregar columnas `ieps_trasladado`, `ieps_retenido` en `proveedor_facturas_conceptos`
- UI CxP: mostrar IEPS en el desglose de factura recibida

### α.3 Retenciones automáticas (Semana 2)

- Tabla `proveedores`: agregar `tipo_persona` (fisica/moral), `regla_retencion_default_jsonb`
- Reglas SAT precargadas por régimen fiscal:
  - Honorarios persona física → ISR 10% + IVA 10.6667%
  - Servicios de agente aduanal → ISR 0% + IVA 0%/16% según régimen
  - Servicios de flete a persona física → ISR 0% + IVA 4%
- Al crear concepto de costo o factura proveedor: prefill `tasa_ret_isr`/`tasa_ret_iva` desde regla del proveedor
- Al timbrar: warning si proveedor persona física sin retención capturada

### α.4 Alerta de vencimiento CSD (Semana 2)

- Cron `facturapi_csd_check` (diario): lee `facturapi_credenciales.certificado_vence_at`
- Notificación in-app + email a admins de la org 30/15/7/1 días antes
- Bloqueo suave al timbrar si CSD vence en <3 días (banner rojo, requiere confirmación)

### α.5 Guardia 4to trimestre en cancelaciones (Semana 3)

- `facturapi-cancelar/helpers.ts` — si `fecha_timbrado` está en oct-dic del año anterior y `now() > 31 enero`: rechazar cancelación con mensaje SAT específico
- Test unitario con fechas frontera

**Entregable α**: sistema fiscalmente correcto para operación diaria. Sin bugs conocidos, retenciones automáticas, alertas CSD, IEPS visible.

---

## Fase β — TC correcto + DIOT + Anticipos (Semana 4-7)

### β.1 TC por operación (Semana 4-5)

- `proveedor_facturas`: agregar `tipo_cambio` y `tipo_cambio_fecha` (default: fecha de emisión CFDI)
- `facturas` y `pagos_factura`: usar TC del día del timbrado / cobro, consultando Banxico al momento
- Cache Banxico: reducir a 4h y forzar refresh en horario 12pm-14pm (publicación DOF)
- `pnlFinanciero` RPC: recalcular convirtiendo cada CFDI con su TC propio
- Vista de diferencia cambiaria realizada vs no realizada por embarque

### β.2 DIOT — Módulo A-29 (Semana 4-6)

- Nueva sección `Fiscal → DIOT` en dashboard
- Servicio `diot/export.ts`: genera archivo TXT layout SAT 2024 (pipe-delimited)
- Agrupa por RFC proveedor + tipo operación (03 nacional / 04 extranjero / 05 global)
- Distingue IVA 16% / 8% frontera / 0% / exento / retenido
- Incluye pagados en el periodo (no facturados — DIOT es base flujo)
- UI: selector de mes + preview tabular + descarga TXT + reporte de proveedores con RFC inválido
- Test con fixtures de operación real (5 nacionales, 2 extranjeros, 1 global)

### β.3 Anticipos a proveedor (Semana 6-7)

Crítico para importador CN→MX: navieras exigen wire transfer pre-embarque.

- Nueva tabla `anticipos_proveedor`: `proveedor_id`, `monto`, `moneda`, `tipo_cambio`, `embarque_id?`, `estado (emitido/aplicado/liquidado)`, `cfdi_anticipo_uuid?`
- Flujo: crear anticipo → pago bancario → recibir CFDI anticipo (tipo "P" o "I") → al recibir factura final, aplicar anticipo con nota de crédito
- Vinculación a embarque desde el momento del anticipo (visible en flujo proyectado como salida real, no proyectada)
- Reporte "Anticipos sin aplicar >60 días"

**Entregable β**: cierre fiscal mensual desde Libre Carga. DIOT exportable, P&L cuadra con SAT, anticipos gestionados.

---

## Fase γ — Volumen operativo (Semana 8-10)

Analogía: convertir 280 clicks/día en 30. La calidad de captura es la nueva línea de defensa.

### γ.1 Timbrado masivo (Semana 8)

- UI en `Facturación`: multi-select con checkbox por fila + botón "Timbrar seleccionadas (N)"
- Servicio `timbrarLote`: cola con concurrencia 3, retry por factura, progreso en tiempo real
- Reporte final: X exitosas, Y con error (motivo por cada una), enlaces a corregir
- Idempotency: si una factura ya está `Timbrada`, skipear silenciosamente

### γ.2 Bulk actions CxP (Semana 8-9)

- Multi-select en tabla `ProveedorFacturas`
- Acciones masivas: Aprobar, Programar pago (fecha común), Marcar pagadas (con selector de cuenta bancaria y referencia)
- Confirmación con resumen: "Aprobar 27 facturas por $3,450,200 MXN"

### γ.3 Catálogo SAT autocomplete (Semana 9)

- Componente `SATClaveAutocomplete` sobre `catalogo_claves_sat` (ya en BD)
- Búsqueda debounced por código o descripción, muestra top 8 con `stringSimilarity`
- Reemplazar campos de texto libre en: `ConceptoManualForm`, `FacturaConceptoRow`, `ConceptoCostoRow`
- Prefill inteligente: si concepto="Flete marítimo" → sugerir `78101800`

### γ.4 Layout de dispersión bancaria (Semana 9-10)

- Servicio `tesoreria/dispersion.ts` con adapters por banco: BBVA, Banorte, Santander, SPEI H2H
- Selector "Programar pagos: N facturas → generar layout [banco]"
- Genera .txt con formato específico + resumen pre-envío
- Al confirmar transferencia bancaria: crear `pagos_proveedor` batch con folio de dispersión

### γ.5 Facturas multi-embarque (Semana 10)

- Migración: nueva tabla `factura_embarques (factura_id, embarque_id)` M:N con `monto_asignado` para prorratear
- Mantener `facturas.embarque_id` como legacy pero deprecar en UI
- Wizard de emisión: paso "Asignar a embarques" permite múltiples con % o monto fijo
- P&L por embarque suma su porción de facturas multi-embarque

**Entregable γ**: 200 embarques/mes manejable con 5 usuarios. Captura reducida ~80%.

---

## Fase δ — Reporting completo (Semana 11-13)

### δ.1 Aging CxC estándar 30/60/90 (Semana 11)

- Extender `cobranza_seguimiento` con RPC `cxc_aging_estandar` (cubetas 0-30 / 31-60 / 61-90 / >90 / no vencido)
- Reporte descargable por cliente con contactos, teléfono, último recordatorio
- Trigger de recordatorios automáticos en las cubetas 31-60 y 61-90 (habilitar `cxc-recordatorios` real)

### δ.2 P&L por ruta y por vendedor (Semana 11-12)

- Ruta = `origen_puerto + destino_puerto` normalizado (usa `puertos` UN/LOCODE)
- Vista `pnl_por_ruta` con margen % agregado, top 10 rutas rentables y top 5 pérdida
- P&L por vendedor: agrupa embarques por `crm_oportunidades.vendedor_id` → cierre → factura
- Módulo de comisiones: calcula sobre utilidad realizada, no sobre venta bruta

### δ.3 Ranking proveedores + alertas de margen (Semana 12)

- Vista `ranking_proveedores`: monto pagado YTD, # facturas, aging promedio, scorecard
- Alerta push (notificación in-app) cuando embarque pasa a margen <5%
- Pantalla dedicada "Embarques en pérdida" filtrable por fecha/ruta/vendedor

### δ.4 Complemento Comercio Exterior — versión ligera (Semana 12-13)

Para importador puro no es obligatorio emitir CCE, pero sí puede necesitarlo para servicios de flete internacional facturados con IVA 0%.

- Campo `emitir_con_cce` en factura + subformulario con pedimento, tipo operación, motivo traslado
- Payload Facturapi extendido con nodo `cce11:ComercioExterior`
- Solo activable cuando `tipo_iva = "tasa_0"` en al menos un concepto

### δ.5 Búsqueda global mejorada (Semana 13)

- Extender `Ctrl+K` para incluir: UUID, RFC proveedor, BL/AWB, folio interno CxP (FP-XXXXXX)
- Índices GIN para tsvector en `facturas.uuid`, `proveedor_facturas.folio_interno`, `embarques.bl_master`

**Entregable δ**: reporting a nivel dirección financiera + emisión CCE opcional para IVA 0% + búsqueda de calidad.

---

## Fuera de alcance de este roadmap (para decidir después)

- **Fase ε — Contabilidad Electrónica Anexo 24** (10-14 sem adicionales): Catálogo de Cuentas XML, Balanza mensual XML, Pólizas XML. Alternativa: exportador CSV/XML compatible con ContPAQi para mantener la contabilidad allá.
- **Constancias de Retención (CFDI de Retenciones)** — se puede añadir en fase γ opcional si hay muchos honorarios a personas físicas
- **Carta Porte 3.1** — no aplica al perfil importador puro
- **Facturas globales (público general)** — no aplica al perfil B2B forwarder
- **Conciliación bancaria OFX/CAMT** — mejora a fase δ+1 si el volumen bancario lo justifica

---

## Consideraciones técnicas

- Cada fase entrega valor operativo independiente. Se puede pausar entre fases sin dejar el sistema roto.
- Cada bump crea entrada en `CHANGELOG.md` + `APP_VERSION` conforme al estándar del proyecto.
- Cada migración de BD respeta la regla GRANT + RLS + policies en el mismo migration.
- Cada Edge Function nueva sigue el patrón `index.ts + helpers.ts` con test de helpers puros.
- Tests obligatorios: unitario para helpers de fase α, integración para DIOT/dispersión (β/γ), e2e Playwright para timbrado masivo (γ).
- Sin cambios a arquitectura multi-tenant existente (todo `organization_id` + RLS ya presente).

## Riesgos y mitigaciones

- **Riesgo**: cambios en layout DIOT SAT año-a-año → **Mitigación**: versionar formato en `diot/formats/2024.ts`, `2025.ts`.
- **Riesgo**: retenciones automáticas mal calibradas → **Mitigación**: fase piloto con 1 organización, revisión CP externo antes de rollout.
- **Riesgo**: multi-embarque rompe reconciliación 3 columnas existente → **Mitigación**: migración con backfill de `factura_embarques` desde `facturas.embarque_id` legacy.
- **Riesgo**: TC por factura invalida P&L histórico → **Mitigación**: backfill con TC del día de fecha_emision al deploy; snapshot previo del P&L en tabla read-only.

## Estimación

- 2 desarrolladores senior full-time: **11-14 semanas calendario**
- 1 desarrollador senior + apoyo contable: **18-22 semanas calendario**
- Total sem-hombre: **~22-26**

Al aprobar este plan comenzaré por α.1 (fixes bloqueadores) y α.2 (IEPS parsing) en paralelo — son independientes.
