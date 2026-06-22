## Bug

En `/cxp`, al aprobar una factura desde el diálogo "Detalle de pagos":

1. La RPC `aprobar_factura_proveedor` sí actualiza la base (toast verde correcto).
2. `useAprobarFactura` invalida `["cxp"]`, la lista refetchea bien.
3. **Pero** el padre (`Cxp.tsx`) pasa la factura al diálogo así: `data.find(d => d.id === detalle.id) ?? detalle`. Si el usuario filtró por "Por aprobar", la factura ya aprobada desaparece de `data`, el `find` retorna `undefined`, y el diálogo se queda con el snapshot original donde `estado_aprobacion === "pendiente"`.

Resultado: badge "Pendiente" persiste dentro del diálogo aun cuando la BD ya marca "aprobada". También afectaría a Pagos: el botón "Pagar" se mantendría bloqueado por requerir aprobación.

## Fix

### 1. Nuevo service — `fetchFacturaProveedor(id)`
Archivo: `src/features/cxp/services/proveedorFacturas.ts`
Lee el row individual de `proveedor_facturas` con join mínimo (mismo shape `FacturaCxP` que retorna `fetchFacturasCxP`, pero para un solo id). Reutiliza el mapeador existente.

### 2. Nuevo hook — `useFacturaProveedor(id, initialData?)`
Archivo: `src/features/cxp/hooks/useFacturaProveedor.ts`
- `queryKey: queryKeys.cxp.factura(id)`.
- `enabled: !!id`.
- `initialData` opcional para arrancar con el snapshot que llega del padre y evitar flash.

### 3. `useAprobarFactura` — escribir el row fresco en caché
Archivo: `src/features/cxp/hooks/useAprobarFactura.ts`
En `onSuccess`, además de las invalidaciones actuales, hacer:
```ts
qc.setQueryData(queryKeys.cxp.factura(vars.id), mapRowToFacturaCxP(data));
```
Esto garantiza que cualquier consumidor del hook individual reciba el nuevo `estado_aprobacion` aunque la lista filtrada lo haya descartado.

### 4. `DialogDetallePagosProveedor` — leer del hook, no del prop
Archivo: `src/features/cxp/components/DialogDetallePagosProveedor.tsx`
Sustituir el uso directo de `factura` por:
```ts
const { data: facturaFresh } = useFacturaProveedor(factura?.id, factura ?? undefined);
const f = facturaFresh ?? factura;
```
Y pasar `f.estado_aprobacion`, `f.motivo_rechazo`, `f.saldo`, etc. al `BotonesAprobacionFactura` y a los KPIs.

### 5. Versionado + changelog
- `APP_VERSION` → `13.106.6`.
- Entrada `[13.106.6]` en `CHANGELOG.md` describiendo el fix.

## Verificación

1. Filtrar la lista CxP por **Aprobación = Por aprobar**.
2. Abrir el diálogo de una factura → aprobarla.
3. El badge dentro del diálogo debe cambiar a **Aprobada** en verde sin necesidad de cerrar/abrir.
4. La fila desaparece de la lista filtrada (comportamiento esperado).
5. Sin filtros, mismo flujo: badge se actualiza también.

## Fuera de alcance

- No se toca la RPC ni los GRANTs (ya funcionan).
- No se cambia el filtrado de la lista — desaparecer la fila cuando ya no cumple el filtro es lo correcto.
