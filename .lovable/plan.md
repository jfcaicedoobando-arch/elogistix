

## Agregar "20' GP" a todos los dropdowns de tipo de contenedor

### Archivos a modificar

1. **`src/data/containerTypes.ts`** — Agregar `{ code: "20GP", name: "20' GP" }` al inicio del array (o después del 20' Dry, por orden lógico).

2. **`src/components/cotizacion/SeccionMercanciaMaritimaFCL.tsx`** — Agregar `"20' GP"` al array local `CONTENEDORES_FCL`.

Estos son los dos únicos catálogos que alimentan los dropdowns de tipo de contenedor en toda la app (embarques y cotizaciones).

