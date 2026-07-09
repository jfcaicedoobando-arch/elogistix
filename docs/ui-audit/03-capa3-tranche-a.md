# Auditoría UI · Capa 3 — Tranche A (Inicio / Embarques / Cotizaciones)

> Revisión visual **ruta por ruta** a 1920×1080 (viewport real).
> Base: `v13.222.0` (post-Lote 2 + `ModoAltaTabs`).
> Screenshots en `docs/ui-audit/screenshots/{inicio,embarques,cotizaciones}.png`.

Legenda de prioridad: **HIGH** = rompe la cohesión percibida · **MED** = inconsistencia molesta · **LOW** = pulido.

---

## Ruta 1 · `/inicio` (Dashboard Principal)

### 1.1 · Glyph roto en el saludo — **HIGH**

`Buenos días □` — al final del H1 aparece un cuadrado vacío. Es un emoji que
no renderiza en el stack de fuentes del sistema (Inter no cubre emojis; no
hay fallback a Apple Color Emoji / Segoe UI Emoji porque el `font-family`
del H1 no lista emoji fonts). Efecto: parece un texto roto en la primera
pantalla que ve el usuario cada día.

**Fix propuesto**: dos opciones:
- **A** (recomendada): quitar el emoji del string y usar un icono lucide
  (`Sun` / `Sunset` / `Moon` según hora) con color y tamaño consistentes con
  el resto del dashboard.
- **B**: mantener el emoji pero añadir emoji-fonts al `font-family` del H1
  (o usar la clase utilitaria `font-emoji`). Menos elegante — depende del
  SO del usuario.

Archivo a inspeccionar: `src/features/dashboard/**` (componente que arma el
saludo "Buenos días / Buenas tardes / Buenas noches").

### 1.2 · Card "Arribos este mes" mezcla dos escalas tipográficas — **MED**

En una sola fila conviven:
- Números `25 / 7 / 18` en tamaño discreto (`text-lg`).
- `MXN 282K` en tamaño mayor (`text-xl` con tabular-nums).
- `5321%` en verde grande (`text-lg` bold).

Cuando esta card se compara con los KPI cards de `/cotizaciones` (números a
`text-3xl` en tarjetas grandes), la percepción es que **los KPIs de inicio
son de menor jerarquía**. La cifra `5321%` en la barra "Gastos fijos
cubiertos" además es probable bug de cálculo (fuera de scope UI, pero vale
la pena reportar aparte).

**Fix propuesto**: unificar los 4 valores a la misma clase tipográfica
(`text-2xl font-semibold tabular-nums`) y anclar los labels arriba con
`text-2xs uppercase tracking-wider text-muted-foreground` (mismo patrón que
`Kpi` de CxP en `DialogDetallePagosProveedor.parts.tsx`).

### 1.3 · Chevrones inconsistentes entre "Alertas de Demora" y "Próximos Arribos" — **MED**

Ambas cards están lado a lado con la misma estructura (badge · texto ·
acción a la derecha), pero:
- **Alertas de Demora** → flecha `→` (ArrowRight) al final de cada fila.
- **Próximos Arribos** → icono de **anchor azul en círculo** al final de
  cada fila (parece botón, no es clickable independiente).

Ambos son "click a fila para ir al detalle". Deben usar la **misma
affordance**. Recomendación: `ArrowRight` en las dos cards y mover el
icono de anchor al lado izquierdo (como identificador de modo, no como
CTA), o simplemente quitarlo (el badge de días ya cumple esa función en la
otra card).

Archivos:
- `src/features/dashboard/components/AlertasDemoraCard.tsx`
- `src/features/dashboard/components/statusCards/ArribosCard.tsx`
  (componente hijo con las filas de próximos arribos).

### 1.4 · Barra "Gastos fijos cubiertos" sin contexto visual — **LOW**

La barra a la derecha (`5321%`) usa `bg-success` sólido sin `max-w` ni
segmentación. Si el valor supera 100 % debería o (a) cappearse a 100 % con
un tooltip explicando el excedente, o (b) rediseñarse como barra
segmentada tipo "1x cubierto / 53× cubierto". Fuera del alcance de la
auditoría visual, pero anotar como product decision.

---

## Ruta 2 · `/embarques`

### 2.1 · "Alertas activas" no siguen el patrón KPI del resto de la app — **HIGH**

En `/cotizaciones`, `/facturacion`, `/admin` y `/portal` las métricas
principales viven en **KPI cards** (fondo blanco, icono a la izquierda,
número `text-3xl`). En `/embarques` esas mismas 3 métricas
(`Demoras 9 · Garantías 0 · Cierre 18`) están **dentro de un banner
amarillo** con estilo "warning callout". Rompe la retícula de KPIs.

Efecto en 1920×1080: el usuario que viene de `/cotizaciones` ve 4 tarjetas
KPI arriba; llega a `/embarques` y no encuentra la retícula equivalente,
sino un bloque amarillo que grita "alerta" incluso cuando `Garantías = 0`.

**Fix propuesto**: promover las 3 métricas a KPI cards (`<KpiCard>` del
kit) con tono adaptativo:
- `Demoras` → tono `warning` si > 0, `default` si = 0.
- `Garantías atoradas` → tono `danger` si > 0, **ocultar** o `default` si = 0.
- `Cierre administrativo` → tono `warning` si > 5, `default` si menor.

