# Plan: Rediseño del Módulo de Compras

## Problema (auditoría)

Hoy Compras vive en 3 prefijos distintos (`/compras/*`, `/cxp/*`, `/proveedores`) y todas sus páginas renderizan un `ComprasTabStrip` que navega a rutas que **ya están en el sidebar**. Resultado: el usuario ve los mismos destinos duplicados (sidebar + tabs) y no entiende qué es un módulo y qué es un atajo.

Además hay funcionalidad valiosa que existe en BD/servicios pero no tiene UI: pagos globales, notas de crédito globales, presupuesto vs. real, workflow de aprobación completo, dashboard.

## Objetivo

Un solo módulo `/compras` con navegación **exclusivamente por sidebar** (sin tabs cross-módulo), rutas coherentes, y las 3 piezas faltantes que pediste: **aprobación**, **conciliación con embarques** y **dashboard**.

---

## Estructura final propuesta

```text
Sidebar "Compras"
├── Dashboard              /compras
├── Bandejas
│   ├── Por capturar       /compras/por-capturar   (antes /cxp/por-capturar)
│   ├── Por aprobar        /compras/por-aprobar    (NUEVO)
│   └── Por pagar          /compras/por-pagar      (antes /cxp/por-pagar)
├── Facturas               /compras/facturas       (antes /cxp)
│   └── :id                /compras/facturas/:id   (drawer/detalle)
├── Pagos                  /compras/pagos          (NUEVO, listado global)
├── Notas de crédito       /compras/notas-credito  (NUEVO, listado global)
├── Proveedores            /compras/proveedores    (antes /proveedores)
│   └── :id                /compras/proveedores/:id
├── Antigüedad             /compras/aging          (ya existe, se expone en sidebar)
└── Reportes               /compras/reportes       (NUEVO: gasto por proveedor/categoría/período)
```

Rutas viejas → **redirects 301 client-side** para no romper links guardados.

---

## Olas de implementación

### Ola A — Navegación y estructura (base)
1. **Eliminar `ComprasTabStrip`** de las 6 páginas donde se usa. La navegación entre páginas del módulo se hace únicamente por sidebar.
2. **Renombrar rutas** al prefijo `/compras/*` en `appRoutes.tsx`. Agregar redirects desde las rutas viejas (`/cxp`, `/cxp/por-capturar`, `/cxp/por-pagar`, `/proveedores`, `/proveedores/:id`) hacia las nuevas.
3. **Reconstruir sección "Compras" del sidebar** en `sidebarRoleBuilders.ts` con la estructura de arriba, ordenada por flujo (Dashboard → Bandejas → Facturas → Pagos → NC → Proveedores → Aging → Reportes).
4. **Ajustar roles**: `contador`, `tesorero`, `auxiliar_contable`, `admin_org`, `admin` acceden a la sección; `gerente_operaciones` mantiene solo lectura de Facturas y Proveedores.
5. **Retirar `/cartera` de la sección Compras** (es CxC, se queda en "Facturación").

### Ola B — Dashboard de Compras (`/compras`)
Reemplaza el hub actual por un dashboard real con:
- **KPIs**: total por pagar (MXN/USD), vencido, próximo a vencer 7 días, por aprobar, por capturar.
- **Aging chart** (5 cubetas) resumen, click → `/compras/aging`.
- **Top 5 proveedores por saldo** con link a detalle.
- **Gasto del mes por categoría** (usa `presupuesto_categorias`).
- **Presupuesto vs. real del mes** (usa `presupuesto_mensual`, ya existe la tabla).
- **Últimas facturas capturadas** (5).

Solo lectura. Todo lo demás vive en sus rutas.

