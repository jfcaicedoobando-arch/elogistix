

## Plan: Cambiar "Creadas" a ETD en la gráfica de tendencia

### Cambios en `src/hooks/useOperacionesData.ts`

**Líneas 170-174** — Cambiar la fecha usada para "esteMes" de `created_at` a `etd ?? created_at`:
```typescript
const fechaOperacion = e.etd ? new Date(e.etd + "T00:00:00") : new Date(e.created_at);
if (isWithinInterval(fechaOperacion, { start: inicioMes, end: finMes })) {
  d.esteMes++;
}
```

**Líneas 190-195** — Cambiar histórico de creados para usar ETD como fecha:
```typescript
// Histórico por ETD
meses6.forEach((m) => {
  if (isWithinInterval(fechaOperacion, { start: m.inicio, end: m.fin })) {
    d.creadosPorMes[m.label]++;
  }
});
```

Nota: la variable `fechaOperacion` se calcula una sola vez arriba y se reutiliza en ambos bloques.

### Cambios en `src/pages/Operaciones.tsx`

Renombrar etiquetas en 3 lugares:
1. **Línea 143**: KPI card `"Creadas este mes"` → `"ETD este mes"`
2. **Línea 295**: Mini KPI en tendencia `"Creadas este mes"` → `"ETD este mes"`
3. **Línea 320**: `name="Creadas"` → `name="Por ETD"` en el Line del chart
4. **Línea 229**: `"Cargas creadas (6 meses)"` → `"Cargas por ETD (6 meses)"`
5. **Línea 344**: `"Balance creadas/llegadas"` → `"Balance ETD/llegadas"`

