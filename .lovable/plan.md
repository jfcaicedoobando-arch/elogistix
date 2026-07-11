
# Auditoría de `lucide-react`

## Estado actual

| Métrica | Valor |
|---|---|
| Versión instalada | **0.462.0** (nov 2024) |
| Última en npm | **1.24.0** (jul 2026) |
| Archivos que importan lucide | **578** |
| Íconos únicos usados | **190** |
| Import statements totales | **582** |
| Uso de `DynamicIcon` / barrel dinámico | **0** (bien) |
| Imports desde `lucide-react/dist/...` | **0** (bien) |

## Diagnóstico

**Lo que ya está bien (top-of-the-line):**
- 100% named imports (`import { X } from 'lucide-react'`) → tree-shaking óptimo con Vite.
- Cero imports desde rutas internas (`/dist`), cero `import * as`.
- Cero `DynamicIcon` innecesario (que forzaría cargar todo el paquete).
- Los íconos están centralizados por dominio (`uiMappings.ts`, `estadoConfig.ts`, `sidebarItems.ts`), no dispersos con strings mágicos.
- Uso consistente vía componentes (nunca SVG inline duplicados).

**Lo mejorable:**
1. **Versión muy atrasada.** Estamos ~19 meses detrás. Entre 0.462 → 1.24 hay: nuevos íconos, bugfixes de stroke, mejor tipado TS, soporte de `Icon` para `lucide-lab`, y sub-path exports optimizados. No es un major "React 19" ni parte del pin de plataforma (React 18 / Vite 5 / TS 5 / Tailwind 3), así que el bump es seguro.
2. **190 íconos únicos** en 578 archivos → algunos son casi duplicados semánticos (p.ej. varios "check", "alerta"). Se puede consolidar vía `uiMappings.ts`.
3. No hay un **wrapper `<Icon />`** propio que estandarice `size`, `strokeWidth` y `aria-label`. Hoy cada archivo pasa `className="h-4 w-4"` a mano (inconsistencias 3/4/5/6).
4. No hay **lint rule** que impida `import * as Icons from 'lucide-react'` o `lucide-react/dist/...` en el futuro.

## Plan de mejora (en orden, todo opcional/incremental)

### Fase 1 — Bump de versión (bajo riesgo)
- Actualizar `package.json`: `"lucide-react": "^1.24.0"`.
- `bun install`.
- Smoke test: `bun run test:fast`, `bun run build`, revisar visualmente sidebar + dashboard (donde viven los 30+ íconos de `sidebarItems.ts`).
- Riesgo: bajísimo. La API `<Icon size color strokeWidth />` no cambió. Sólo se renombraron/agregaron íconos; si alguno explota, TS lo marca en build.

### Fase 2 — Wrapper `<Icon />` de proyecto
- Crear `src/components/ui/icon.tsx` con:
  - `size` default 16, `strokeWidth` default 2.
  - Prop `label?: string` → si existe pone `aria-label` y quita `aria-hidden`; si no, `aria-hidden="true"`.
  - Recibe el componente lucide como prop `as`.
- Migración **no forzada**: usarlo en código nuevo; codemod opcional después.

### Fase 3 — Consolidar catálogo
- Ampliar `src/lib/ui/uiMappings.ts` como fuente única para "ícono de estado X", "ícono de módulo Y".
- Reducir 190 → ~150 íconos únicos.

### Fase 4 — Guardrails
- Añadir regla ESLint `no-restricted-imports` que prohíba:
  - `lucide-react/dist/*`
  - `import * as ... from 'lucide-react'`
- Agrega test de arquitectura tipo "ningún archivo importa >15 íconos de lucide-react" (indicador de god-file).

### Verificación final
- `bun run test:fast`, `bun run lint`, `bun run build`.
- Bump `APP_VERSION` a `13.260.0` + entrada en `CHANGELOG.md`.

## Detalles técnicos

- No requiere tocar el pin de plataforma (React 18 / Vite 5 / Tailwind 3 / TS 5) — `lucide-react` no está en la lista de versiones prohibidas.
- Tree-shaking: Vite 5 + ESM named imports ya elimina los ~1,400 íconos no usados. El bundle sólo incluye los 190 en uso.
- `DynamicIcon` sólo se justificaría si los nombres vinieran de una API/CMS — no es nuestro caso, no lo introducimos.

## Respuesta rápida a tus preguntas

- **¿Está limpia?** Sí, en patrón de import y organización.
- **¿Top-of-the-line?** En patrón sí; en versión **no**, estamos 19 meses atrás.
- **¿Se puede mejorar?** Sí: bump a 1.x, wrapper `<Icon />`, ESLint guardrail.
- **¿Es la versión más nueva?** No. 0.462.0 vs 1.24.0.
