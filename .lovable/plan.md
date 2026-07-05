# Plan — Auditoría de completitud ERP de Libre Carga

## Objetivo

Responder de forma fundamentada: **¿Es Libre Carga un ERP terminado? ¿Cómo se compara con Odoo/SAP y con CargoWise/Magaya/Descartes?**

Entregables:

1. **Resumen ejecutivo en chat** (~1 pantalla): madurez global, veredicto y 5 gaps críticos.
2. **Documento markdown persistente**: `.lovable/audit-erp-completeness.md` con matrices detalladas, evidencia por módulo (rutas/tablas/hooks) y roadmap sugerido.

## Método

1. **Inventario interno** (ya en curso vía subagente `explore`): recorrer `src/features/*`, `src/routes/*`, `sidebarItems.ts`, `supabase/migrations/*` y clasificar cada módulo como:
  - `NONE` — no existe
  - `PARTIAL` — MVP o parcial
  - `SOLID` — funcional y en uso productivo
  - `COMPLETE` — cubre casos avanzados y edge cases
2. **Benchmark generalista**: comparar contra el catálogo estándar Odoo/SAP (Finance, Sales, Purchase, Inventory, MRP, HR, Payroll, Projects, eCommerce, PoS, BI, Website).
3. **Benchmark vertical**: comparar contra features nucleares de CargoWise/Magaya/Descartes (rate management, quoting, shipment ops, docs BL/HBL/MBL, tracking milestones, customs, EDI, accounting integrado, agent network, container tracking, demurrage).
4. **Veredicto** por eje: `ERP vertical de forwarder` vs `ERP generalista`.

## Estructura del documento `.lovable/audit-erp-completeness.md`

```text
1. TL;DR (3-5 líneas + veredicto)
2. Matriz Generalista (Libre Carga vs Odoo vs SAP)
   ├─ Finance & Accounting
   ├─ Sales / CRM
   ├─ Purchasing
   ├─ Inventory / WMS
   ├─ Manufacturing / MRP
   ├─ HR / Payroll
   ├─ Projects / Timesheets
   ├─ eCommerce / PoS / Website
   ├─ BI / Reporting
   └─ Admin / multi-tenant / i18n
3. Matriz Vertical Forwarder (Libre Carga vs CargoWise vs Magaya vs Descartes)
   ├─ Cotización & tarifario
   ├─ Shipment ops (FCL/LCL/aéreo/terrestre)
   ├─ Tracking & milestones
   ├─ Documentación (BL/HBL/MBL, docs onboarding)
   ├─ Contenedores, demoras, garantías
   ├─ Customs / aduana
   ├─ CxC / CxP / Tesorería
   ├─ CFDI 4.0 / facturación fiscal MX
   ├─ Portal cliente / agente
   ├─ Auditoría operativa
   ├─ EDI / integraciones carrier
   └─ Comisiones vendedores
4. Fortalezas diferenciales
5. Gaps críticos por prioridad (P0/P1/P2)
6. Veredicto final y posicionamiento de mercado
7. Roadmap sugerido a 3/6/12 meses
```

## Hipótesis de trabajo (a validar con el inventario)

Basado en `mem://index.md`, `README.md` y auditorías previas:

- **Fuerte y diferenciado**: Embarques (7 estados, tracking automático, contenedores), Cotizaciones (tarifa-first, versionado, PDF), CFDI 4.0 / Proformas, Auditoría operativa con IA, Portal cliente, Multi-tenant + roles, Costeo tarifas marítimas con ranking Top 3, Garantías/demoras automáticas.
- **Sólido pero acotado**: CxC/CxP, Tesorería, Reportes, Dashboard ejecutivo, CRM leads/oportunidades, Comisiones.
- **Parcial**: Inventario/almacén (no aplica al giro), Contabilidad general (facturación sí, GL no confirmado), Aduana/customs.
- **Ausente esperado**: MRP, HR/Nómina, PoS, eCommerce, Website builder, Timesheets, Bank reconciliation formal, EDI carriers.

## Veredicto anticipado (a confirmar)

- **Vs Odoo/SAP (generalista)**: Libre Carga **no es** un ERP generalista terminado — le faltan >60% de módulos (MRP, HR, Inventory, PoS, eCommerce). No compite en ese terreno ni pretende hacerlo.
- **Vs CargoWise/Magaya/Descartes (vertical)**: Libre Carga es un **TMS/forwarder ERP en fase Beta madura** — cubre el flujo core (cotizar → embarcar → facturar → cobrar) mejor localizado a México (CFDI, IVA dinámico, es-MX) que los competidores globales, pero con gaps en EDI, aduana profunda y red de agentes internacional.
- **Posicionamiento**: nicho México — ERP vertical de forwarder de pequeño/mediano, no un reemplazo de SAP.

## Alcance / Fuera de alcance

- **Incluye**: análisis de código existente, memoria del proyecto, comparación conceptual con competidores usando conocimiento público.
- **Excluye**: no ejecuto features en el navegador, no cambio código, no hago benchmarks de performance ni pricing detallado.

## Pasos al implementar

1. Esperar resultado del subagente de inventario ya en curso.
2. Completar tablas con evidencia (`src/features/xxx/`, tablas Supabase, rutas).
3. Escribir `.lovable/audit-erp-completeness.md` (~600-900 líneas).
4. Publicar resumen ejecutivo en chat con veredicto + top 5 gaps.

## Detalles técnicos

- El documento vive en `.lovable/` (no productivo, no rompe tests ni bundle).
- No requiere cambio de `APP_VERSION` ni entrada en `CHANGELOG.md` (es documento de análisis, no código).
- No requiere migraciones ni cambios de UI.

Tambine  dame el reporte en archivo doc o PDF. 