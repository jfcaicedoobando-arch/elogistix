# Auditoría de completitud ERP — Libre Carga

> Fecha: 2026-07-05 · Versión app: 13.172.11
> Alcance: inventario de `src/features/*`, `src/routes/*`, `supabase/migrations/*`, `sidebarItems.ts` + comparación con Odoo/SAP (generalistas) y CargoWise / Magaya / Descartes (verticales de forwarder).

---

## 1. TL;DR

**Libre Carga NO es un ERP terminado en el sentido de Odoo o SAP.** Es un **TMS / ERP vertical para agentes de carga (freight forwarders) mexicanos, en fase Beta madura**, con un núcleo operativo (cotizar → embarcar → facturar → cobrar) genuinamente sólido y mejor localizado a México (CFDI 4.0, IVA dinámico, es-MX) que los competidores globales de su nicho.

- **Vs Odoo/SAP**: cubre ~35–40% del catálogo funcional de un ERP generalista. Faltan pilares completos: contabilidad general (GL / partida doble), inventario / WMS, MRP, RRHH / nómina, proyectos / timesheets, e-commerce, PoS. No compite en ese terreno.
- **Vs CargoWise / Magaya / Descartes**: cubre ~60–70% del núcleo vertical. Iguala o supera en localización MX (CFDI, cobranza, IVA, portal cliente en español) y visibilidad de márgenes por contenedor. Se queda atrás en: modelo formal HBL/MBL, aduana profunda, EDI con navieras/aerolíneas, red global de agentes.

**Posicionamiento realista**: ERP vertical de forwarder pequeño/mediano en México — no reemplaza a SAP; sí puede desplazar Excel + carpetas + software importado en agencias de <50 usuarios.

---

## 2. Matriz Generalista — Libre Carga vs Odoo vs SAP

Leyenda: ✅ Completo · 🟢 Sólido · 🟡 Parcial · 🔴 Stub · ⬛ Ausente

| Módulo generalista | Libre Carga | Odoo | SAP S/4HANA | Observaciones |
|---|---|---|---|---|
| **Contabilidad / GL** | 🔴 | ✅ | ✅ | No hay libro mayor, catálogo de cuentas, ni asientos de partida doble. Los estados de resultados se derivan de márgenes de embarque, no de GL. |
| **AR / Facturación** | 🟢 | ✅ | ✅ | 132 archivos en `src/features/facturacion/`, tablas `facturas`, `conceptos_factura`, `pagos_factura`, `factura_notas_credito`. CFDI 4.0 vía FacturAPI. |
| **AP / CxP** | 🟢 | ✅ | ✅ | 77 archivos en `src/features/cxp/`, bandeja "Por capturar", `proveedor_facturas`, `pagos_proveedor`. Sin PO backing. |
| **Tesorería / Bancos** | 🟡 | ✅ | ✅ | Conciliación bancaria BBVA (`bbva_movimientos`, `estado_lcion`), flujo de caja, cuentas. Sin cash pooling ni multi-banco automatizado. |
| **Presupuestos** | 🟡 | ✅ | ✅ | `presupuesto_categorias`, `presupuesto_mensual`, `usePresupuestoVsReal`. Cobertura mensual básica. |
| **Estados financieros (P&L, BS, CF)** | 🟡 | ✅ | ✅ | P&L operativo por embarque/contenedor y proyección. **No hay Balance General ni Estado de Flujo GAAP** porque no hay GL. |
| **Multi-moneda** | 🟡 | ✅ | ✅ | Campos `moneda`, `tipo_cambio`, `diferencia_cambiaria_mxn` en facturas y CxP. Feed Frankfurter 1h. Sin revaluación contable formal. |
| **CRM / Ventas** | 🟡 | ✅ | ✅ | Leads, oportunidades, pipeline, cuotas de vendedor, comisiones. Sin sales-order formal (cotización → embarque). |
| **Compras** | 🔴 | ✅ | ✅ | Directorio de proveedores + captura de facturas. **Sin PO, sin recepción de mercancía, sin match 3-way**. |
| **Inventario / WMS** | ⬛ | ✅ | ✅ | Cero. Gira alrededor de shipments, no de stock propio. |
| **Manufactura / MRP** | ⬛ | ✅ | ✅ | No aplica al giro. |
| **RRHH / Nómina** | ⬛ | ✅ | ✅ | No aplica al giro directo, pero un ERP "completo" en México lo incluye. |
| **Proyectos / Timesheets** | ⬛ | ✅ | ✅ | No hay concepto de proyecto ni captura de horas. |
| **e-Commerce / Website / PoS** | ⬛ | ✅ | 🟡 | Fuera de alcance del producto. |
| **BI / Reportes** | 🟡 | 🟢 | ✅ | Dashboards operativos y ejecutivos + cierre mensual + reportes PDF. Sin report-builder ni conector BI (Metabase/PowerBI). |
| **Portal cliente / Extranet** | 🟢 | 🟡 | 🟡 | Portal cliente y portal agente propios, tracking links, notificaciones. Ventaja diferencial. |
| **Multi-tenant / SaaS** | 🟢 | 🟡 (Odoo.sh) | 🟡 | RLS estricto en todas las tablas, `organizations`, `organization_members`, impersonación, planes. |
| **Roles / Seguridad** | 🟢 | ✅ | ✅ | Catálogo de 10 roles + 3 legacy, matriz de capacidades, `user_roles` separado. |
| **Bitácora / Auditoría** | 🟢 | ✅ | ✅ | `bitacora_actividad`, auditoría operativa con IA (Gemini), hallazgos y snapshots. |
| **i18n / Multi-idioma** | ⬛ | ✅ | ✅ | UI sólo en es-MX. No hay biblioteca i18n. |
| **Integraciones / API pública** | 🟡 | ✅ | ✅ | FacturAPI, BBVA, Frankfurter, Sentry. Sin API REST pública ni webhooks para terceros. |

