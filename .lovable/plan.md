

## Plan: Refactorizar NuevaCotizacion.tsx — Extraer `useCotizacionWizardForm`

### Problema
`NuevaCotizacion.tsx` tiene 577 líneas con ~30 `useState`, lógica de navegación, validación, persistencia y cálculos mezclados. Difícil de mantener.

### Solución
Extraer un hook `useCotizacionWizardForm` que encapsule todo el estado y la lógica, dejando `NuevaCotizacion.tsx` como orquestador puro de UI.

### Cambios

#### 1. Crear `src/hooks/useCotizacionWizardForm.ts` (~250 líneas)
Mover al hook:
- Los ~30 `useState` (destinatario, datos generales, mercancía, ruta, conceptos, wizard)
- Helpers: `handleCambiarTipoEmbarque`, `actualizarConcepto`, `agregarConcepto`, `eliminarConcepto`
- Cálculos: `totalUSD`, `subtotalMXN`, `ivaMXN`, `totalMXN`, totales LCL/aéreos, P&L
- Derivados: `esMaritimo`, `esAereo`, `clienteSeleccionado`
- `buildPaso1Data`, `handleSiguiente`, `handleGuardar`
- Factories `emptyUSD`, `emptyMXN`

El hook recibe las dependencias (navigate, toast, user, clientes, mutations) y retorna un objeto tipado con todo el estado y las acciones.

#### 2. Simplificar `src/pages/NuevaCotizacion.tsx` (~200 líneas)
- Importar `useCotizacionWizardForm`
- Desestructurar estado y acciones del hook
- Mantener solo el JSX (header, steps, footer)
- Sin lógica de negocio en el componente

#### 3. Actualizar `src/pages/Changelog.tsx`
Entrada v4.20.0 documentando la refactorización.

### Archivos
- **Crear**: `src/hooks/useCotizacionWizardForm.ts`
- **Modificar**: `src/pages/NuevaCotizacion.tsx`, `src/pages/Changelog.tsx`

