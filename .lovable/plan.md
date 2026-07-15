# Auditoría Fase I + Fase J (Presupuesto vs Real)

## Auditoría Fase I — resultado

Revisé los archivos de la fase anterior (`useFuenteEerr`, `FuenteEerrToggle`, `alertas.ts`, `agregador.ts`, `BandaKPIs.tsx`) y los 48 tests. No detecté bugs funcionales. Dos observaciones menores que se resuelven en un solo commit corto antes de arrancar J:

1. `buildUtilidadDelta` cuando `margen_delta_puntos === 0` imprime `+0.0pp vs mes anterior`, ruido visual. Umbral: usar "sin variación" cuando `|Δ| < 0.05pp`.
2. `formatDelta` (ingresos) devuelve "Sin cambio" con `pct === 0`, pero también cuando el mes previo es 0 (delta calculado como 0). Añadir campo `ingresos_delta_pct: number | null` para paralelismo con utilidad — ya modelamos "sin comparable" como `null`, hay que aplicarlo también al primer KPI.

## Fase J — Alertas de sobreejercicio presupuestal + drilldown

**Motivación (usuario final):** hoy la card "Cumplim. presupuesto" del Dashboard muestra un solo % agregado. Si el total va en 95% pero **una categoría** está al 300% (ej. viajes disparados), el usuario no lo ve hasta abrir la página Presupuesto → tab Vs Real → escanear la tabla. Además, la tabla de Vs Real no tiene ordenamiento ni resalta las filas críticas.

### Alcance

1. **Nuevas KPIs derivadas** (`presupuesto/services/vsReal`): `categorias_en_exceso` (count con `cumplimiento_pct > 110`) y `top_exceso` (top 5 filas ordenadas por variación absoluta positiva).
2. **KpiDrilldownSheet reutilizable** para presupuesto: nueva variante que muestra categorías con barra de progreso (verde ≤100, ámbar 100–110, rojo >110). Reutilizamos el sheet existente extendiéndolo con `renderItem` opcional.
3. **BandaKPIs**: la card "Cumplim. presupuesto" ahora abre el sheet con top categorías en exceso (antes navegaba directo a `/profit/presupuesto`). Delta adicional: `N categoría(s) en exceso` cuando aplique.
4. **TabVsReal**: (a) ordenamiento por columnas (variación asc/desc, % cumplimiento), (b) barra de progreso inline por fila para "% cumplimiento", (c) badge "Excede" en filas con `cumplimiento > 110`, (d) filtro rápido "Sólo excesos".
5. **Alerta ejecutiva**: extender `calcularAlertas` con regla `presupuesto-exceso-categoria` (severidad: warning cuando ≥1 categoría >110%, danger cuando ≥3 o alguna >200%). Se une al banner de alertas ya existente en el Dashboard.

### Fuera de alcance

- Exportar Excel/CSV del comparativo (Fase K candidata).
- Comparación multi-mes de presupuesto (Fase K candidata).
- Reordenar categorías en Captura (no es UX crítico).

### Detalles técnicos

- `src/features/presupuesto/services/vsReal.ts`: extender `PresupuestoVsRealResumen` con `categorias_en_exceso: number` y `top_exceso: PresupuestoVsRealFila[]` (top 5, ordenado por `variacion_mxn` desc, filtrando `presupuesto > 0`).
- `src/features/dashboardEjecutivo/services/alertas.ts`: nueva alerta `presupuesto-exceso-categoria`; agrega a la lista solo si `resumen.categorias_en_exceso >= 1`.
- `src/features/dashboardEjecutivo/services/types.ts`: agregar `categoriasExcedidas?: PresupuestoVsRealFila[]` en el snapshot para el drilldown.
- `src/components/profit/BudgetOverrunSheet.tsx` (nuevo, <150 líneas): sheet especializado. Barra de progreso: `<div className="h-2 rounded bg-muted"><div style={...}` **no permitido** por regla de no inline styles → usar `Progress` de shadcn con `value` clamped a 100 y badge separado para el exceso real.
- `src/features/presupuesto/components/TabVsReal.tsx`: refactor para bajar a <200 líneas si crece. Añadir `useState` con `sortKey/sortDir/soloExcesos`. Column headers clickables con ícono `ChevronUp/Down`.
- Tests nuevos (mínimos):
  - `vsReal.test.ts`: `top_exceso` ordena por variación desc y filtra sin-presupuesto; `categorias_en_exceso` respeta umbral 110%.
  - `alertas.test.ts`: alerta `presupuesto-exceso-categoria` con severidad warning/danger según reglas.
  - `BudgetOverrunSheet.test.tsx`: render de barra + badge de exceso.
  - `TabVsReal.test.tsx`: sort por variación desc, filtro "solo excesos" oculta filas ≤110%.

```text
Dashboard Ejecutivo
  BandaKPIs
   └─ [Cumplim. presupuesto] ── click ──► BudgetOverrunSheet
                                            ├─ top 5 categorías (barra + badge exceso)
                                            └─ "Ver presupuesto completo" → /profit/presupuesto?periodo_vs_real=YYYY-MM
  Alertas (banner existente)
   └─ nueva regla presupuesto-exceso-categoria
```

### Version y CHANGELOG
- `APP_VERSION` → `13.300.39`.
- `CHANGELOG.md`: entrada `[13.300.39]` con los dos bloques (fix Fase I: ruido en deltas, feat Fase J: alertas presupuesto).
