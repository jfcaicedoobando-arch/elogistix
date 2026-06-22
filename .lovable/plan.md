## Diagnóstico

**Por qué el estado "no cambia" tras aprobar:**
- La RPC `aprobar_factura_proveedor` sí actualiza la BD correctamente (verificado).
- El hook `useAprobarFactura` invalida la query lista (`["cxp"]`) y se refetchea.
- **Pero** el `DialogDetallePagosProveedor` recibe la factura desde `f.detalle` (estado local seteado al hacer click en la fila). Ese snapshot no se refresca cuando llega data nueva, así que el badge en el dialog sigue mostrando "Pendiente" aunque la fila de la tabla detrás ya cambió.

Analogía: la lista es una pizarra que se borra y se vuelve a escribir; el dialog está mirando una foto vieja de esa pizarra.

## Solución

### 1. Sincronizar el dialog con la query (`src/features/cxp/routes/Cxp.tsx`)
Derivar la factura "viva" buscándola por id en `data` (refetch-aware), con fallback al snapshot mientras llega la actualización:

```ts
const detalleLive = f.detalle
  ? data.find((d) => d.id === f.detalle!.id) ?? f.detalle
  : null;
```
y pasar `factura={detalleLive}` a `DialogDetallePagosProveedor`.

Aplicar el mismo patrón al `DialogRegistrarPagoProveedor` (`factura={pagarLive}`) para que el badge de aprobación y los saldos del header siempre estén al día.

### 2. Mejorar el aspecto del toast (`src/components/ui/sonner.tsx`)
- Activar `richColors` para que success/error/warning tengan paleta consistente y un icono propio.
- Subir `duration` a 4000ms para éxito.
- Pulir clases: bordes más finos, sombra `shadow-xl`, padding mayor, tipografía `text-sm font-medium` para el título, descripción `text-xs`.
- Mantener `position="top-right"`, `closeButton`, y los tap-targets del actionButton.

Resultado: toasts con franja de color por severidad, icono nativo de Sonner, y mejor jerarquía visual entre título y descripción — sin cambiar la API que ya usan `notifySuccess` / `notifyError`.

### 3. Versionado
- `APP_VERSION` → `13.103.3`.
- Entrada en `CHANGELOG.md`: fix de sincronización del detalle CxP tras aprobar/rechazar + mejora visual del Toaster.

### Fuera de alcance
- No se toca la RPC ni el trigger (funcionan).
- No se toca el flujo de permisos (`puedeAprobar`).
- No se cambia la API de `notifySuccess`/`notifyError`.
