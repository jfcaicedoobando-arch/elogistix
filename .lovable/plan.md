# Plan: Reducir tiempo de feedback en Lovable y peso de los audits de arquitectura

## Contexto

El proyecto tiene un pipeline CI muy robusto pero con muchos muros:

- 1,222 archivos de test.
- CI con 8 jobs paralelos, tests en 10 shards, build de producción, Edge Functions (Deno) y 15 scripts de auditoría propios (~2,189 líneas de scripts).
- No hay hooks de git; los checks corren en GitHub Actions.
- El usuario siente lentitud principalmente en **dos lados**:
  1. El preview de Lovable (HMR/dev server) tarda en reflejar cambios.
  2. Los **audits de arquitectura** se sienten lentos y/o molestos.

## Objetivo

Reducir el tiempo de feedback visual en Lovable y hacer que los audits de arquitectura aporten sin ralentizar innecesariamente el CI. **Sin agregar features nuevas**: es pulido puro.

## Pasos

### 1. Diagnóstico: saber dónde se gasta el tiempo

Antes de tocar nada, medir.

- Medir HMR en dev:
  - Editar un componente hoja vs. un componente compartido (ej. `src/components/ui/Button.tsx`).
  - Anotar cuánto tarda el navegador en recibir el update.
- Medir cada job de CI y, dentro del job `audits`, medir cada script individual.
- Medir build de producción en sandbox limpio (sin `dist/`, sin cachés de Vite).
- Entregable: lista de los 3 cuellos de botella con tiempos reales.

### 2. Optimizar el preview / HMR de Lovable

Una vez identificado el cuello:

- Revisar `vite.config.ts`:
  - `componentTagger()` en modo development: confirmar que no escanea todo el árbol en cada cambio.
  - Verificar `optimizeDeps` para pre-bundlear dependencias pesadas.
  - Verificar `server.watch.ignored` para evitar que Vite vigile miles de archivos innecesarios.
- Revisar imports y estructura:
  - Detectar "barrel files" masivos o imports circulares que invaliden caché de HMR.
  - Asegurar lazy loading de rutas pesadas (PDF, charts, recharts, etc.).
- Si un cambio en un componente UI fuerza rebuild de muchas rutas, aplicar división.

### 3. Optimizar los audits de arquitectura

Actualmente hay 15 scripts de auditoría corriendo en el job `audits`. Propuesta:

- Clasificar cada audit en:
  - **Blocking** (debe fallar CI: seguridad, RLS, migraciones críticas).
  - **Advisory** (puede ser warning en PR y bloquear en `main`).
- Implementar path filtering por audit: si un PR no tocó `supabase/**`, no correr `audit-migrations`, `audit-rpc-sync`, `audit-schema-columns`, etc.
- Cachear resultados de audits cuyas entradas no cambien (hash de archivos relevante).
- Fusionar audits pequeños y redundantes para reducir overhead de arranque de `tsx`.
- Separar audits pesados en un job opcional en PR pero obligatorio en merge a `main`.

### 4. Mejorar el loop local antes de pushear

- El script `ci:fast` ya existe. Asegurar que sea el default recomendado.
- Evaluar agregar un modo `ci:ultra-fast` que corra solo:
  - lint de archivos modificados,
  - typecheck incremental,
  - tests afectados por el diff (con `--changed`).
- Documentar claramente cuándo usar cada modo.

### 5. Validación

- Re-correr benchmarks del paso 1 y comparar.
- Verificar que coverage thresholds, lint y los audits críticos siguen pasando.
- Asegurar que los cambios no rompan el build de producción ni el deploy.

## Qué NO se hará

- No se eliminarán tests solo para acelerar.
- No se bajarán umbrales de cobertura.
- No se agregarán features nuevas.
- No se desactivarán audits de seguridad o integridad.

## Métrica de éxito

- El preview de Lovable refleja cambios simples en menos de 3 segundos (meta a validar tras diagnóstico).
- Los audits de arquitectura no ejecutan todo el set cuando un PR no los toca.
- El tiempo de wall-clock de CI para cambios pequeños baja sin sacrificar calidad.
