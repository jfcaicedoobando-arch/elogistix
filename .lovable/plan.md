

# Cambiar etiqueta RFC/Tax ID según origen Nacional/Extranjero

## Cambio

### `src/components/NuevoProveedorDialog.tsx`
- Cambiar la lógica de `rfcLabel`: si `origenProveedor === 'Nacional'` mostrar **"RFC"**, si `origenProveedor === 'Extranjero'` mostrar **"Tax ID"**
- Actualizar el placeholder del input de forma correspondiente ("Ingresa el RFC" vs "Ingresa el Tax ID")
- Esta lógica aplica a **todos** los tipos de proveedor, no solo Agente de Carga

### `src/components/EditarProveedorDialog.tsx`
- Aplicar la misma lógica de etiqueta RFC/Tax ID basada en `origenProveedor`

