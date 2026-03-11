

## Plan: Campo "Tipo de Unidad" condicional para modo Terrestre

### Cambios

**1. `src/hooks/useCotizacionWizardForm.ts`**
- Agregar `tipoUnidad: string` a `CotizacionFormValues` (default `""`)
- En `buildPaso1Data`, incluir `tipo_unidad: v.modo === 'Terrestre' ? v.tipoUnidad : null`

**2. `src/components/cotizacion/SeccionMercanciaGeneral.tsx`**
- Leer `modo` del form context
- Si `modo === 'Terrestre'`: mostrar solo un campo "Tipo de Unidad" (input texto, placeholder "Ej. Trailer, Caja seca, Plataforma, Rabón...")
- Si no: mostrar Peso, Volumen, Piezas como hoy

**3. Migración de BD**
- Agregar columna `tipo_unidad TEXT` (nullable) a la tabla `cotizaciones`

**4. `src/pages/Changelog.tsx`** — Registrar v4.42.0

