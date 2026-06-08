## Objetivo
Normalizar a UTC todas las operaciones de fecha en `src/features/auditoria/domain/core.ts` para que las reglas de snooze y los umbrales temporales sean idénticos sin importar el offset local del navegador/servidor (CDMX, demo en otra zona, runners de CI en UTC).

## Diagnóstico
- `isoDate()` ya usa `toISOString().slice(0,10)` → **UTC**, pero el JSDoc miente diciendo "horario local". 
- `minSnoozeDate()` usa `new Date(from).setDate(getDate()+1)` → **local**. Esto causa inconsistencia: en zonas con offset negativo (ej. `America/Mexico_City`, UTC-6), un `from` con hora UTC `2026-05-14T02:00:00Z` se interpreta local como `2026-05-13 20:00`, `+1` día local da `2026-05-14 20:00` → `toISOString()` arroja `2026-05-15`… o `2026-05-14` dependiendo de la hora exacta. Los tests pasan por casualidad porque usan `T10:00:00Z` (suficientemente lejos del límite).

## Cambios

### 1. `src/features/auditoria/domain/core.ts`
- **`isoDate(date)`**: mantener `toISOString().slice(0,10)` pero corregir JSDoc → "YYYY-MM-DD en UTC".
- **`minSnoozeDate(from)`**: reemplazar `setDate(getDate()+1)` por aritmética UTC pura — usar `Date.UTC(getUTCFullYear, getUTCMonth, getUTCDate+1)` para construir el día siguiente sin tocar el offset local. Garantiza rollover de mes/año correcto.
- **`isSnoozeActivo(snoozedUntil, today)`**: sin cambio funcional (comparación lexicográfica de YYYY-MM-DD), pero documentar explícitamente que ambos argumentos deben estar en UTC (producidos por `isoDate`).
- Añadir helper interno `todayUtcIso()` que centralice `isoDate(new Date())` para que futuros umbrales (proforma_vencida, demurrage, etc.) tengan un punto único.
- JSDoc al inicio del módulo: nota explícita "Todas las funciones temporales operan en UTC para evitar drift por zona horaria del runtime".

### 2. Tests — `src/features/auditoria/domain/__tests__/core.test.ts`
Añadir casos de **borde de zona horaria** que hoy producirían resultados distintos según el offset local:
- `minSnoozeDate(new Date("2026-05-14T23:30:00Z"))` → `"2026-05-15"` (en CDMX local serían 17:30 del 14 → +1 día local daría 15 también; usar `T02:30:00Z` para forzar discrepancia: en CDMX local serían las 20:30 del día 13).
- `minSnoozeDate(new Date("2026-05-14T02:00:00Z"))` → `"2026-05-15"` (caso que con `setDate` local en UTC-6 devolvería `"2026-05-14"`).
- `minSnoozeDate(new Date("2026-12-31T23:00:00Z"))` → `"2027-01-01"` (rollover año en UTC).
- `isoDate(new Date("2026-05-14T23:59:59Z"))` → `"2026-05-14"` (verifica UTC, no local).

### 3. Versionado
- `src/constants/appVersion.ts` → `12.61.4`.
- `CHANGELOG.md`: entrada `## [12.61.4] - 2026-06-08` describiendo la normalización UTC y los casos cubiertos.

## Notas técnicas
- No se modifican firmas públicas ni el shape de retorno.
- Las operaciones de comparación string YYYY-MM-DD son seguras porque ambos lados se producen por `isoDate` (UTC).
- Se deja explícito en JSDoc para que futuras reglas (proforma_vencida, ETA buffer) reutilicen el mismo contrato y no introduzcan `Date#setDate` ni `getDate` locales.