### Ola C — Workflow de aprobación (`/compras/por-aprobar`)
1. Nueva bandeja dedicada. Hoy la aprobación vive dispersa en `Cxp.tsx` con deep-link `?aprobacion=pendiente`; la extraemos a su propia ruta.
2. Estados de `proveedor_facturas`: `borrador → pendiente_aprobacion → aprobada → pagada` (+ `rechazada`). Migración para añadir `estado_aprobacion`, `aprobada_por`, `aprobada_en`, `motivo_rechazo` si faltan.
3. UI: tabla con filtros (proveedor, monto, categoría, embarque), acciones Aprobar/Rechazar con motivo, comentarios.
4. Reglas por rol: `contador` y `admin_org` pueden aprobar; `auxiliar_contable` solo captura.
5. Badge dinámico en sidebar con el conteo pendiente (ya existe `cxpAprobacionCount.ts`).

### Ola D — Conciliación con embarques
1. Vista lateral en el detalle de factura: conceptos de costo del embarque vs. conceptos de la factura, con matching automático por descripción/monto.
2. Botón "Vincular concepto" que crea el enlace en `proveedor_facturas_conceptos`.
3. En el detalle de embarque, mostrar sección "Facturas de proveedor" con estado (conciliado / parcial / sin factura).
4. Reporte de discrepancias: presupuestado vs. facturado por embarque.

### Ola E — Pagos y Notas de crédito globales
1. `/compras/pagos`: listado paginado de `pagos_proveedor` con filtros (proveedor, método, fechas, cuenta bancaria). Export CSV. Click → factura origen.
2. `/compras/notas-credito`: listado paginado de `proveedor_notas_credito` con filtros. Alta desde aquí (además del acceso actual desde el detalle de factura).

### Ola F — Reportes
`/compras/reportes` con 3 vistas:
- Gasto por proveedor (top N, período).
- Gasto por categoría de presupuesto (barras + tabla).
- Evolución mensual (12 meses).

Export CSV/PDF.

---

## Tests y guardrails

Cada ola termina con:
- **Tests unitarios** de los servicios nuevos (aprobación, listado de pagos, listado de NC, reportes).
- **Test de navegación**: `sidebarComprasSection.test.tsx` que valida que la sección tenga exactamente los ítems esperados por rol.
- **Guardrail arquitectural**: extender `pagedListsAllowlist.test.ts` con las nuevas rutas (`por-aprobar`, `pagos`, `notas-credito`) para forzar uso de `useServerPagedList`.
- **Test de redirects**: `comprasRedirects.test.tsx` que verifica que `/cxp`, `/cxp/por-capturar`, `/cxp/por-pagar`, `/proveedores` redirigen a `/compras/*`.
- Actualizar `CHANGELOG.md` y bump `APP_VERSION` en cada ola.

---

## Detalles técnicos

- **`ComprasTabStrip`**: se elimina el import de las 6 páginas (`Compras.tsx:111`, `Proveedores.tsx:57`, `CxpPorCapturar.tsx:90`, `Cxp.tsx:107`, `CxpPorPagar.tsx:174`, `CxpAging.tsx:111`) y luego se borra el archivo.
- **Renombrado de rutas**: se hace en `src/routes/appRoutes.tsx:65-68` y se añaden `<Route path="/cxp/*" element={<Navigate to="/compras/facturas" replace />} />` etc. Los componentes NO se mueven de carpeta en esta ola (evita ruido); solo cambia el `path`.
- **Migración de estados aprobación**: nueva migración en `supabase/migrations/` que agrega columnas si faltan y RLS ya existentes se mantienen.
- **Dashboard**: nuevo componente `src/features/compras/routes/ComprasDashboard.tsx` que reemplaza `Compras.tsx` actual (renombramos el archivo viejo a `ComprasHubLegacy.tsx` temporalmente y lo eliminamos al terminar Ola B).
- **Actualizar `mem://features/modulo-compras`** para reflejar el nuevo alcance real.

---

## Orden y entrega

Ola A y B en el próximo turno (base + dashboard). Luego C, D, E, F, una por turno, con sus tests. Al finalizar cada ola, resumen breve + siguiente pregunta.

¿Arranco por **Ola A + B** (navegación limpia + dashboard) en el siguiente mensaje?
