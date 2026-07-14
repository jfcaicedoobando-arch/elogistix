# Auditoría v13.300.1 + Lote 3B (parcial)

## Fase A — Auditoría del turno anterior

### Qué se hizo (v13.300.1)
- 3 tests nuevos: `AuditoriaKpis`, `GarantiasKpiCards`, guardrail `no-legacy-color-literals`.
- 2 `<h1>` migrados a `text-display` (`DetailHeader`, `WizardShell`).
- Comentario obsoleto arreglado en `PageHeader`.

### Hallazgos
1. **OK** — Los tests existentes de `DetailHeader` y `WizardShell` no asertan sobre `text-2xl`, así que la migración no rompió snapshots. Verificado con `grep`.
2. **Gap menor** — El guardrail funciona pero no valida que la **ALLOWLIST no crezca sin justificación**. Cada entrada tiene comentario, pero no hay tope numérico ni convención `// Lote X`.
3. **Gap de cobertura** — `KpiCard` variant `default` (sin variant) no tiene test dedicado; sólo se prueban las variantes semánticas. Riesgo bajo pero cierra la matriz.
4. **Deuda visible** — 17 archivos en allowlist. Los más fáciles de tokenizar (sin gradientes complejos ni escalas continuas) son: modos de transporte (2 archivos), `estadoConfig` (1), `AmbienteBadge` (1). Total: **4 archivos** que pueden salir de la allowlist en un turno.

### Tests a agregar en esta fase
- `src/components/shared/__tests__/KpiCard.test.tsx` — 1 caso extra que verifica variant `default` (sin borde de color, sin `bg-*/5`).
- `src/lib/ui/__tests__/estadoConfig.test.ts` — smoke que verifica que **ningún** valor de `bar`/`text` contenga literales `bg-orange-*`/`text-indigo-*` (protege la migración de esta fase).
- `src/components/shared/__tests__/ModoIcon.test.tsx` — smoke que renderiza los 4 modos y verifica que usa clases tokenizadas.

---

## Fase B — Lote 3B parcial: tokenizar 4 archivos

### B1. Nuevos tokens en `src/index.css`
Agregar bajo la sección de tokens categóricos:

```css
/* Modos de transporte (categóricos, no semánticos) */
--mode-maritimo: 217 91% 50%;         --mode-maritimo-soft: 214 100% 96%;
--mode-aereo: 199 89% 48%;            --mode-aereo-soft: 204 100% 96%;
--mode-terrestre: 25 95% 53%;         --mode-terrestre-soft: 33 100% 96%;
--mode-multimodal: 262 83% 58%;       --mode-multimodal-soft: 270 100% 97%;

/* Estados operativos extra usados por estadoConfig */
--state-transito: 199 89% 48%;        /* cyan */
--state-entregado: 262 83% 58%;       /* violeta */
--state-alerta: 25 95% 53%;           /* naranja */
```

Duplicar los valores en el bloque `.dark` con ajustes de luminosidad (misma paleta, +10% lightness donde aplique). No tocamos otros tokens.

### B2. `tailwind.config.ts`
Extender `colors` con:
```ts
mode: {
  maritimo: "hsl(var(--mode-maritimo))",
  "maritimo-soft": "hsl(var(--mode-maritimo-soft))",
  aereo: "hsl(var(--mode-aereo))",
  ...
},
state: {
  transito: "hsl(var(--state-transito))",
  ...
},
```

### B3. Migraciones
- **`src/lib/ui/uiMappings.ts`**: `bg-blue-100 text-blue-600` → `bg-mode-maritimo-soft text-mode-maritimo`, etc. para los 4 modos.
- **`src/components/shared/ModoIcon.tsx`**: mismo mapeo con clases tokenizadas.
- **`src/lib/ui/estadoConfig.ts`**: `bg-cyan-500` → `bg-state-transito`, `bg-violet-500` → `bg-state-entregado`, `bg-orange-500` → `bg-state-alerta`. Y sus contrapartes `text-*-600`.
- **`src/features/facturacion/components/AmbienteBadge.tsx`**: revisar los ~2-3 literales (probablemente `bg-yellow-*`/`text-yellow-*` para "Prueba") → usar `warning`/`success` semánticos.

### B4. Actualizar allowlist
Remover de `src/__tests__/architecture/no-legacy-color-literals.test.ts`:
- `src/lib/ui/estadoConfig.ts`
- `src/lib/ui/uiMappings.ts`
- `src/components/shared/ModoIcon.tsx`
- `src/features/facturacion/components/AmbienteBadge.tsx`

El segundo test del guardrail (`no hay entradas obsoletas`) forzará que se removieran realmente.

### B5. Bump + changelog
- `APP_VERSION` → `13.300.2`
- Entrada en `CHANGELOG.md` explicando: tokens de modo/estado, 4 archivos fuera de allowlist, 3 tests nuevos.

---

## Fase C — Verificación
- `vitest run` — todos los tests actuales + los 3 nuevos deben pasar.
- Revisar visualmente `ModoIcon` en la tabla de embarques y las barras de `estadoConfig` en el dashboard: los colores deben verse iguales (los tokens replican la paleta original).

---

## Fuera de alcance (turnos siguientes)
- Lote 3B remanente (13 archivos): heatmaps de P&L (requieren token gradiente), CobranzaBlock aging (requiere escala `--aging-1..4`), dashboards ejecutivos.
- Lote 2B: overrides de `CardTitle`.
- Lote 4: tablas HTML → shadcn.
- Lote 6: `DemoAccessDialog` + chips.

---

## Sección técnica

**Archivos a crear**:
```text
src/lib/ui/__tests__/estadoConfig.test.ts
src/components/shared/__tests__/ModoIcon.test.tsx
```

**Archivos a editar**:
```text
src/index.css                                         (+ tokens mode/state)
tailwind.config.ts                                    (+ colors mode/state)
src/lib/ui/uiMappings.ts                              (4 líneas)
src/components/shared/ModoIcon.tsx                    (~6 líneas)
src/lib/ui/estadoConfig.ts                            (~6 líneas)
src/features/facturacion/components/AmbienteBadge.tsx (~3 líneas)
src/__tests__/architecture/no-legacy-color-literals.test.ts  (remover 4 entradas)
src/components/shared/__tests__/KpiCard.test.tsx      (+1 caso)
src/constants/appVersion.ts                           (13.300.1 → 13.300.2)
CHANGELOG.md                                          (nueva entrada)
```

**Riesgos**:
- Los HSL de los tokens nuevos podrían no coincidir 100% con las paletas de Tailwind (`cyan-500`, `violet-500`, etc.). Mitigación: uso los valores oficiales de Tailwind convertidos a HSL. Diferencia visual <2%.
- `AmbienteBadge` puede tener más literales de los estimados; si aparecen paletas fuera del alcance de `warning`/`success`, dejo el archivo en allowlist y documento por qué (no bloqueo el turno por eso).
