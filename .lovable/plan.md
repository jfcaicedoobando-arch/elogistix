# Auditoría final — estilos hardcodeados restantes

## Resultado del barrido (`rg` en `src/`)

Excluidos (aceptados como intencionales): `src/features/marketing/**` (landing) y `src/components/ui/badge.tsx` (comentarios).

### Hallazgos fuera de exclusiones (3 archivos, 8 ocurrencias)

**`src/lib/ui/estadoConfig.ts`** — estado "Entregado" y borde "Arribo":
- L68: `borderLeft: "border-l-amber-500"` → `border-l-warning`
- L97: `badge: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"` → tokens `success`
- L98: `borderLeft: "border-l-emerald-500"` → `border-l-success`
- L99: `bar: "bg-emerald-500"` → `bg-success`
- L101: `gradient: "from-emerald-500 to-emerald-500/80"` → `from-success to-success/80`
- L102: `border: "border-emerald-500"` → `border-success`
- L103: `text: "text-emerald-600"` → `text-success`

**`src/lib/ui/uiMappings.ts`** — modo Terrestre:
- L38: `"bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"` → equivalente con tokens `warning` (`bg-warning/15 text-warning dark:bg-warning/20`).

**`src/lib/ui/__tests__/uiMappings.test.ts`** — no aparece en grep, pero contiene aserciones sobre estas clases; puede requerir ajuste tras el fix (revisar tras cambio).

### Ocurrencias intencionalmente excluidas
- `src/features/marketing/routes/LogoPreview.tsx` (1) y `LandingHero.tsx` (4): `text-[10px]` en piezas de marketing/hero.

## Entregable
1. Generar `/mnt/documents/audit-styles-2026-07-03.md` con el listado anterior (archivo + línea + fix propuesto).
2. **Opcional (si lo apruebas):** aplicar los fixes en `estadoConfig.ts` y `uiMappings.ts`, actualizar `uiMappings.test.ts` si rompe, bump versión `13.159.1` y CHANGELOG.

Confirma si además del reporte quieres que aplique los fixes.
