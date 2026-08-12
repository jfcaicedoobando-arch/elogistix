# Separar "Cierre operativo" y "Cierre administrativo" en las alertas de embarques

Hoy el panel de alertas (listado `/embarques`) muestra tarjetas de **Demoras**, **Garantías atoradas** y **Cierre administrativo**. La tarjeta de cierre administrativo mezcla embarques en `Entregado`, `EIR` y `Por liquidar`.

Nueva estructura de tarjetas:

| Tarjeta | Estados incluidos |
|---|---|
| Demoras | (sin cambio) |
| Garantías atoradas | (sin cambio) |
| **Cierre operativo** (nueva) | `Entregado`, `EIR` con pendientes |
| **Cierre administrativo** | sólo `Por liquidar` con pendientes |

Los criterios de "pendiente" (CxC sin cobrar, CxP sin pagar, documentos faltantes, venta sin facturar) se mantienen idénticos; sólo se separa por estado.

## Cambios en el backend (base de datos)

- Nueva migración que redefine `public.embarques_alertas_ids()`: el bloque `admin_pendiente` se divide en dos ramas que emiten `cierre_operativo` (estados `Entregado`, `EIR`) y `admin_pendiente` (estado `Por liquidar`), reusando exactamente las mismas condiciones de pendientes.
- `embarques_admin_pendientes_count()` se deja igual para que el badge del sidebar siga contando el total (operativo + administrativo), sin cambiar el número que ya conoce el usuario.

## Cambios en la interfaz

- `services/alertas.ts`: agregar el tipo `cierre_operativo` al mapa de alertas y al total.
- `hooks/useEmbarquesFilters.ts`: aceptar `?alerta=cierre_operativo` como valor válido del filtro.
- `components/EmbarquesAlertasPanel.tsx`: agregar la tarjeta "Cierre operativo" (icono de paquete entregado, tono `warning`) con la descripción "Entregado / EIR con documentos, CxC o CxP pendientes", y ajustar la de "Cierre administrativo" a "Por liquidar: falta cobrar al cliente o pagar al proveedor". La rejilla pasa de 3 a 4 columnas en pantallas grandes.
- Se conserva el comportamiento de ocultar tarjetas con cero y de filtrar el listado al hacer clic.

## Notas

- El límite de 200 líneas por archivo se respeta; si `EmbarquesAlertasPanel.tsx` lo excede, la definición de tarjetas se mueve a un archivo de constantes.
- Se registra el cambio en `CHANGELOG.md` y se sube `APP_VERSION`.
