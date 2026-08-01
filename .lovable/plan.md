# Marcar todos los clientes de Elogistix como cuenta directa (sin comisión)

## Qué se va a hacer

1. **Corregir 3 errores de compilación** que quedaron del cambio anterior (falta propagar el nuevo campo `sin_comision` en los tipos del detalle de cliente).
2. **Marcar los 23 clientes de la organización Elogistix** con la casilla "Cuenta directa (sin comisión)" activada.

## Datos verificados

Consulta a la base de datos:

- La organización "Elogistix" tiene **23 clientes**, ninguno marcado hoy como sin comisión.
- Las otras organizaciones con clientes son de demo ("Demo Logistics MX" 8, "Demo Libre Carga" 3) y **no se tocan**.

Efecto de la marca: los embarques de esos clientes no devengarán comisión (salvo que un embarque se ponga explícitamente en "Sí genera comisión"), dejarán de aparecer en "Embarques sin vendedora asignada" y los pasos de comisión del checklist de cierre saldrán en gris "No aplica".

## Detalles técnicos

Errores a corregir (el campo nuevo existe en el formulario pero no en el tipo del detalle):

- `src/features/cliente/hooks/useClienteDetalleController.types.ts`: agregar `sin_comision: boolean` al tipo `Cliente` (ya está en `ClienteFormData`).
- `src/features/cliente/components/detalle/ClienteDetalleDialogs.tsx`: el prop `cliente` queda compatible una vez que `Cliente` incluye el campo; ajustar si el mapeo lo requiere.
- `src/features/cliente/hooks/__tests__/useClienteDetalleController.test.tsx`: añadir `sin_comision: false` al fixture del formulario.
- `src/features/cliente/routes/ClienteDetalle.tsx`: dejar el paso del campo sin el cast temporal.

Cambio de datos (una sola sentencia de actualización, sin migración de esquema):

```sql
UPDATE public.clientes
   SET sin_comision = true
 WHERE organization_id = '00000000-0000-0000-0000-000000000001';
```

No se cancela nada retroactivamente porque no hay comisiones devengadas en uso todavía.

## Verificación

- Compilación de tipos sin errores y test del controlador de cliente en verde.
- Conteo en base de datos: 23 clientes de Elogistix con la marca activa.
- El detalle de un cliente muestra el interruptor "Cuenta directa (sin comisión)" encendido.
