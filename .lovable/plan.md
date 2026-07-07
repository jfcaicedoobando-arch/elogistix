# Rediseño de /facturacion al nivel Odoo / SAP

## 1. Diagnóstico de lo que hay hoy

Analogía: hoy /facturacion es como una **oficina con un escritorio grande, dos bandejas de "salida" y varios cajones escondidos en otros pisos**. El contador ve el escritorio (KPIs), pero para trabajar tiene que ir a otro piso (`/cartera`, `/compras/por-pagar`, `/proformas`, `/reportes/cierre-mensual`).

Estructura actual:

```text
/facturacion
├── Banda 1: DashboardEjecutivoFacturacion (5 KPIs + tendencia)
├── Banda 2: FacturacionKpisFiscales (3 KPIs fiscales — se solapa)
├── HuecoFacturacionChip (inline, junto a tabs)
├── Tab "Emitidas"        ← única bandeja real
├── Tab "Notas de crédito" ← historial
└── Botón "Nueva factura manual"
```

Redirecciones legacy que **delatan que el módulo se desmembró**:

- `?tab=cobranza` → `/cartera`
- `?tab=liquidacion` → `/compras/por-pagar`
- `?tab=proyeccion` → `/reportes/cierre-mensual`
- `?tab=pendientes` → `/proformas?estado=aceptada`

Problemas concretos:

1. **Dos bandas de KPIs** que compiten (una con montos, otra con conteos). El "29 por timbrar" del `DashboardEjecutivo` cuenta proformas, no CFDIs — confunde al usuario.
2. **Sólo hay una bandeja de trabajo** ("Emitidas"). Todo lo demás son links a otras rutas → el usuario pierde el contexto fiscal.
3. **No hay bandejas por "estado de acción"** (Por timbrar, Por enviar al cliente, Por pagar, Vencidas, PPD sin REP). En un ERP eso es la columna vertebral.
4. **El ciclo Proforma → Factura → CFDI → Pago → REP → Cobranza está partido en 4 URLs**. En Odoo/SAP todo el ciclo AR vive bajo un mismo módulo.
5. **No hay período fiscal activo visible** (mes/ejercicio, cierre contable, layout SAT DIOT). SAP siempre muestra la "posting period" en la esquina.
6. **No hay lista de tareas priorizadas** (aging, vencimientos hoy, próximos 7 días). Es información que existe pero está dispersa.

## 2. Cómo lo resuelven Odoo y SAP

**Odoo — módulo Accounting > Customer Invoices:**

- Un solo hub con **filtros salvables** ("Draft", "To validate", "Posted", "Overdue", "To collect").
- **Kanban lateral por estado** y lista central por default.
- KPI row muy sobria (2-3 números máximo).
- Botón "New" siempre a la derecha; acción principal por fila = "Register Payment" o "Send & Print".
- Aging report como sub-vista integrada, no como otra página.

**SAP FI/AR — transacción FBL5N + F.30:**

- Cockpit por **workflow status**: partidas abiertas, partidas vencidas, próximas a vencer, en compensación.
- Buscador tipo command palette; los usuarios no navegan, **teclean el estatus que quieren**.
- Cada línea abre un "document flow" (Proforma → Factura → Pago → REP) — traza completa del documento.
- Cierre de período **bloquea** creación de CFDI con fecha vieja.

Común a ambos: **un módulo = un ciclo completo**, con bandejas por acción pendiente, no por objeto de base de datos.

## 3. Propuesta de acomodo

Analogía: convertir /facturacion de **"vitrina de facturas emitidas"** a **"cabina de facturación fiscal"** — una sola pantalla donde el equipo administrativo entra en la mañana y sabe qué hacer hoy.

### 3.1 Layout propuesto

