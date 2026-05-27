# Versión 11.68.0 — Cx fase 1: reducir complejidad de los 2 peores ofensores

## Contexto

`Cx` ha estado pendiente desde la auditoría inicial: la regla `complexity` de ESLint está en `max: 15` (la deuda anota que bajarla a 12 destapa 13 warnings en `src/` + 6 en edge functions). En vez de bajar el umbral de golpe, atacamos los 2 ofensores más altos y dejamos el resto en backlog escalonado.

Ranking actual (con `max: 12`):

| CC | Archivo:línea | Función |
|----|---------------|---------|
| **20** | `src/lib/crm/nextBestActions.ts:74` | `computeNextBestActions` |
| **18** | `src/lib/csv/leadsCsv.ts:74` | arrow interna de `mapLeadCsvRows` |
| 15 (×11) | varios | siguiente tier |
| 14 (×N) | varios | tier inferior |

Atacamos sólo los dos primeros: son los outliers (≥ +6 sobre el umbral objetivo) y ambos son funciones puras con tests existentes (`nextBestActions.test.ts`, `leadsCsv.test.ts`), riesgo mínimo.

## Alcance

### 1. `computeNextBestActions` (CC 20 → ≤ 8)

5 bloques de reglas independientes. Extraer 5 helpers puros en el mismo archivo (no necesita carpeta nueva):

- `nbaLeadsSinContactar(leads, nowMs): NbaItem[]`
- `nbaCotSinRespuesta(cotizaciones): NbaItem[]`
- `nbaCierreProximo(oportunidades, nowMs): NbaItem[]`
- `nbaSinActividad(oportunidades, yaIncluidos, nowMs): NbaItem[]`
- `nbaActividadesVencidas(actividades, nowMs): NbaItem[]`

`computeNextBestActions` queda como composición:

```ts
export function computeNextBestActions(input: NbaInput, limit = 5): NbaItem[] {
  const nowMs = (input.now ?? new Date()).getTime();
  const cierre = nbaCierreProximo(input.oportunidadesAbiertas, nowMs);
  const yaIncluidos = new Set(cierre.map(i => i.id.split(":")[1]));
  return [
    ...nbaLeadsSinContactar(input.leadsSinContactar, nowMs),
    ...nbaCotSinRespuesta(input.cotizacionesSinRespuesta),
    ...cierre,
    ...nbaSinActividad(input.oportunidadesAbiertas, yaIncluidos, nowMs),
    ...nbaActividadesVencidas(input.actividadesVencidas, nowMs),
  ].sort((a, b) => b.score - a.score).slice(0, limit);
}
```

CC de la nueva función ≈ 3. Cada helper CC ≤ 6.

### 2. arrow de `mapLeadCsvRows` (CC 18 → ≤ 6)

La complejidad vive en el `colMap.forEach((field, i) => { ...switch... })`. Extraer una función `assignLeadField(row, field, val)` pura que contiene el switch + las validaciones de `score`/`fuente`/`estado`. La arrow se reduce a:

```ts
colMap.forEach((field, i) => {
  if (!field) return;
  assignLeadField(r, field, (cols[i] ?? "").trim());
});
```

`assignLeadField` queda con CC ≈ 10 (dentro del umbral 12) — único cuerpo con todas las ramas.

### 3. Tests

No se añaden tests nuevos: los existentes (`nextBestActions.test.ts`, `leadsCsv.test.ts`) garantizan equivalencia funcional. Se ejecuta la suite completa y se confirma 770/770.

### 4. Verificación de complejidad

Ejecutar `bunx eslint "src/**/*.{ts,tsx}" --rule '{"complexity":["warn",{"max":12}]}'` y confirmar que:
- `computeNextBestActions` desaparece del ranking.
- arrow de `mapLeadCsvRows` desaparece del ranking.
- El nuevo tope queda en 15 (ya existente), no se introducen warnings nuevos.

### 5. Versión + changelog

- `src/constants/appVersion.ts` → `11.68.0`.
- `CHANGELOG.md`: entrada `[11.68.0]` con resumen Cx fase 1.
- `.lovable/plan.md`: añadir fila Cx con progreso 2/13 y siguiente tier (CC 15).

## Fuera de alcance

- **No** se baja el umbral de ESLint en este corte (sigue en 15). Bajará cuando los 13 ofensores estén resueltos.
- **No** se tocan las 6 edge functions con complejidad alta — siguiente fase.
- **No** se refactorizan los 11 ofensores de CC 15 — fases siguientes (probablemente 3 por versión).
- **No** se introducen abstracciones nuevas (no strategy pattern, no clases) — sólo extract-function.

## Verificación

- `bunx vitest run` (770/770).
- `bunx eslint` sin warnings nuevos.
- `audit-report` y `architecture-baseline` siguen verdes (0 oversized — los nuevos helpers no inflan archivos sobre 200 líneas).

## Entregables

- 2 archivos editados (`nextBestActions.ts`, `leadsCsv.ts`) con extract-function.
- `appVersion.ts`, `CHANGELOG.md`, `.lovable/plan.md` actualizados.
