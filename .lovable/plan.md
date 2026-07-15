## Auditoría de Fase H (Unificación fuente EERR)

Revisé los 9 archivos tocados. Todos los tests actuales pasan (29/29). Hallazgos:

### Bugs y observaciones

1. **[Menor] Robustez de `useFuenteEerr.setFuente`**  
   Si un listener del evento `lc:eerr-fuente-change` lanza synchronously, `dispatchEvent` propaga la excepción y `setFuente` truena. El test `"no crashea si dispatchEvent falla"` en realidad **asserta que sí truena** — descripción y aserción no coinciden.
   
2. **[Consistencia UI] Doble UI para la misma preferencia**  
   El Dashboard usa `ToggleGroup` (Embarques/Facturas), pero la página EERR sigue usando un `Select` con etiquetas distintas ("Operativa (por ETA del embarque)" vs "Devengada (facturas + CxP)"). Confunde al usuario: son la misma preferencia con dos UIs.

3. **[Consistencia periodo] `useEstadoResultados` no usa `usePeriodoMesUrl`**  
   Mantiene su propio `useState` + `useSearchParams` para `?mes=`. Duplica lógica que ya fue centralizada en Batch B. Bajo riesgo pero se puede alinear.

4. **[Coverage gap]**  
   Falta un test de integración que verifique que cambiar la fuente en un consumidor (ej. Dashboard) refleja en el otro (EERR) — hoy sólo probamos cross-instance con `renderHook`.

### Fase I — Relevancia de negocio + polish UI

Además de cerrar los hallazgos arriba, entro a **Fase I: relevancia** con dos entregables de negocio pedidos por la auditoría original:

- **Comparativo periodo vs. anterior en KPIs** — hoy `calcularKPIsEjecutivos` recibe `ingresosMesAnterior` pero no expone `%Δ vs. mes anterior` en la banda. Sólo hay YTD.
- **Margen bruto y margen operativo separados en el Dashboard** — el KPI actual "Utilidad operativa" muestra el neto, pero no permite ver dónde se erosiona el margen. Añadir "Margen bruto %" al lado.

## Cambios propuestos

### Bloque 1 — Cierre de auditoría Fase H

1. `src/features/profit/hooks/useFuenteEerr.ts`
   - Envolver `window.dispatchEvent(...)` en `try/catch` con `reportCaughtError` (feature: `"profit"`, op: `"eerr_fuente_dispatch"`). El setter nunca truena por listeners.

2. `src/features/profit/hooks/__tests__/useFuenteEerr.test.ts`
   - Ajustar el test problemático: renombrarlo a `"no propaga excepciones de listeners"` y assertar que `setFuente` **no** truena y que `localStorage` sí quedó actualizado (persistencia gana sobre notificación).

3. `src/components/profit/FuenteEerrToggle.tsx` (nuevo)
   - Componente reutilizable `<FuenteEerrToggle />` que envuelve `ToggleGroup` + `useFuenteEerr`. Uso: `<FuenteEerrToggle aria-label="…" />`.
   - Test unitario: cambio de valor invoca `setFuente` y refleja la fuente activa.

4. `src/features/profit/routes/ProfitDashboardEjecutivo.tsx`
   - Reemplazar el `ToggleGroup` inline por `<FuenteEerrToggle />`.

5. `src/features/profit/routes/ProfitEstadoResultados.tsx`
   - Reemplazar el `<Select>` de fuente por `<FuenteEerrToggle />`.
   - Mover la etiqueta descriptiva ("Fuente devengada: …" / "Fuente operativa: …") a un `Tooltip` sobre el toggle o mantenerla como texto de apoyo debajo — decidir mientras se implementa (favor texto de apoyo para no perder contexto).

### Bloque 2 — Fase I (relevancia de negocio)

6. `src/features/dashboardEjecutivo/services/kpis.ts` (o `alertas.ts` donde vive `calcularKPIsEjecutivos`)
   - Añadir campos: `variacionIngresosPct` (vs. mes anterior), `margenBrutoPct`, `margenOperativoPct` derivados de `eerrPeriodo`.
   - Cuidado con divisiones por cero.

7. `src/features/dashboardEjecutivo/services/types.ts`
   - Extender `KPIsEjecutivos` con los tres nuevos campos.

8. `src/features/dashboardEjecutivo/components/BandaKPIs.tsx`
   - Añadir chip `%Δ vs. mes anterior` en el KPI de ingresos (verde/rojo).
   - Añadir KPI "Margen bruto %" como card independiente.

9. Tests nuevos:
   - `src/features/dashboardEjecutivo/services/__tests__/kpis.variaciones.test.ts` — casos: ingresos crecen, decrecen, mes anterior = 0 (evitar Infinity), margen bruto correcto.
   - `src/components/profit/__tests__/FuenteEerrToggle.test.tsx` — render + interacción.

### Bloque 3 — Housekeeping

10. Bump `APP_VERSION` a `13.300.38`.
11. Entrada en `CHANGELOG.md` describiendo cierre de auditoría H + Fase I.

## Notas técnicas

- **Sin cambios de esquema BD.** Todos los cálculos son en cliente sobre datos que ya se consultan.
- **`useEstadoResultados` migrar a `usePeriodoMesUrl`** lo dejo **fuera** de este plan — es refactor no funcional; lo agendaría a un batch posterior de code quality para evitar mezclar concerns.
- **Compatibilidad:** el `Select` viejo tenía etiquetas "Operativa"/"Devengada" — el `ToggleGroup` tiene "Embarques"/"Facturas". Es un cambio de wording visible al usuario. Añadir tooltips explicativos para no perder claridad.
- **Riesgo:** que un test snapshot antiguo dependa del texto "Operativa"/"Devengada" en la página EERR. Buscaré antes de tocar.

## Criterios de aceptación

- `bun run lint` y toda la suite (`bunx vitest run`) pasan.
- El toggle de fuente se ve **idéntico** en Dashboard y EERR.
- Cambiar la fuente en una pantalla se refleja al navegar a la otra sin recargar.
- El Dashboard muestra `%Δ ingresos vs. mes anterior` con color y `Margen bruto %` como KPI adicional.
- No hay `Infinity`/`NaN` en KPIs cuando el mes anterior es 0.
