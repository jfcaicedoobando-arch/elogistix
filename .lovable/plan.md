# Continuación: Lotes B y C de la 2ª auditoría visual

Lote A ya quedó (v13.139.16). Sigo con los hallazgos medios y bajos.

## Lote B — Medio (v13.139.17)

5. **Bandejas (`/bandejas/facturacion-por-emitir`, `/bandejas/cartera`) — ¿tabs faltantes?**
   - Revisar los componentes de ruta. Si son bandejas mono-estado (todo lo que aparece es "pendiente de acción"), cerrar como falso positivo y documentarlo en CHANGELOG. No agregar tabs decorativos.

6. **`Badge` — variante `warning`**
   - `src/components/ui/badge.tsx`: confirmar que existe `warning` (ya verificado en lote A). Si los tokens `--warning` y `--warning-foreground` no están en `src/index.css`, agregarlos en la paleta semántica existente (amber-500 / foreground oscuro) sin tocar otros tokens.
   - No reemplazar usos existentes; sólo dejar la variante disponible.

7. **Embarques — altura 4725px (paginación)**
   - `src/features/embarques/routes/Embarques.tsx` + `useEmbarquesPageState`: validar que `pageSize` default sea 25/50 y que el selector de densidad/tamaño esté visible en la tabla. La tabla ya es server-side (`fetchEmbarquesPaginados`), así que probablemente sólo falta verificar que el default no haya quedado en 200+. Sin cambios de lógica.

8. **Cotizaciones — altura 3515px**
   - Mismo patrón que #7 sobre la ruta de cotizaciones.

## Lote C — Bajo + cierre (v13.139.18)

9. **Inicio — altura 2747px**
   - Revisar `src/features/dashboard` (o equivalente): confirmar `gap-6` entre secciones y que las Cards usen `p-6 shadow-sm`. Ajuste cosmético menor si hay aire muerto.

10. **Facturación — padding/margin (+98px vs estándar)**
    - Ya se ajustó el wrapper a `space-y-6` en lote A. Verificar visualmente con screenshot fresco y, si sigue desalineado, igualar exactamente al wrapper de `Embarques.tsx`.

## Validación

Después de cada lote:
- `bun run lint` sin warnings nuevos.
- Sub-agente Playwright re-captura las rutas tocadas a 1280×1800 y compara contra la baseline del lote anterior.
- Bump `APP_VERSION` y entrada en `CHANGELOG.md` con formato `## [X.Y.Z] - 2026-06-28`.

## Fuera de alcance

- Sin cambios de lógica de negocio, queries ni RLS.
- Sin migración de más rutas a `PageHeader`.
- Sin rediseños de componentes; sólo alineación a tokens y patrones existentes.