**Cobertura vs generalista**: **~35–40%** de los módulos que Odoo/SAP marcan como estándar. Verdicto: **NO es un ERP generalista terminado ni pretende serlo.**

---

## 3. Matriz Vertical — Libre Carga vs CargoWise vs Magaya vs Descartes

| Función forwarder | Libre Carga | CargoWise | Magaya | Descartes | Observaciones |
|---|---|---|---|---|---|
| **Tarifario / rate mgmt** | 🟢 | ✅ | 🟢 | ✅ | `costeo_tarifas`, `costeo_rutas`, `costeo_agentes`, ranking Top 3, vigencias, recargos, condiciones naviera. |
| **Motor de cotización** | 🟢 | ✅ | ✅ | ✅ | Wizard tarifa-first, versionado v2, PDF, conversión a embarque 1-click. |
| **Shipment ops FCL** | 🟢 | ✅ | ✅ | ✅ | 246 archivos, 7 estados, wizard multi-paso, `embarque_contenedores`, P&L por contenedor. |
| **Shipment ops LCL** | 🟢 | ✅ | ✅ | ✅ | LCL con días libres almacenaje, proformas consolidadas. |
| **Shipment aéreo** | 🟡 | ✅ | 🟢 | ✅ | Existe como modo en UI, modelo de datos marítimo-first. Sin AWB estructurado. |
| **Shipment terrestre** | 🟡 | ✅ | 🟢 | ✅ | Igual: soportado nominalmente, no modelado a profundidad. |
| **Tracking & milestones** | 🟢 | ✅ | ✅ | ✅ | `eventos_embarque`, timeline automatizado por reglas, `tracking_links` públicos, alertas de demora. |
| **HBL / MBL formal** | 🔴 | ✅ | ✅ | ✅ | **No hay entidad BL** ni numeración/impresión formal. Sólo campo referencia_bl. |
| **Documentos / DMS** | 🟢 | ✅ | ✅ | ✅ | `documentos_embarque` en Supabase Storage, checklist onboarding, docs faltantes por reglas. |
| **Contenedores / demoras / garantías** | 🟢 | ✅ | 🟢 | ✅ | Cálculo automático desde timeline, tabulador escalonado, carta garantía, split costo naviera vs venta cliente. |
| **Aduana / customs** | 🔴 | ✅ | ✅ | ✅ | Sólo milestone "En Aduana". Sin módulo de pedimentos, agente aduanal, HS codes, cálculo de impuestos. |
| **Consolidación** | 🟡 | ✅ | ✅ | ✅ | A nivel proforma (`proforma_conceptos_consolidados`). Sin CFS/depósito. |
| **CxC / cobranza** | 🟢 | 🟢 | 🟢 | 🟢 | Aging, seguimiento (`cobranza_seguimiento`), notas de crédito. |
| **CxP / cuentas por pagar** | 🟢 | 🟢 | 🟢 | 🟢 | Bandeja "Por capturar", folio interno FP-XXXXXX. |
| **Tesorería / conciliación** | 🟢 | 🟢 | 🟡 | 🟡 | BBVA integrado, sugerencia de candidatos, `pagos_factura`/`pagos_proveedor`. |
| **CFDI 4.0 México** | 🟢 | 🟡 | 🔴 | 🔴 | **Ventaja competitiva**: FacturAPI nativo, catálogos SAT, cancelación, complementos. CargoWise integra parcialmente, Magaya/Descartes no localizan MX. |
| **Portal cliente** | 🟢 | 🟢 | 🟢 | 🟢 | White-label, embarques + facturas + cotizaciones + tracking. |
| **Portal agente** | 🟢 | 🟢 | 🟡 | 🟢 | `agente_users`, invitaciones. |
| **Auditoría operativa** | 🟢 | 🟡 | 🟡 | 🟢 | Módulo dedicado con reglas (docs faltantes, márgenes, fechas), asignación, IA para explicar hallazgos. Ventaja diferencial. |
| **Márgenes / P&L por embarque** | 🟢 | ✅ | 🟢 | 🟢 | P&L a nivel embarque **y** contenedor, proyección, rentabilidad ejecutiva. |
| **EDI carriers / INTTRA / IATA CASS** | ⬛ | ✅ | 🟢 | ✅ | No hay EDI con navieras, aerolíneas ni MSC/Maersk API. |
| **Red global de agentes / partners** | 🟡 | ✅ (eHub) | 🟢 | ✅ | `costeo_agentes` como catálogo. Sin marketplace ni intercambio de shipments entre agencias. |
| **CRM ventas / pipeline** | 🟢 | 🟢 | 🟡 | 🟡 | Libre Carga tiene CRM nativo, muchos competidores lo delegan a Salesforce. |
| **Comisiones vendedores** | 🟢 | 🟡 | 🟡 | 🟡 | Módulo dedicado, cuotas, config. |
| **Seguros** | 🟢 | 🟢 | 🟢 | 🟢 | `seguros_embarque`, tab dedicado. |
| **Localización MX (IVA, moneda base MXN)** | ✅ | 🟡 | 🔴 | 🔴 | IVA dinámico, MXN base + USD, DD/MM/YYYY. Fuerte ventaja frente a extranjeros. |
| **API pública / webhooks** | 🔴 | ✅ | ✅ | ✅ | No hay endpoints públicos ni marketplace de integraciones. |

