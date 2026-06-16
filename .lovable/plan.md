## Reordenar dropdown de Tipo de Contenedor en Paso 1 del wizard de cotización

**Problema:** El dropdown "Tipo de Contenedor" en `SeccionMercanciaMaritimaFCL.tsx` usa un array hardcodeado (`CONTENEDORES_FCL`) cuyo orden no sigue una secuencia lógica para el usuario (mezcla tamaños y tipos).

**Solución:** Reordenar el array estático de forma coherente: primero por tamaño de contenedor (`20'`, `40'`, `45'`) y dentro de cada tamaño por tipo (`GP/Dry`, `High Cube`, `Reefer`, `Open Top`, `Flat Rack`).

**Cambios:**
1. `src/features/cotizacion/components/SeccionMercanciaMaritimaFCL.tsx` — Reordenar `CONTENEDORES_FCL`.
2. `src/constants/appVersion.ts` — Bump de versión patch (ej. `13.26.1`).
3. `CHANGELOG.md` — Registrar cambio con fecha de hoy.

**Orden propuesto:**
- `20' GP`
- `20' Dry`
- `20' High Cube`
- `20' Reefer`
- `20' Open Top`
- `20' Flat Rack`
- `40' Dry`
- `40' High Cube`
- `40' Reefer`
- `40' Open Top`
- `40' Flat Rack`
- `45' High Cube`

**Out of scope:** No se migra al catálogo dinámico de BD; eso requiere un diseño mayor de integración con tarifas y valores legacy.