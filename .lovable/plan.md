

## Plan: Auto-asignar tipo contenedor "LCL" cuando servicio es LCL

### Lógica
Cuando el usuario selecciona **LCL** en "Tipo de Servicio", el campo "Tipo Contenedor" se fija automáticamente a "LCL" y se deshabilita (no tiene sentido elegir un contenedor específico en carga consolidada). Al volver a **FCL**, se reactiva el dropdown normal.

### Cambios

**1. `src/data/containerTypes.ts`**
- Agregar `{ code: "LCL", name: "LCL (Carga Consolidada)" }` al final del array

**2. `src/components/embarque/StepDatosRuta.tsx`**
- Interceptar el `onValueChange` del Select de Tipo de Servicio: cuando el valor sea `"LCL"`, llamar `setTipoContenedor("LCL")` automáticamente
- Cuando `tipoServicio === "LCL"`, mostrar el campo Tipo Contenedor como un Input deshabilitado con valor "LCL (Carga Consolidada)" en lugar del dropdown

**3. `src/pages/Changelog.tsx`**
- Nueva entrada v4.3.2

