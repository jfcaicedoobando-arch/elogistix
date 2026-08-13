# React Compiler: evaluar si reactivarlo o mantenerlo retirado

## Estado actual
- El **plugin de build** de React Compiler se retiró en `v13.569.0` (RTC-02).
- Razones documentadas:
  - Quedó en **0 archivos con la directiva `"use memo"`** tras la limpieza TC-03.
  - El plugin cargaba **Babel en cada build sin compilar nada** (costo de tiempo/memoria sin beneficio).
  - Las directivas muertas generaban warnings de Vite (`"use memo" was ignored`).
- Lo que **sí se conserva**:
  - `eslint-plugin-react-compiler` en `package.json`.
  - Regla `react-compiler/react-compiler: "warn"` en `eslint.config.js`.
  - Eso actúa como guardia estática de "Rules of React" sin afectar el bundle.

## ¿Fue buena idea?

### Sí, a corto plazo
- Elimina dependencia/build muerta.
- Reduce tiempo y memoria de build.
- Evita warnings falsos de directivas ignoradas.
- Mantiene las guardias de calidad vía ESLint.

### Riesgo a mediano plazo
- React 19.2 soporta el Compiler nativamente; al no tenerlo activo perdemos **memoización automática** en rutas calientes.
- Sin `"use memo"` no hay señal de qué componentes están listos para compilar.
- Las 3 violaciones históricas (`useSafeNavigate`, `sidebar`, `PlantillaSelector`) deben resolverse antes de volver a encenderlo.

## Propuesta

### Opción A — Mantener retirado (recomendada por ahora)
1. Dejar el plugin fuera de `vite.config.ts`.
2. Mantener `eslint-plugin-react-compiler` como `warn`.
3. Crear un test/auditoría que falle si alguien agrega `"use memo"` sin haber reinstalado el plugin (evita directivas muertas).
4. Revisar mensualmente si vale la pena reactivar según estabilidad de React Compiler y madurez del código.

### Opción B — Reactivar con enfoque phased
1. Reinstalar `babel-plugin-react-compiler` y cablearlo en `vite.config.ts` en modo `annotation`.
2. Resolver las 3 violaciones históricas que hoy están silenciadas.
3. Activar `"use memo"` en 1-2 rutas calientes de prueba (por ejemplo, `Embarques` o `Cotizaciones`).
4. Medir impacto en tiempo de build y bundle size.
5. Si es estable, expandir progresivamente a otras rutas.

## Pregunta para decidir

¿Quieres que preparemos un plan detallado para **Opción A** (mantenerlo fuera y blindar la decisión) o **Opción B** (reactivarlo de forma controlada en 2-3 rutas)?
