
# Rediseño del módulo Facturación (v13.92.0)

Objetivo: que Isela (contador) entre a un único lugar claro y vea **qué tiene que hacer hoy** + KPIs, en lugar de 6 tabs mezclados.

## 1. Cambios de navegación (sidebar)

**Antes** (grupo "Gestión"):
- Pre-Facturación (6 tabs)
- Cuentas por Pagar
- Tesorería
- Comisiones

**Después** (grupo "Gestión"):
- **Facturación** (renombrado, ícono `FileText`)
- Cobranza (CxC) — *promovido de tab a item; ya existe `/cartera`, solo se promueve en sidebar*
- Cuentas por Pagar
- Tesorería
- Comisiones

**Grupo "Reportes"** (nuevo item):
- Cierre mensual (proyección) — *se mueve tab 6 aquí, ruta `/reportes/cierre-mensual`*
- Rentabilidad (ya existe)

**Grupo "Mi bandeja"**: se elimina "Por emitir (Facturación)" porque ahora es el landing por defecto de `/facturacion`.

## 2. Nueva estructura de `/facturacion`

```text
/facturacion                        ← Dashboard + Bandeja "Por timbrar"
/facturacion/emitidas               ← CFDI vigentes (con su REP)
/facturacion/notas-credito          ← Notas de crédito e historial de cancelaciones
/facturacion/:id                    ← Detalle (sin cambio)
```

**Landing `/facturacion`** (dashboard del contador):

```text
┌─ KPIs ─────────────────────────────────────────────┐
│ Facturado mes │ Por timbrar │ Por cobrar │ REP    │
│ MXN 46.2K     │ 22 proformas│ MXN 737.8K │ pend 3 │
└────────────────────────────────────────────────────┘

┌─ Bandeja: Por timbrar hoy ─────────────────────────┐
│ Proforma │ Cliente │ Monto │ Embarque │ [Timbrar] │
│ ...                                                 │
└────────────────────────────────────────────────────┘

┌─ Alertas ──────────────────────────────────────────┐
│ • 3 REP vencen en ≤2 días (día 5)                  │
│ • 1 factura pendiente desde hace 5 días            │
│ • Hueco de facturación: 29 embarques cerrados sin  │
│   factura (USD 202K + MXN 3.4M)  [Ver detalle]     │
└────────────────────────────────────────────────────┘
```

## 3. Tabs internos (de 6 → 3)

| Tab actual | Destino nuevo |
|---|---|
| 1. Por aprobar (22) | **Tab 1 "Por timbrar"** (fusionado con Pendientes de tab 2) |
| 2. Proformas (136) | Filtro dentro de "Por timbrar" / "Emitidas" |
| 3. Facturas emitidas | **Tab 2 "Emitidas"** (incluye sub-filtro "REP pendientes") |
| 4. Cobranza (111) | Movido a `/cartera` |
| 5. Pagos a proveedores | Movido a `/cxp` |
| 6. Proyección | Movido a `/reportes/cierre-mensual` |
| — | **Tab 3 "Notas de crédito"** (nuevo, hoy escondido en historial) |

**REP**: queda como sub-filtro/chip dentro de "Emitidas" (no item propio del sidebar). Badge rojo si quedan ≤2 días para el día 5.

## 4. Permisos (sin cambio funcional)

Se respeta `usePermissions`:
- `canEmitirFactura` (contador, admin_org) → ve tab "Por timbrar" + botón Timbrar.
- `canViewFinancials` → ve KPIs.
- Otros roles ven solo lo que ya veían (read-only).

## 5. Plan de implementación (orden)

1. **Sidebar**: editar `src/components/layout/sidebarItems.ts`
   - Renombrar "Pre-Facturación" → "Facturación".
   - Promover "Cartera" al grupo Gestión (ya está en `Mi Bandeja`, moverlo).
   - Quitar "Por emitir (Facturación)" del bloque Mi Bandeja.
   - Agregar "Cierre mensual" en Reportes.
2. **Rutas**: `src/routes/appRoutes.tsx` añade `/facturacion/emitidas`, `/facturacion/notas-credito`, `/reportes/cierre-mensual`.
3. **Landing**: refactor `routes/Facturacion.tsx` → componente `FacturacionDashboard.tsx` con:
   - `KpiStrip` (reusa cards actuales).
   - `BandejaPorTimbrar` (extraído de TabProformasPendientes).
   - `AlertasFacturacion` (REP + hueco + atrasos).
4. **Tab "Emitidas"**: mover `TabFacturasEmitidas` a `/facturacion/emitidas` como página.
5. **Tab "Notas de crédito"**: extraer `HistorialNotasCredito` + `NotasCreditoRecientes` a `/facturacion/notas-credito`.
6. **Mover tab "Proyección"** a `/reportes/cierre-mensual` (reusa `TabProyeccion.tsx`).
7. **Eliminar tabs duplicadas**: borrar `TabCobranza` del módulo (la página `/cartera` ya la cubre) y la tab "Pagos a proveedores" (la página `/cxp` ya la cubre). Dejar redirects 301 internos por si alguien tiene URL vieja.
8. **CHANGELOG.md** + bump `APP_VERSION` a `13.92.0`.
9. **Test E2E**: actualizar `e2e/specs/03-factura.spec.ts` para nuevas tabs.

## 6. Riesgos / qué confirmar

- **No tocamos lógica de negocio** (timbrado, cancelación, REP, cálculos). Solo UI/ruteo.
- **URLs viejas** `/facturacion?tab=cobranza` quedan rotas → meter redirect a `/cartera`.
- **Roles que usaban tab "Pagos a proveedores"** (tesorero) ahora entran por `/cxp/por-pagar` que ya existe.

## 7. Lo que NO cambia

- Lógica de timbrado CFDI / REP.
- Migraciones de BD.
- Permisos (matriz de `usePermissions`).
- Detalle de factura `/facturacion/:id`.
- Cálculos financieros.

¿Apruebas para implementar?
