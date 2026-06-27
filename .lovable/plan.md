
## Resultado de la auditoría de compatibilidad

Lovable fija el stack en **React 18 + Vite 5 + Tailwind v3 + TypeScript 5**. Eso bloquea varios de los upgrades mayores que aparecen en `bun outdated` y obliga a reescribir el plan de migración previo (PR-A → PR-H).

### Instalado hoy — todo compatible ✅
React 18.3.1, react-dom 18.3.1, Vite 5.4.21, Tailwind 3.4.19, TypeScript 5.9.3, @vitejs/plugin-react-swc 3.11.0, Sentry 10.62, Supabase JS 2.108, TanStack Query 5.101, Radix UI (todos), Zod 3.25, date-fns 3.6, recharts 2.15, sonner 1.7, lucide 0.462, react-router-dom 6.30, react-day-picker 8.10, tailwind-merge 2.6, @hookform/resolvers 3.10, Vitest 4.1, ESLint 10, jsdom 29, knip 6.

### Upgrades mayores — clasificación

**🚫 INCOMPATIBLES con Lovable (no aplicar):**

| Paquete | Latest | Motivo |
|---|---|---|
| `react` / `react-dom` | 19.2.7 | Lovable = React 18 |
| `@types/react` / `@types/react-dom` | 19.x | Atado a React 19 |
| `vite` | 8.1.0 | Lovable = Vite 5 |
| `@vitejs/plugin-react-swc` | 4.3.1 | Requiere Vite 6+ |
| `tailwindcss` | 4.3.1 | Lovable = Tailwind v3 (cambia config a CSS-first, rompe `tailwind.config.ts` y plugins) |
| `typescript` | 6.0.3 | Lovable = TS 5 |
| `react-router-dom` | 7.18.0 | Requiere React 19 + cambia API a "framework mode" |

Esto invalida los PRs **B, E, F, G, H** del plan mayor anterior. Hay que retirarlos del backlog.

**⚠️ MAYORES INDEPENDIENTES (compatibles con React 18, requieren refactor moderado):**

| Paquete | Latest | Riesgo / refactor |
|---|---|---|
| `zod` | 4.4.3 | API de errores y `z.record` cambian; tocaría ~80+ schemas |
| `sonner` | 2.0.7 | Renombres en API de `toast()` y theming |
| `lucide-react` | 1.21.0 | Reorganización de exports / nombres de íconos |
| `date-fns` | 4.4.0 | Soporte de zonas horarias nuevo; ya usamos `formatInTimeZone`, hay que validar |
| `recharts` | 3.9.0 | Reescritura de `<Tooltip>` y tipos; alto riesgo en dashboards |
| `react-day-picker` | 10.0.1 | API nueva; afecta `DatePickerMx`, `DateTimePickerMx`, `MonthPickerMx` |
| `tailwind-merge` | 3.6.0 | Pide Tailwind 4 → **descartar** mientras sigamos en TW 3 |
| `@hookform/resolvers` | 5.4.0 | Atado a Zod 4 → ligar con el upgrade de Zod |

### Plan revisado de migración mayor

1. **Cerrar oficialmente** los PR-B / PR-E / PR-F / PR-G / PR-H y dejar nota en `mem://` para no volver a proponerlos mientras la plataforma siga en este stack.
2. Mantener solo estos PRs viables (orden propuesto, menor a mayor riesgo):
   - **PR-D1**: `sonner` 1 → 2  *(toasts; cambios acotados)*
   - **PR-D2**: `lucide-react` 0.462 → 1.x  *(reemplazar nombres deprecados)*
   - **PR-D3**: `date-fns` 3 → 4  *(validar `formatInTimeZone` y locales `es`)*
   - **PR-D4**: `react-day-picker` 8 → 10 + ajustar `DatePickerMx` y derivados
   - **PR-C**: `zod` 3 → 4 **+** `@hookform/resolvers` 3 → 5 (en el mismo PR; son interdependientes)
   - **PR-D5**: `recharts` 2 → 3  *(último por ser el más invasivo en UI)*
3. Dejar fuera del backlog: `tailwind-merge` 3 (requiere Tailwind 4).
4. Documentar en `mem://constraint/lovable-stack-pins` los pines duros: React 18, Vite 5, Tailwind 3, TS 5, router 6, swc-plugin 3.

### Detalle técnico

- `bun outdated` corrido contra el lockfile actual; los "Update" coinciden con "Current" porque los rangos en `package.json` son `^x.y.z` por debajo de cada major.
- Las restricciones React 18 / Vite 5 / Tailwind 3 / TS 5 vienen del propio runtime de Lovable (no podemos elevarlas aunque pasen los tests locales: el preview dejaría de buildear en la plataforma).
- No se proponen cambios de código en este plan — sólo reordenar el backlog de upgrades y registrar las restricciones.

### Entregable de esta tarea
Al aprobar, en modo build sólo haremos:
- Crear `mem://constraint/lovable-stack-pins` con los pines.
- Actualizar `.lovable/plan.md` (si existe) o `CHANGELOG.md` con el plan revisado.
- No tocar `package.json` ni el lockfile.
