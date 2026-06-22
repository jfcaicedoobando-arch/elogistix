## Problema

En `/cxp/por-pagar` las filas de la tabla **no son clickeables**. Hoy solo el expediente del embarque tiene link. No hay forma de abrir la factura para aprobarla ni registrar su pago.

En cambio, en `/cxp` cada fila abre `DialogDetallePagosProveedor`, que ya contiene los botones de **Aprobar / Rechazar** (`BotonesAprobacionFactura`) y el botón para **Registrar pago**.

Analogía: la bandeja "Por pagar" es como una lista de pendientes, pero no tiene "puerta" para entrar a cada pendiente. Vamos a abrirle la puerta.

## Solución (mínima, solo UI)

Hacer que cada fila de `src/features/bandejas/routes/CxpPorPagar.tsx` redirija al detalle existente reutilizando el deep-link que ya tiene `/cxp` (`?factura={id}`), el cual abre automáticamente el dialog de detalle.

### Cambios

1. **`src/features/bandejas/routes/CxpPorPagar.tsx`**
   - Importar `useNavigate` de `react-router-dom`.
   - Añadir `onClick` en `<TableRow>` que navegue a `/cxp?factura=${row.factura_id}`.
   - Añadir `cursor-pointer` y mantener `hover:bg-muted/50`.
   - En la celda del embarque (que ya tiene `<Link>`), envolver con `onClick={(e) => e.stopPropagation()}` para que el click en el link al embarque no dispare la navegación de la fila (regla del proyecto: dropdowns/links dentro de filas usan `stopPropagation`).

2. **`CHANGELOG.md`** + **`src/constants/appVersion.ts`**
   - Bump de versión patch (ej. `13.103.1`).
   - Entrada: "Fix: drilldown de filas en CxP → Por pagar; ahora abren el detalle de factura para aprobar y registrar pagos."

### Por qué reutilizar el deep-link y no abrir el dialog localmente

- El dialog `DialogDetallePagosProveedor` requiere el objeto `FacturaCxP` completo (no el row reducido de la vista `v_bandeja_cxp_por_pagar`). Replicar el fetch en esta página duplicaría lógica.
- El deep-link `/cxp?factura={id}` ya está implementado y probado en `Cxp.tsx` (líneas 37-49).

### Fuera de alcance

- Permisos: ya están correctos. `tesorero`, `admin`, `admin_org`, `super_admin` tienen acceso a `/cxp/por-pagar` y a `/cxp`; el botón "Registrar pago" se muestra cuando `canEdit` es true, y los botones de aprobar/rechazar respetan `puedeAprobar` dentro del dialog.
- No se tocan servicios, RLS, ni hooks de datos.
