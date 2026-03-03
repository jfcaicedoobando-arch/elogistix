

## Consignatario: Mismo cliente o tercero

### Situación actual
El dropdown de Consignatario muestra solo los **contactos del cliente** + opción "Otro (escribir manualmente)". No hay forma directa de indicar que el consignatario es el mismo cliente seleccionado.

### Propuesta de UX

Agregar una opción fija al inicio del dropdown: **"Mismo cliente"**, que al seleccionarse tome automáticamente el nombre del cliente seleccionado. El dropdown quedaría así:

```text
┌─────────────────────────────────────────┐
│  Mismo cliente (Empresa ABC S.A.)       │  ← nuevo
│─────────────────────────────────────────│
│  Juan Pérez — Importador (México)       │  ← contactos existentes
│  Li Wei — Exportador (China)            │
│─────────────────────────────────────────│
│  Otro (escribir manualmente)            │  ← ya existe
└─────────────────────────────────────────┘
```

### Archivos a modificar

**`src/components/embarque/StepDatosGenerales.tsx`** (líneas 116-126)
- Agregar `<SelectItem value="__cliente__">Mismo cliente ({selectedClienteName})</SelectItem>` como primera opción
- Pasar el nombre del cliente seleccionado como prop (ya disponible desde `NuevoEmbarque.tsx`)
- Al seleccionar `__cliente__`, limpiar `consignatarioManual`

**`src/components/embarque/StepDatosGenerales.tsx`** (Props interface)
- Agregar prop `clienteNombre: string`

**`src/hooks/useEmbarqueForm.ts`** (función `buildEmbarquePayload`)
- Manejar el caso `__cliente__`: cuando `consignatario === '__cliente__'`, usar el nombre del cliente como valor del campo consignatario en el payload

**`src/pages/NuevoEmbarque.tsx`**
- Pasar `clienteNombre={selectedCliente?.nombre || ''}` al componente `StepDatosGenerales`

**`src/pages/EditarEmbarque.tsx`**
- Mismo cambio: pasar `clienteNombre` al componente

**`src/pages/Changelog.tsx`**
- Nueva entrada v4.2.6

### Sin cambios en BD
No se requiere migración. El campo `consignatario` en la tabla `embarques` ya es `text` y almacenará el nombre resuelto.

