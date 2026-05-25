# Ejecutar la suite de tests

## Pasos
1. Verificar que existe configuración de Vitest (`vitest.config.ts`, `src/test/setup.ts`).
2. Si falta algo del setup, instalarlo siguiendo la guía estándar (vitest + @testing-library + jsdom).
3. Ejecutar `bunx vitest run` y reportar resultados (pass/fail, archivos cubiertos).
4. Si hay fallos, listarlos sin modificar código todavía — esperar instrucción para arreglar.

## Fuera de alcance
- Escribir tests nuevos.
- Arreglar fallos detectados (se reportan primero).
