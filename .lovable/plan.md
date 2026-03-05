

## Plan: Agregar campo "Agente" en Datos de Ruta marítimo

### Cambios

**1. Migración SQL** — Agregar columna `agente text` a la tabla `embarques`

**2. `src/hooks/useEmbarqueForm.ts`**
- Agregar `agente: string` al interface `EmbarqueFormState` y al `INITIAL_STATE`
- Agregar `agente` al `inicializarDesdeEmbarque`
- Agregar `agente: form.agente || null` al `buildEmbarquePayload`

**3. `src/components/embarque/StepDatosRuta.tsx`**
- Agregar props `agente` y `setAgente` al interface
- Agregar campo Input "Agente" justo después del campo "Naviera" en la sección marítima

**4. `src/pages/NuevoEmbarque.tsx`** y `src/pages/EditarEmbarque.tsx`**
- Pasar props `agente` y `setAgente` al componente `StepDatosRuta`

**5. `src/pages/Changelog.tsx`** — Entrada v4.9.1

