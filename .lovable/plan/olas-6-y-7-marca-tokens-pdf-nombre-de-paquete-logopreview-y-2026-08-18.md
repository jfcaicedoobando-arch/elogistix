# Olas 6 y 7 — Marca (tokens PDF, nombre de paquete, LogoPreview) y badge de carta garantía unificado

Verifiqué que los cuatro puntos siguen pendientes en el código actual.

## Ola 7 · N-UI-01 — Un solo `CartaGarantiaBadge`
Hoy existen dos componentes con el mismo nombre y el mismo propósito:
- `costeo/components/CartaGarantiaBadge.tsx`: badge sólido de una palabra ("Sin carta", "Carta vigente", "Por vencer", "Vencida"), recibe `{tieneCarta, vigenteHasta}`. Lo usan Costeo → Navieras y Portal del agente → Garantías.
- `cotizacion/components/CartaGarantiaBadge.tsx`: badge outline con iconos de escudo y texto informativo ("Vencida el … — se cobrará depósito"), recibe `{tarifa}`. Lo usan tres pantallas de cotización.

Analogía: son dos semáforos distintos en el mismo cruce; cuando alguien cambia uno, el otro queda mintiendo.

Plan: la variante informativa (outline + iconos) queda como **única** implementación, extendida para aceptar las dos formas de props (`{tarifa}` o `{tieneCarta, vigenteHasta, navieraNombre?}`), con export nombrado y default. El archivo de costeo pasa a ser un re-export, así que ningún import cambia.

Ajuste sobre lo propuesto en el documento: las fechas se formatean con el helper mexicano (`formatFechaSegura`, DD/MM/YYYY) en lugar de imprimir el ISO crudo — hoy el badge de cotización muestra "2026-07-01", que contradice el estándar de localización.

Cambio visible: en Costeo → Navieras y Portal del agente → Garantías el badge pasa de una palabra a texto informativo con icono y fecha.

No se mueve a `src/components/shared` (ownership de otro agente); queda como `TODO(shared)` documentado.

## Ola 6 · Marca
1. **Tokens del PDF alineados con la app.** `src/pdf/theme/tokens.ts` usa `#0F4C81` / `#2563EB`, pero la app define `--primary: 216 47% 20%` y `--accent: 221 83% 53%` (`src/index.css:19,28`), es decir `#1B2E4B` y `#2463EB`. Se corrigen `primary`, `accent` y el alias legacy `primaryDark`, con comentario que apunta a `src/index.css` como fuente de verdad. Los PDFs quedan con el mismo azul marino que la pantalla.
2. **`package.json`**: `"name": "vite_react_shadcn_ts"` → `"libre-carga"`. Sólo metadata; no afecta build ni dependencias.
3. **`LogoPreview.tsx`** (página interna de QA del logo): se reemplazan hex y clases crudas por tokens semánticos — `bg-white`→`bg-background`/`bg-card`, `text-[#0B1B3A]`→`text-foreground`, `bg-[#0B1B3A]`/`text-white`→`bg-primary`/`text-primary-foreground`, `bg-[#2563EB]`→`bg-accent`, `text-slate-*`→`text-muted-foreground`, `ring-[#2563EB]`→`ring-accent`, y el degradado se reescribe con `hsl(var(--primary))`/`hsl(var(--accent))`. Se quitan las menciones a hex en las etiquetas. El propósito (ver el logo sobre fondo claro, gris, oscuro, acento e imagen) se mantiene.

## Detalles técnicos
- Archivos: `src/features/cotizacion/components/CartaGarantiaBadge.tsx` (unificado), `src/features/costeo/components/CartaGarantiaBadge.tsx` (re-export), `src/pdf/theme/tokens.ts`, `package.json`, `src/features/marketing/routes/LogoPreview.tsx`.
- Props del componente unificado: unión discriminada tipada (sin `any`), derivando `tieneCarta` / `vigenteHasta` / `navieraNombre` de `TopTarifaRow` cuando llega `{tarifa}`.
- Tests: caso nuevo para el badge cubriendo los cuatro estados en ambas formas de props y el formato DD/MM/YYYY.
- Revisar tests/snapshots de PDF que asertan `#0F4C81` y ajustarlos al nuevo hex.
- Cierre: `APP_VERSION` a `13.669.0` + `CHANGELOG.md`, y correr lint, typecheck, `audit:arch`, `audit:tests` y los tests afectados (incluidos los de `src/pdf`).
