
## Pregunta concreta

¿Es bueno el umbral `functions: 30 / branches: 34` que acabo de dejar en `vitest.config.ts`?

**Respuesta corta: no es "bueno" en términos absolutos — es un piso defensivo, no un objetivo.**

## Qué dice la documentación de Vitest

La doc oficial (`vitest.dev/config/coverage` y `vitest.dev/guide/coverage`) **no recomienda un número específico**. Solo describe cómo configurar `coverage.thresholds.{lines,statements,functions,branches}` y la opción `autoUpdate` para que Vitest suba el umbral automáticamente cuando el real lo supere. La decisión del valor es del proyecto.

La industria suele citar:
- **70–80%** como "saludable" para apps de negocio.
- **>90%** para librerías críticas.
- **<50%** se considera bajo y normalmente significa lógica no probada.

Nuestros **lines 43% / statements 43%** ya están en el rango "bajo pero defendible para una app interna". Pero **functions 32% / branches 37%** son francamente bajos.

## Por qué bajaron de 56%→32% y 73%→37%

Vitest 4.0 (release del 2025-10-22, PR #8064 "feat!(coverage): v8 to support only AST based remapping") es un **breaking change** en cómo `@vitest/coverage-v8` cuenta funciones y branches:

- Antes (v2/v3): contaba sólo lo que V8 reportaba "ejecutable".
- Ahora (v4): hace **AST-aware remapping**, lo que cuenta cada arrow function, callback, ternario, optional chaining y short-circuit como entidades separadas.

El denominador crece. El numerador (lo cubierto) crece menos. Por eso functions/branches caen sin que cambiara una sola línea de tests. Lines/statements casi no se afectan (incluso subió).

Esto **no es un bug ni una mala práctica nuestra**: es la nueva métrica, y todos los proyectos que actualicen a v4 ven el mismo salto.

## Por qué dejar `30 / 34` no es la mejor decisión a largo plazo

1. **Comunica "no nos importa probar"** a cualquier dev nuevo o auditoría externa, aunque la realidad sea otra.
2. **El ratchet pierde fuerza**: si el piso está muy lejos del real, una regresión real de −5 puntos no la detecta nadie.
3. **Tu memoria `mem://principles/coverage-threshold` ya marca la regla** "subir cuando real ≥ umbral + 2 pts". Quedarse en 30/34 cuando el real es 32/37 cumple la letra pero no el espíritu.

## Opciones para decidir hoy

### Opción A — Aceptar la recalibración tal cual (lo que ya hice)
`functions 30 / branches 34 / lines 38 / statements 38`. CI verde inmediatamente. Riesgo: comunica un piso muy bajo y el ratchet se vuelve simbólico.

### Opción B — Recalibración mínima + plan de ratchet trimestral (recomendada)
Mismo piso de hoy (30/34) **pero con un objetivo escrito** en el comentario y en `mem://principles/coverage-threshold`:
- Meta a 3 meses: `functions 45 / branches 50`.
- Meta a 6 meses: `functions 55 / branches 60`.
- Cada PR significativo en módulos de negocio (CXP, facturación, embarques, cotización) debe agregar tests dirigidos.
- Habilitar `coverage.thresholds.autoUpdate: true` en local (no en CI) para que `vitest run --coverage` proponga subir el piso cuando el real supere por 2 pts.

### Opción C — Recalibración asimétrica
Mantener lines/statements en 38 (los reales ya pasan holgadamente), subir functions a 32 y branches a 36 (justo en el filo, sin margen). Funciona como detector de regresión inmediata pero genera CI flaky si una sola PR mueve la métrica 1 punto.

### Opción D — Volver a los pisos viejos (52/72) y empujar tests
Inviable hoy: el delta es de 20+ puntos, no se cierra escribiendo tests en una sesión. Implicaría 2–4 semanas dedicadas casi sólo a tests.

## Recomendación

**Opción B**. Es honesta con la realidad (la herramienta cambió), pero deja escrito un compromiso para no quedarnos en 30/34 indefinidamente.

## Cambios que ejecutaría si apruebas la Opción B

1. `vitest.config.ts` — añadir bloque comentado con "Meta Q3 2026: functions 45 / branches 50. Meta Q1 2027: functions 55 / branches 60." y dejar los umbrales en 30/34.
2. `mem://principles/coverage-threshold` — añadir la roadmap de metas trimestrales como sección "Plan de ratchet post-v4".
3. `CHANGELOG.md` (13.141.4) — nota corta documentando la roadmap acordada.
4. Sin tocar tests ni código de prod en este paso.

## Si prefieres la Opción C o D, dime cuál y reescribo el plan.
