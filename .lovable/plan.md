
# Revisión de Facturación con el nuevo workflow

## TL;DR
Con el flujo nuevo (cliente acepta → un clic → borrador de factura), **el paso interno de "aprobar proforma" ya no existe**. Eso deja obsoletos varios pedazos. Propongo:

- **Eliminar** la bandeja `/facturacion/por-emitir` y la pestaña "Por timbrar" del módulo Facturación (ambas se apoyan en `estado_revision='pendiente'`, un estado del flujo viejo).
- **Consolidar la información** en dos lugares únicos:
  - `/proformas` (con sus filtros por `estado_cliente`) = qué está esperando al cliente y qué está listo para convertir.
  - `/facturacion` = solo CFDI (Emitidas + Notas de Crédito + KPIs + Hueco de Facturación).
- **Conservar** Dashboard Ejecutivo, KPIs Fiscales, Hueco de Facturación, Emitidas, Notas de Crédito, Nueva factura manual.

---

## Analogía
Piensa en Facturación como la caja registradora de una tienda: sólo debería mostrarme **tickets ya emitidos** y **problemas de tickets** (cancelaciones, notas de crédito). Todo lo "por emitir" es realmente inventario esperando en el mostrador — pertenece a **Proformas**, no a la caja. Antes teníamos el mismo montón de papeles en los dos escritorios, y eso confundía al contador.

---

## Estado actual (qué hay hoy)

### Página `/facturacion` (`Facturacion.tsx`)
1. `DashboardEjecutivoFacturacion` — KPIs de emisión.
2. `FacturacionKpisFiscales` — KPIs fiscales.
3. `HuecoFacturacionCard` — embarques con ETD > 5 días sin factura.
4. `GuiaPrefacturacion` — guía pedagógica del flujo viejo.
5. Tabs:
   - **Por timbrar** → `TabProformasPendientes` (filtra `estado_revision='pendiente'`, incluye botón "Aprobar" y "Consolidar").
   - **Emitidas** → `TabFacturasEmitidas`.
   - **Notas de crédito** → `NotasCreditoRecientes`.
6. Botón "Nueva factura manual".

### Bandeja `/facturacion/por-emitir` (`FacturacionPorEmitir.tsx`)
- Consume RPC `facturacion_por_emitir`, muestra proformas listas para timbrar con importe y días de atraso.
- Sidebar: "Por emitir (Facturación)".

### `/proformas` (`ProformasListado.tsx`)
- Ya lista todas las proformas con filtros por estado y permite convertir a factura con un solo clic.

---

## Diagnóstico por pieza

| Pieza | Estado | Razón |
|---|---|---|
| Dashboard Ejecutivo | **Conservar** | Golpe de vista de emisión, no depende del flujo viejo. |
| KPIs Fiscales | **Conservar** | Métricas fiscales agregadas. |
| Hueco de Facturación | **Conservar** | Fuente única de "qué debería estar facturado y no lo está" — reemplaza conceptualmente a "Por timbrar". |
| Tab "Emitidas" | **Conservar** | Núcleo del módulo. |
| Tab "Notas de crédito" | **Conservar** | Necesario para trazabilidad SAT. |
| Botón "Nueva factura manual" | **Conservar** | Ruta de escape para facturas fuera de proforma. |
| **Tab "Por timbrar"** | **Eliminar** | Filtra por `estado_revision='pendiente'` (revisión interna). En el flujo nuevo eso ya no gatilla nada: lo que importa es `estado_cliente='aceptada'`, y esas proformas ya se listan en `/proformas` con conversión de un clic. Los botones "Aprobar" y "Consolidar" pertenecen al flujo viejo. |
| **Bandeja `/facturacion/por-emitir`** | **Eliminar** | Duplica la tab "Por timbrar" y también se ancla en el flujo viejo. La visibilidad diaria del contador se cubre con Hueco de Facturación + filtros de `/proformas`. |
| `GuiaPrefacturacion` | **Eliminar** (o reescribir 1 párrafo) | Explica el flujo viejo (aprobar → consolidar → timbrar). Con un clic ya no hace falta guía. |
| Consolidar proformas N:1 | **Mover a `/proformas`** | Sigue teniendo sentido operativo (fusionar varias proformas del mismo embarque en una sola factura), pero pertenece al listado de proformas, no a Facturación. Si ya está la fusión en `TabProformas` (usada en `/proformas`), aquí solo se retira la duplicación. |

---

## Propuesta final: cómo queda cada módulo

### `/facturacion` (limpio, solo CFDI)
```text
┌─ Header: "Facturación" · [Nueva factura manual]
├─ Dashboard Ejecutivo
├─ KPIs Fiscales
├─ Hueco de Facturación (alerta única de "falta emitir")
└─ Tabs:
   ├─ Emitidas
   └─ Notas de crédito
```

### `/proformas` (única fuente de "qué está pendiente con el cliente")
- Filtros por `estado_cliente`: Aceptada, Esperando cliente, Rechazada, Todas.
- Un clic → borrador de factura (ya implementado).
- Consolidar N:1 vive aquí.

### Sidebar
- Quitar el ítem "Por emitir (Facturación)".

---

## Detalles técnicos (por si te interesan)

Archivos a **borrar**:
- `src/features/bandejas/routes/FacturacionPorEmitir.tsx`
- `src/features/facturacion/components/TabProformasPendientes.tsx`
- `src/features/facturacion/components/TabProformasPendientesToolbar.tsx`
- `src/features/facturacion/components/TabProformasPendientesGrupos.tsx`
- `src/features/facturacion/hooks/useTabProformasPendientesController.ts`
- `src/features/facturacion/components/GuiaPrefacturacion.tsx`
- Tests asociados.

Archivos a **editar**:
- `src/features/facturacion/routes/Facturacion.tsx`: quitar tab "Por timbrar", guía, y `proformasPendientes` de `useFacturacionPageController`. Dejar Emitidas + Notas de Crédito como tabs (o pasar a un solo listado si se prefiere).
- `src/routes/appRoutes.tsx` y `src/routes/appRoutes.lazy.ts`: quitar ruta `/facturacion/por-emitir`.
- `src/components/layout/sidebarItems.ts`: quitar entry.
- `src/hooks/layout/sidebarRoleBuilders.ts`: quitar `/facturacion/por-emitir` de los grupos.
- `src/features/facturacion/hooks/useFacturacionPageController.ts`: eliminar dependencia de `useProformasPendientes`.
- Evaluar si `useProformasPendientes` / `fetchProformasPendientes` / RPC `facturacion_por_emitir` quedan sin uso; si es así, borrar y agregar migración `DROP FUNCTION facturacion_por_emitir`.

Riesgos:
- Usuarios con bookmarks a `/facturacion/por-emitir` → agregar un `<Navigate>` a `/proformas?estado=aceptada` para no romper enlaces.
- Confirmar que ningún test E2E dependa de la tab "Por timbrar" antes de eliminar (se ajustan en el mismo PR).

Versión objetivo: bump `13.145.10` + entrada en `CHANGELOG.md`.

---

## Antes de implementar, ¿confirmas?
1. ¿Ok con **eliminar** la bandeja `/facturacion/por-emitir` y la tab "Por timbrar" (no ocultar, borrar)?
2. ¿Mantengo Consolidar N:1 disponible en `/proformas` o también lo retiras?
3. ¿Quieres conservar `GuiaPrefacturacion` reescrita para el flujo nuevo, o directo la borro?
