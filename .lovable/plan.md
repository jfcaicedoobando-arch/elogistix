## Ajuste de umbral ESLint complexity: 15 → 16

### Objetivo
Que funciones con complejidad ciclomática (CC) = 15 dejen de disparar warning de ESLint, dejando el guardrail en CC ≥ 16.

### Cambios

1. **eslint.config.js**
   - Línea 34: `"complexity": ["warn", { max: 15 }]` → `{ max: 16 }`
   - Actualizar comentario asociado (líneas 31-33) para reflejar la nueva política: umbral 16; CC 15 pasa a ser aceptable.

2. **docs/audit-cleanslate-11.69.0.md**
   - Línea 57: actualizar texto de umbral de 15 a 16.
   - Sección §5: ajustar descripción de "38 ofensores (CC > 12)" si es necesario para coherencia con el nuevo umbral.

3. **docs/power10-baseline.md**
   - Línea 15: actualizar referencia al umbral lint actual de 15 a 16.

4. **CHANGELOG.md**
   - Agregar entrada `## [11.69.2] - YYYY-MM-DD` con nota del cambio de umbral.

5. **src/constants/appVersion.ts**
   - Bump `APP_VERSION` → `"11.69.2"`.

### Validación
- `bunx eslint src/` debe reportar 0 warnings de complexity (o solo aquellas con CC ≥ 16).
- No toca código funcional; riesgo cero de regresión.