```text
┌────────────────────────────────────────────────────────────────────┐
│  Facturación · Julio 2026 · Ejercicio abierto     [+ Nueva] [⚙]    │  ← Header con periodo fiscal
├────────────────────────────────────────────────────────────────────┤
│  Facturado mes  Cobrado mes  Por cobrar  Vencido   Meta mes        │  ← 1 sola banda KPI (5 tiles)
│  $2.3M          $1.8M        $4.1M       $780K     42% ▓▓░░░       │
├────────────────────────────────────────────────────────────────────┤
│  [ 📥 Por timbrar 12 ] [ 📤 Por enviar 8 ] [ 💳 Por cobrar 34 ]    │  ← Bandejas de trabajo
│  [ ⚠ Vencidas 6 ] [ 🧾 REP pendientes 4 ] [ ✅ Emitidas ] [ ↩ NC ] │
├────────────────────────────────────────────────────────────────────┤
│  Lista contextual a la bandeja activa                              │
│  · Búsqueda + filtros persistentes (cliente, fecha, monto, moneda) │
│  · Columnas: Folio · Cliente · Emisión · Vence · Total · Saldo · ⚡│
│  · Acción rápida por fila (Timbrar / Enviar / Registrar pago)      │
├────────────────────────────────────────────────────────────────────┤
│  Panel lateral (colapsable): Aging 0-15 / 16-30 / 31-60 / 61-90 /+ │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 Cambios estructurales

**A. Colapsar los dos KPI bands en uno.**
Un solo `<FacturacionCockpitKpis>` con 5 tiles: Facturado mes, Cobrado mes, Por cobrar, Vencido, Avance vs meta. Los 3 conteos fiscales (Proformas convertibles, Facturas sin timbrar, REP pendientes) se convierten en **badges numéricos sobre las bandejas correspondientes**, no en tiles duplicadas.

**B. Sustituir los 2 tabs por 7 bandejas de trabajo** (workflow queues):


| Bandeja          | Qué contiene                                                               | De dónde sale el dato                               |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| Por timbrar      | Facturas `estado='Borrador'` + `facturapi_id IS NULL` + fecha ≥ 01/07/2026 | `facturas`                                          |
| Por enviar       | Facturas timbradas sin `factura_envios` exitoso                            | `facturas` ⋈ `factura_envios`                       |
| Por cobrar       | CFDI vigentes con saldo > 0, no vencidos                                   | `facturas` (estado=Emitida, saldo>0)                |
| Vencidas         | CFDI con `fecha_vencimiento < hoy` y saldo > 0                             | `facturas`                                          |
| REP pendientes   | Pagos aplicados a facturas PPD sin complemento timbrado                    | `pagos_factura.estado_rep IN ('Pendiente','Error')` |
| Emitidas         | Historial completo (la tab actual)                                         | `facturas`                                          |
| Notas de crédito | Historial NC                                                               | `factura_notas_credito`                             |


Cada bandeja tiene su badge de conteo en el trigger — el usuario ve de golpe dónde hay trabajo.

**C. Hueco de facturación** → deja de ser un chip suelto y se convierte en una **bandeja "Por facturar (embarques)"** al inicio, con las proformas convertibles. Esto une la etapa pre-CFDI al mismo cockpit.

**D. Selector de periodo fiscal en el header.**
Botón `Julio 2026 ▾` que filtra todo el cockpit (KPIs + bandejas + lista). Preset "Este mes / Mes pasado / Este trimestre / Ejercicio". Alinea con el "posting period" de SAP.

**E. Panel lateral de aging colapsable.**
En vez de mandar al usuario a `/cartera`, muestra las 5 cubetas (0-15, 16-30, 31-60, 61-90, 90+) en una barra vertical clickeable que filtra la bandeja "Vencidas".

**F. Acción rápida por fila.**
Cada bandeja expone **una acción principal** (no un menú kebab de 8 opciones): en "Por timbrar" → botón "Timbrar"; en "Por enviar" → "Enviar CFDI"; en "Por cobrar" → "Registrar pago"; en "REP pendientes" → "Timbrar REP". El resto de acciones queda en el detalle `/facturacion/:id`.

**G. Barra de acciones masivas (ya existe `FacturasMasivasToolbar`).**
Se activa al seleccionar filas: timbrar en lote, enviar en lote, exportar CSV, exportar layout contable.

### 3.3 Lo que NO cambia (para no romper cosas)

- Rutas `/cartera`, `/compras/por-pagar`, `/reportes/cierre-mensual`, `/proformas` siguen existiendo — sólo dejamos de depender de ellas para el trabajo cotidiano de facturación. Los redirects legacy se mantienen.
- `/facturacion/:id` (detalle) queda igual.
- El sidebar sigue apuntando a `/facturacion`.
- El schema de BD no se toca — todo se resuelve con hooks/vistas.

## 4. Qué falta para llegar al estándar Odoo/SAP

Cosas que **hoy no existen** en el proyecto y que sí son estándar en un ERP maduro:

1. **Document flow visual** — línea de tiempo Proforma → Factura → CFDI → Pago → REP en el detalle. Hoy hay pedazos; falta el diagrama.
2. **Periodos fiscales bloqueables** — que un admin pueda "cerrar julio" y bloquear alta de CFDI con fecha ≤ julio. Requiere tabla `periodos_fiscales`.
3. **Aging report como sub-vista** — la información existe (`useCobranza`), sólo hay que embeberla como panel.
4. **Vistas salvables por usuario** — "Mis filtros" (ej. "Mis clientes vencidos > 60 días"). Requiere tabla `vistas_usuario`.
5. **Command palette fiscal** — `Ctrl+K` que entienda "vencidas", "por timbrar", "cliente X". El proyecto ya tiene búsqueda global; se puede extender.
6. **Multi-moneda visible en KPIs** — hoy todo se convierte a MXN. Odoo/SAP siempre muestran ambas monedas.
7. **Reporte DIOT + declaración mensual** en el mismo cockpit (hoy vive en `/reportes/cierre-mensual`).
8. **Auditoría por documento** — quién timbró, quién canceló, quién envió, con timestamps. Existe `bitacora_actividad`; falta exponerlo en el detalle.

## 5. Fases sugeridas (orden y riesgo)

**Fase 1 — Consolidación visual (bajo riesgo, alto impacto).**

- Unificar los 2 KPI bands en uno.
- Renombrar "Por timbrar" del KPI actual → "Proformas por facturar" (o mover a la bandeja).
- Añadir selector de periodo fiscal en el header (sólo filtra en memoria, no bloquea).

**Fase 2 — Bandejas de trabajo (medio riesgo).**

- Rediseñar los tabs como 7 bandejas con badges de conteo.
- Cada bandeja reusa hooks existentes (`useCobranza`, `useFacturas`, `useProformasPendientes`, `useFacturacionKpisFiscales`).
- Añadir acción rápida por fila.
- Migrar `HuecoFacturacionChip` a bandeja "Por facturar".

**Fase 3 — Panel de aging integrado (bajo riesgo).**

- Componente `<AgingSidebar>` que reusa `useCobranza` y filtra la bandeja "Vencidas" al clickear una cubeta.

**Fase 4 — Document flow en detalle (medio riesgo).**

- Componente `<DocumentFlowTimeline>` en `/facturacion/:id` mostrando el ciclo completo.

**Fase 5 — Cierre de periodo fiscal (alto riesgo — toca BD).**

- Tabla `periodos_fiscales` + RPC para cerrar.
- Bloqueo en creación de CFDI si el periodo destino está cerrado.

**Fase 6 — Vistas salvables y command palette fiscal (medio riesgo).**

- Persistir filtros por usuario.
- Extender `Ctrl+K` con verbos fiscales.

## 6. Detalles técnicos (para el equipo)

- **Reuso de hooks** — no hay que crear queries nuevas para las Fases 1-4. Se usan: `useFacturacionPageController`, `useCobranza`, `useProformasPendientes`, `useFacturacionKpisFiscales`, `useDashboardEjecutivoFacturacion`, `useHuecoFacturacion`.
- **Estado del tab activo** → mover a URL (`?bandeja=por-timbrar`) para links profundos y refresh sin perder contexto.
- **Cada bandeja** = componente `<Bandeja{Nombre}>` que recibe filtros ya calculados y renderiza un `DataTable` + una acción principal — ≤ 200 líneas por archivo (Power of 10).
- **Contador de badges** debe usar `count: 'exact', head: true` (patrón ya usado en `kpisFiscales.ts`) para no traer payload.
- **Migración suave**: Fase 1 y 2 se pueden hacer detrás de un flag `NUEVO_COCKPIT_FACTURACION` para poder volver atrás si algo se rompe.
- **Riesgo principal**: la lógica de "puedeTimbrarDesdeSistema" (fecha ≥ 01/07/2026) debe respetarse en la bandeja "Por timbrar" — reusar `esCreadaConCapacidadTimbrado` de `facturaFlags.ts`.

## 7. Preguntas abiertas (que conviene resolver antes de codear)

1. ¿Cerrar el período fiscal es una necesidad real hoy, o basta con filtrar visualmente? (define si Fase 5 va o no).  No es necesario. 
2. ¿Los usuarios de facturación quieren ver **también** cuentas por pagar (proveedores) en el mismo cockpit, o sólo AR (clientes)? Odoo los separa; SAP los une bajo "Financials". Vamos con la opcion Odoo. Solo clientes. 
3. ¿La "meta de facturación" que ya definimos para dirección ($5.5M MXN) se muestra también acá o es sólo dirección? No se muestra. 
4. ¿Priorizamos Fase 1+2 (rediseño visual) o Fase 4 (document flow) primero? hacemos las fases en orden. 