**Cobertura vs vertical**: **~60–70%** de las funciones core que un forwarder espera. Verdicto: **Beta madura funcional**, competitiva en México, con brechas claras en aduana / EDI / BL formal.

---

## 4. Fortalezas diferenciales de Libre Carga

1. **Localización MX de origen**: CFDI 4.0, IVA dinámico, cobranza y régimen fiscal SAT nativos — CargoWise/Magaya/Descartes necesitan add-ons costosos.
2. **Costeo tarifa-first con ranking Top 3**: ventas capturan sólo ruta+contenedor, sistema sugiere las 3 mejores tarifas con demoras y frecuencia. Rara vez vista en competidores.
3. **Auditoría operativa con IA (Gemini)**: hallazgos automáticos por reglas + explicación en lenguaje natural. Diferenciador real.
4. **Multi-tenant SaaS con RLS estricto + impersonación de super-admin**: arquitectura moderna, cero setup para cliente nuevo.
5. **Portal cliente y agente en español, incluidos**: sin costo extra.
6. **P&L por contenedor**: visibilidad de márgenes que la mayoría de forwarders sólo logra a nivel embarque.
7. **Modelo de datos versionado**: cotizaciones re-cotizables, reconciliación con embarques, cambios auditados.

---

## 5. Gaps críticos priorizados

