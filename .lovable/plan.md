# Fase C — Vista Agrupada pulida

Objetivo: que la vista agrupada se lea como una tabla real (columnas alineadas entre grupos) y que la vigencia se entienda de un vistazo.

## Cambios visuales

1. **Header de columnas sticky por grupo**
  - Agregar una fila de encabezados ligera arriba de cada grupo expandido: `Agente · Naviera | Vigencia | Estado | Total USD | Acciones`.
  - Mismo `grid-template` que las filas (`grid-cols-[1fr_140px_160px_150px_auto]`) para que columnas y filas queden perfectamente alineadas.
  - Tipografía: `text-[11px] uppercase tracking-wide text-muted-foreground`, sin bordes pesados.
2. **Mini-barra de vigencia**
  - Reemplazar el texto plano "01/dic → 31/ene · vence en 12 d" por:
    - Línea 1: `01/dic → 31/ene` en `tabular-nums`.
    - Línea 2: barra de progreso de 60px (`h-1 rounded-full bg-muted`) con relleno proporcional al avance del periodo. Color: `bg-success` >7d, `bg-warning` ≤7d, `bg-destructive` vencida.
    - Tooltip con el texto exacto ("vence en 12 d").
  - Una sola lectura visual de "qué tan fresca está la tarifa".
3. **Header de grupo más informativo sin ruido**
  - Mantener el chip "Mejor USD X" + Trophy.
  - Añadir a la derecha del título un micro-meta: `3 vigentes · 1 por vencer` (sólo si hay >0 por vencer; warning sutil).
  - Conservar Chevron y contador `n tarifas`.
4. **Densidad y separadores**
  - Reducir `py` de filas a `py-2.5` y separadores `divide-y divide-border/60` en lugar de borders completos.
  - Hover unificado `hover:bg-muted/40`.

## Archivos a tocar

- `src/features/costeo/components/TarifasGroupedView.tsx`: añadir header de columnas, componente interno `VigenciaBar`, ajustar header de grupo y densidad. Mantener ≤200 líneas — si crece, extraer `VigenciaBar.tsx` y `GrupoHeader.tsx`.
- `src/constants/appVersion.ts`: bump a `13.135.52` (o siguiente disponible).
- `CHANGELOG.md`: entrada Fase C.

## Lo que NO se toca

- Vista Tabla (sigue intacta).
- Lógica de "Mejor" / cálculo de delta (ya hecho en Fase A).
- KPIs / filtros (Fase B).
- Queries, RPCs, servicios.

## Verificación

Tras implementar, capturar `/costeo/tarifas` con Playwright (viewport 1280×1800) y revisar:

- Columnas alineadas entre el header y todas las filas de cada grupo.
- Barra de vigencia con color correcto en una tarifa vigente y una próxima a vencer.
- Densidad cómoda sin sentir apretado.

¿Apruebo y procedo con Fase C tal cual? Si