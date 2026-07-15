## Diagnóstico (auditoría del módulo Profit)

Rastreé las 4 quejas hasta su origen en código. Los 4 son bugs reales o UX confusa, no percepción del usuario.

### Hallazgo 1 · Top deudores / acreedores se repiten — **BUG confirmado**

**Dónde:** `src/features/tesoreria/domain/resumen.ts:106-116`.
**Causa:** el ranking ordena **facturas individuales**, no clientes/proveedores. Si "ACME" tiene 3 facturas vencidas, "ACME" aparece 3 veces en el top 5, sacando a otros clientes del ranking.

```ts
// hoy
args.cobranza.filter(...).sort((a,b) => b.saldo - a.saldo).slice(0,5)
```

**Fix propuesto:** agrupar por `cliente_nombre` (deudores) y `proveedor_nombre` (acreedores) antes de ordenar. Sumar `saldo`, tomar el `dias` mayor del grupo (peor caso), y luego top 5.

**Analogía:** hoy la lista es "las 5 facturas más grandes vencidas". Debería ser "los 5 clientes que más deben en total".

---

### Hallazgo 2 · Estado de Resultados con ingresos repetidos — **BUG confirmado**

**Dónde:** `src/features/profit/domain/estadoResultados.ts:58-60`.
**Causa:** la clave que colapsa filas del pivot es `normalizeKey = trim + lowercase`. **No** normaliza acentos ni colapsa espacios internos. Por eso conceptos como:

- `"Flete Marítimo"` vs `"Flete Maritimo"` (sin acento)
- `"THC "` vs `"THC  "` (doble espacio)
- `"Handling"` vs `"handling "` (ya lo agrupa) — este caso sí funciona.

...aparecen como filas distintas aunque son el mismo concepto.

**Fix propuesto:** endurecer `normalizeKey` con `.normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/\s+/g," ").trim().toLowerCase()`. Tests de regresión con acento/espacios/mayúsculas.

**Nota:** este mismo `normalizeKey` se usa para costos, así que el fix corrige también costos duplicados.

---

### Hallazgo 3 · Toggle "Embarques / Facturas" — **UX confusa, no bug**

**Dónde:** `src/features/profit/components/FuenteEerrToggle.tsx` + `hooks/useFuenteEerr.ts`.
**Qué hace hoy:**

- `Embarques` (default): construye el EERR sumando **conceptos_venta / conceptos_costo de embarques cuyo ETA cae en el mes**. Es la vista **operativa** — refleja lo que "se movió" ese mes, aunque no esté facturado todavía.
- `Facturas`: construye el EERR sumando **facturas emitidas (CxC) menos NC contra CxP del mes**. Es la vista **contable devengada** — refleja lo que oficialmente se emitió/registró.

Los dos números **no coinciden** — y no deben — porque miden cosas distintas. Un embarque con ETA en junio pero facturado en julio aparece en junio con "Embarques" y en julio con "Facturas".

**Problema actual:** el tooltip existe pero es minúsculo y en español técnico. El usuario no sabe cuándo usar cuál y siente que "los números cambian sin razón".

**Fix propuesto:**
1. Cambiar el tooltip por un `HoverCard` con explicación completa + ejemplo numérico.
2. Renombrar las etiquetas: `Operativa (por ETA)` / `Contable (facturas emitidas)`.
3. Mostrar debajo del toggle una leyenda persistente: "Viendo vista operativa: refleja embarques con ETA en …".
4. Persistir la preferencia por usuario (ya está en localStorage — verificar que el default en Dashboard sea el mismo que en EERR para que no cambien números al navegar).

---

### Hallazgo 4 · Utilidad operativa "no hace sentido" — **posible bug, requiere confirmación**

**Dónde:** `src/features/dashboardEjecutivo/components/BandaKPIs.tsx:100` + `services/alertas.ts:101`.
**Cómo se calcula hoy:** `utilidad = eerr.totalIngresos.total − eerr.totalCostos.total` con la fuente EERR activa (embarques o facturas).

**Sospechas concretas de por qué no cuadra al usuario:**

- **(a) Doble conteo entre modos:** un embarque con `modo` no incluido en `["Marítimo","Aéreo","Terrestre"]` (por ejemplo `"Multimodal"` o vacío) es filtrado en `pivotConceptosVenta` (línea 106), pero **sus ingresos aún cargan CxC/bancos** en el Dashboard. Resultado: ves ingresos altos en KPI "Ingresos del periodo" pero utilidad baja porque parte de los conceptos no sumaron. — **BUG**.
- **(b) Fuente inconsistente con CxC:** el KPI "Ingresos del periodo" viene del EERR (que puede ser "embarques"), pero "Cartera vencida" viene de facturas emitidas. Si el usuario compara ambos, no cuadran.
- **(c) Utilidad negativa por costos "adelantados":** conceptos_costo con embarques cuyo ETA cae en el mes pero cuyos ingresos aún no se registraron.

**Fix propuesto:**
1. Incluir en el pivot los modos no reconocidos como columna virtual "Otros" (no descartarlos silenciosamente).
2. Agregar tooltip al KPI "Utilidad operativa" explicando la fórmula y la fuente activa: "Ingresos − Costos operativos del mes según fuente Embarques".
3. Test de invariante: `Σ ingresos por modo === totalIngresos.total`, sin descartes silenciosos.

**Necesito confirmar contigo:** ¿al ver "utilidad operativa no hace sentido" fue una cifra puntual mala (negativa, muy chica, no coincide con ER), o es que no entiendes qué está midiendo?

---

## Alcance del fix (si apruebas)

Fase 1 · Bugs duros (bloquean confiar en Profit):
1. Deduplicar Top deudores/acreedores por cliente/proveedor (`resumen.ts` + tests).
2. Endurecer `normalizeKey` del EERR (acentos + espacios) (`estadoResultados.ts` + tests).
3. Columna "Otros" en el pivot de EERR para modos no listados (`estadoResultados.ts` + tests).

Fase 2 · UX del toggle:
4. HoverCard explicativo + etiquetas nuevas + leyenda persistente en Dashboard y EERR.
5. Tooltip explicativo en KPI "Utilidad operativa" con la fuente activa.

Fase 3 · Regresión:
6. Test de invariante ingresos por modo === total.
7. Actualizar `CHANGELOG.md` y bump `APP_VERSION` → `13.300.48`.

**Fuera de alcance:** no modifico rutas, permisos, ni schema. No toco la lógica devengada; solo la operativa donde hay bugs.

## Pregunta bloqueante

Antes de implementar, ¿confirmas la sospecha del Hallazgo 4? Si tienes un mes específico donde la utilidad se ve rara, dímelo y verifico en base de datos el desglose real antes de tocar código.