### P0 — Bloqueadores para vender como "ERP completo"
1. **Contabilidad general (GL + partida doble + Balance General)**. Hoy la finanza es margin-accounting. Un contador externo aún necesita otro sistema.
2. **Entidad HBL / MBL formal** con numeración, impresión, endoso. Estándar irrenunciable en la industria.
3. **Módulo de aduana / pedimentos** (agente aduanal, HS codes, fracción arancelaria, cálculo IGI/DTA).

### P1 — Bloqueadores competitivos
4. **Purchase Orders + Goods Receipt + match 3-way** para AP con control real.
5. **EDI / API con navieras** (INTTRA, MSC, Maersk, CMA-CGM) para tracking automático real.
6. **API REST pública y webhooks** para integrar con contadores, WMS de terceros, sistemas de clientes.

### P2 — Nice-to-have para crecer
7. **i18n**: al menos EN para clientes extranjeros y agentes internacionales.
8. **Report builder / BI**: conectar Metabase o PowerBI, exports programados.
9. **Modelo aéreo y terrestre más profundos** (AWB, MAWB/HAWB, GPS terrestre).
10. **Marketplace de agentes** al estilo CargoWise eHub.

### P3 — Fuera de identidad del producto
- HR / Nómina, MRP, Inventario/WMS propio, e-Commerce, PoS — probablemente no vale la pena construir; integrar con Odoo o Contpaq si el cliente lo necesita.

---

## 6. Veredicto final

| Pregunta | Respuesta |
|---|---|
| ¿Es un ERP terminado? | **No en el sentido tradicional** (Odoo/SAP). |
| ¿Es un TMS / ERP vertical terminado? | **Casi.** Beta madura funcional, con 3 gaps P0 identificables. |
| ¿Reemplaza SAP? | No. Y no debe intentarlo. |
| ¿Reemplaza CargoWise/Magaya en México? | **Sí, para forwarders pequeños/medianos** que hoy sufren con esos sistemas por precio, complejidad o falta de CFDI. |
| ¿Reemplaza Excel + carpetas + software fragmentado? | **Sí, sobradamente.** Es su caso de uso perfecto. |
| Madurez global estimada | **~68%** hacia un producto GA competitivo vertical. **~35%** hacia un ERP generalista. |

**Posicionamiento recomendado**: dejar de compararse con ERPs generalistas y comunicarse como **"El TMS/ERP para forwarders mexicanos"** — así el producto ya se vende como maduro, no como incompleto.

---

## 7. Roadmap sugerido

### 3 meses
- Definir modelo HBL/MBL con numeración y PDF.
- API REST pública read-only + webhooks básicos (embarque creado, factura emitida, pago recibido).
- Report builder mínimo (queries guardadas + export CSV/PDF programado).

### 6 meses
- Módulo de aduana MVP (pedimentos, agente aduanal, HS codes básicos).
- PO + recepción para cerrar ciclo de compras.
- Tracking API con al menos 2 navieras top (MSC, Maersk).
- i18n EN.

### 12 meses
- GL / partida doble opcional (feature flag por org) o integración certificada con Contpaq/Aspel.
- Modelo aéreo con AWB nativo.
- Marketplace de agentes / red de partners.
- Certificación WCA o similar.

---

*Fin del documento.*
