# Plan — Auditoría v8.200.0 (P2.12 lote 4)

Continuamos bajando warnings ESLint de complejidad y `react-refresh`. Objetivo: pasar de 23 → ≤18 warnings sin tocar comportamiento.

## Alcance

1. **`src/generators/cotizacionPdf.ts` (complejidad 46)** — generador monolítico.
   - Extraer helpers puros a `src/generators/cotizacion/` (folder-style):
     - `headerSection.ts` — logo, encabezado, datos cliente.
     - `rutaSection.ts` — bloque ruta + mercancía.
     - `conceptosSection.ts` — tabla USD/MXN + totales.
     - `footerSection.ts` — notas, vigencia, términos.
   - `cotizacionPdf.ts` queda como orquestador <50 LOC.

2. **`src/components/embarque/StepDatosRuta.tsx`** (complejidad alta, ramas por modalidad).
   - Partir por modalidad: `StepDatosRutaMaritimo.tsx`, `StepDatosRutaAereo.tsx`, `StepDatosRutaTerrestre.tsx`.
   - `StepDatosRuta` se vuelve dispatcher delgado por `modalidad`.

3. **`src/components/embarque/TabResumen.tsx`** — extraer subsecciones:
   - `ResumenRutaCard`, `ResumenMercanciaCard`, `ResumenFinancieroCard`, `ResumenDocumentosCard`.
   - Mantener layout y estilos actuales.

4. **`src/components/operaciones/EmbarquesEstadoDialog.tsx`** — extraer:
   - Hook `useEmbarquesEstadoDialogData` con queries/filtros.
   - Subcomponente `EmbarquesEstadoTable`.

5. **`react-refresh/only-export-components` (11 warnings)** — separar constantes/helpers exportadas desde archivos de componente:
   - Mover constantes a `*.constants.ts` o al `constants/` correspondiente.
   - Mover helpers puros a `lib/` o `utils/`.

6. **Mantenimiento**:
   - Bump `APP_VERSION` → `8.200.0`.
   - Entrada en `changelogData.ts` + `v8/chunks/0.ts`, manteniendo `recentChangelog` en 10 (eliminar 8.189.0).
   - Correr suite completa (`vitest run`); meta: 369/369 verdes.

## Criterios de éxito

- ESLint warnings ≤ 18 (desde 23).
- 0 regresiones funcionales; tests verdes.
- Ningún archivo nuevo >200 LOC (Power of 10).
- Sin cambios en BD, RLS, ni en APIs públicas de hooks/services.

## Fuera de alcance

- `services/cotizacion/mutations.ts` y schemas zod para mappers (próximo sprint P1.7).
- E2E nuevos (queda en P3).
- Bajar thresholds de ESLint (espera a lote final).