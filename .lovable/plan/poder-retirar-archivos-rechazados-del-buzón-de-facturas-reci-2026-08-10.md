# Poder retirar archivos rechazados del buzón de facturas recibidas

## Situación actual (verificada)

En el embarque que estás viendo (ELIMP00359) hay un archivo en el buzón:
`6507153900-20260807154117.PDF`, con estado **Rechazada** y motivo
"SELECCION DE PROVEEDOR EQUIVOCADO".

Hoy el botón "Retirar" del buzón sólo aparece cuando el documento está en
**Por capturar**. Como este ya fue rechazado, no hay forma de quitarlo desde la
pantalla: se queda ahí para siempre como historial.

## Qué se va a construir

1. **Retirar documentos rechazados**
   Habilitar el botón "Retirar" también para documentos en estado **Rechazada**,
   con las mismas reglas de quién puede hacerlo: quien lo subió, o un
   administrador. Los documentos ya **Capturados** siguen protegidos (esos ya
   tienen una factura de proveedor detrás y no deben desaparecer).

2. **Devolver a "Por capturar" (reintentar)**
   Cuando el rechazo fue por un error de captura (por ejemplo, proveedor
   equivocado) y el archivo del proveedor sí es válido, agregar la acción
   **"Devolver a por capturar"** en el documento rechazado. Limpia el motivo de
   rechazo y lo regresa a la bandeja de contabilidad, sin volver a subir el PDF.

3. **Confirmación clara**
   El diálogo de "Retirar" explicará que el archivo se elimina del
   almacenamiento y no se puede recuperar; el de "Devolver" explicará que
   volverá a aparecer en la bandeja de Compras por capturar.

4. **Bitácora**
   Ambas acciones quedan registradas en la bitácora del embarque (quién, cuándo
   y sobre qué documento), igual que el resto del buzón.

## Detalles técnicos

- `src/lib/domain/facturasEntrantes.ts`: `puedeEliminarEntrante` acepta
  `por_capturar` y `rechazada`; nueva función pura `puedeReactivarEntrante`
  (sólo `rechazada`, mismo dueño o admin). Tests unitarios de ambas.
- Migración: RPC `public.reactivar_factura_entrante(p_id uuid)` en
  SECURITY DEFINER que valida organización + rol, exige `estado = 'rechazada'` y
  `proveedor_factura_id IS NULL`, y regresa a `por_capturar` limpiando
  `rechazo_motivo` / `capturado_por`. Códigos de error `LC_ENTRANTE_*` con
  mensaje amigable en `src/lib/errors/`.
- Endurecer la RLS/política de UPDATE de `embarque_facturas_entrantes` para que
  el borrado lógico (`deleted_at`) no sea posible cuando el documento está
  `capturada` con factura vinculada.
- `src/features/cxp/services/facturasEntrantes.ts`: `reactivarFacturaEntrante`
  + registro en bitácora; `eliminarFacturaEntrante` conserva el borrado lógico y
  la limpieza de storage.
- `src/features/cxp/hooks/useFacturasEntrantes.ts`: hook
  `useReactivarFacturaEntrante` con invalidación de `cxp.facturasEntrantes`,
  `embarques.all` y `conceptos_costo`.
- UI: `entrantes/FacturaEntranteItem.tsx` (nueva acción y prop
  `puedeReactivar`), `TabFacturasEntrantes.tsx` (segundo
  `ConfirmActionDialog`). Si algún archivo pasa de 200 líneas, se extrae el
  bloque de diálogos a un subcomponente.
- Prueba SQL en `supabase/tests/` para la RPC (rechazada → por capturar,
  bloqueo cuando ya está capturada) y registro en el workflow `rls-tests`.
- `CHANGELOG.md` + `APP_VERSION` a 13.494.0.

## Mientras tanto, para tu caso de hoy

Puedo retirar directamente ese archivo rechazado de ELIMP00359 al aplicar el
cambio, si me lo confirmas.