Archivo: `src/features/embarques/**` (componente que renderiza el banner
"Alertas activas 27").

### 2.2 · "Garantías atoradas 0" se muestra aunque el valor sea 0 — **MED**

En el banner mostrado en 2.1, la sub-card "Garantías atoradas" con `0`
casos aparece igual de prominente que "Demoras 9" y "Cierre 18". Regla
general del dashboard: **no mostrar contadores en 0** salvo que sean
métricas críticas. Sub-fix natural de 2.1.

### 2.3 · Header "Ordenado por Expediente ↓ · global" + "Quitar orden" — **LOW**

Barra sobre la tabla usa texto plano tipo botón (`Quitar orden` en link
azul). No sigue el patrón de las otras tablas (Clientes, Cotizaciones)
donde el orden se ve directamente en los encabezados de columna con las
flechas `↑↓`.

**Fix propuesto**: sacar la barra "Ordenado por · global" — la información
ya está en el encabezado de columna (`EXPEDIENTE ↓`). Si se conserva, usar
`<Button variant="ghost" size="sm">` con icono `X` para "Quitar orden" en
vez de link.

---

## Ruta 3 · `/cotizaciones`

### 3.1 · Consistencia excelente con el kit — sin hallazgos HIGH

Los 4 KPI cards (`43 · 34 · 0 · 79.1%`) usan el componente canónico, la
toolbar y la tabla siguen los patrones ya validados en la app. Esta ruta
es la **referencia visual** contra la que se debería alinear
`/embarques` (ver 2.1).

### 3.2 · Botones del header: jerarquía OK pero orden inverso al de embarques — **LOW**

- `/cotizaciones`: `Exportar CSV` (outline) · `Nueva Cotización` (primary) · `Nuevo Tarifario` (outline).
- `/embarques`: `Exportar CSV` (outline) · `Nuevo Embarque` (primary).

El botón secundario `Nuevo Tarifario` está **después** del primary. El
patrón shadcn recomienda: acciones secundarias a la izquierda, primary
al final (más cerca de la esquina superior derecha, alineado con Fitts's
law). Recomendación: mover `Nuevo Tarifario` **antes** de
`Nueva Cotización` para que el CTA principal quede pegado al borde derecho.

Archivo: `src/features/cotizaciones/**` (header de la lista).

### 3.3 · "Vence …" bajo el badge de estado — **LOW**

Bajo `Aceptada` aparece `Vence 10/07/2026` en `text-xs
text-muted-foreground`. Es información útil pero rompe la altura de fila
respecto a `/embarques` (~44 px vs ~62 px aquí). Aceptable dado el peso
informativo, pero considerar mostrar `Vence …` **solo cuando faltan ≤ 7
días** para reducir densidad visual en las filas con vencimiento lejano.

---

## Inconsistencias transversales detectadas en Tranche A

| # | Categoría | Descripción | Prioridad |
|---|---|---|---|
| T.1 | Densidad de filas | `/embarques` 44 px vs `/cotizaciones` 62 px vs `/inicio` (cards) — no hay regla explícita | MED |
| T.2 | Jerarquía de KPIs | `/inicio` usa números pequeños dentro de una card compuesta; `/cotizaciones` usa 4 KPI cards grandes; `/embarques` no tiene retícula de KPIs | HIGH (ver 2.1) |
| T.3 | Chevrones/CTAs en filas de card | Mezcla de `ArrowRight` y iconos temáticos como acción — pendiente de unificar | MED (ver 1.3) |
| T.4 | Orden de botones en el header | Primary no siempre está pegado a la esquina derecha | LOW (ver 3.2) |

---

## Resumen priorizado para el Lote 3

**Bloque 3a · Fixes HIGH del Tranche A (2 archivos, ~15 líneas):**
1. **1.1** — Reemplazar el emoji roto del saludo por icono lucide.
2. **2.1 / 2.2** — Convertir el banner "Alertas activas" de `/embarques` en
   una retícula de KPI cards con tono adaptativo y ocultar contadores en 0.

**Bloque 3b · Fixes MED (2 archivos, ~10 líneas):**
3. **1.2** — Homogeneizar tipografía de "Arribos este mes" a la escala KPI.
4. **1.3** — Unificar chevrones a `ArrowRight` en cards del dashboard.

**Bloque 3c · Fixes LOW / pulido (3 archivos):**
5. **2.3** — Rediseñar la barra "Ordenado por · global" o eliminarla.
6. **3.2** — Reordenar botones del header de `/cotizaciones`.
7. **3.3** — Condicionar "Vence …" a próximos vencimientos.

**Fuera de scope UI (requieren decisión de producto):**
- `5321%` en la barra de gastos cubiertos (1.4) — probable bug de cálculo.

---

## Siguiente tranche

**Tranche B** cubrirá `/facturacion`, `/cxp`, `/por-capturar` — módulos que
en el reporte de Capa 2 destacaron por tener patrones únicos (barra
fiscal, KPIs con tooltips, agrupación de tabs).

**Tranche C** cubrirá `/clientes`, `/proveedores`, `/agentes`,
`/navieras` — módulos de catálogos, donde ya se detectó buena consistencia
en Capa 1.

**Tranche D** cubrirá el portal cliente y el portal agente para verificar
que el ajuste de `max-w-screen-2xl` del Lote 1 se comporta correctamente
en 1920p con datos reales.

---

_Última actualización: v13.222.0_
