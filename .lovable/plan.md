
# Auditoría de Dependencias — Libre Carga ERP

**Estado de seguridad:** ✅ Sin vulnerabilidades altas/críticas (npm audit + bun audit).
**Restricciones de plataforma (mem://constraint/lovable-stack-pins):** Vite 5, Tailwind 3, TS 5, react-router 6, `@vitejs/plugin-react-swc` 3, `tailwind-merge` 2. Estas mayores están **prohibidas por Lovable**.

Analogía: piensa en las dependencias como refacciones del camión. Unas son cambio de aceite (rutinario), otras son cambio de transmisión (parar el taller), y otras el fabricante nos prohíbe cambiar.

---

## 🟢 Ola 1 — Seguro (patches/minors, sin breaking changes esperados)

Actualizar todos de golpe. Riesgo bajo, sólo re-correr CI.

**Radix UI (18 paquetes)** — todos minor bumps:
`accordion 1.2.16→1.2.20`, `alert-dialog 1.1.19→1.1.23`, `avatar 1.2.2→1.2.6`, `checkbox 1.3.7→1.3.11`, `collapsible 1.1.16→1.1.20`, `dialog 1.1.19→1.1.23`, `dropdown-menu 2.1.20→2.1.24`, `label 2.1.11→2.1.15`, `popover 1.1.19→1.1.23`, `progress 1.1.12→1.1.16`, `radio-group 1.4.3→1.4.7`, `select 2.3.3→2.3.7`, `separator 1.1.11→1.1.15`, `slot 1.3.0→1.3.3`, `switch 1.3.3→1.3.7`, `tabs 1.1.17→1.1.21`, `toggle-group 1.1.15→1.1.19`, `tooltip 1.2.12→1.2.16`.

**TanStack (4 paquetes):** `react-query`, `query-persist-client`, `query-sync-storage-persister`, `react-query-devtools` → `5.101.4`. `react-virtual` → `3.14.8`.

**Sentry:** `@sentry/react 10.65 → 10.68`.
**Supabase JS:** `2.110.2 → 2.110.9`.
**React:** `19.2.7 → 19.2.8` (junto con `react-dom` y `@types/react*`).
**React Hook Form:** `7.81 → 7.83`.
**Otros minor:** `libphonenumber-js 1.13.8→1.13.9`, `lucide-react 1.24→1.27`, `nuqs 2.9.0→2.9.2`, `@playwright/test 1.61→1.62`, `@testing-library/jest-dom 6.9→6.10`, `@types/node 26.1.1→26.1.2`, `autoprefixer 10.5.2→10.5.4`, `eslint 10.7→10.8`, `globals 17.7→17.8`, `knip 6.26→6.29`, `lovable-tagger 1.3.1→1.3.3`, `postcss 8.5.16→8.5.23`, `tsx 4.23.0→4.23.1`, `typescript-eslint 8.63→8.65`.

**Cómo:** `bun update` sobre estos paquetes → CI Fast completo → tests → smoke visual.

---

## 🟡 Ola 2 — Mayor con riesgo controlado (uno a uno, con QA)

Cada uno merece su propio ticket + regression testing:

1. **`@hookform/resolvers` 3.10.0 → 5.5.7** — cambió la firma de resolvers en v4 (breaking para Zod). Requiere revisar cada `useForm({ resolver: zodResolver(...) })` (memoria dice que usamos RHF+Zod extensivamente). Riesgo: alto en formularios, medio en tests.
2. **`date-fns` 3.6 → 4.4** — v4 introdujo timezone-aware APIs. Debemos validar el módulo de fechas custom (`mem://technical/date-time-standards`) que hoy normaliza a UTC.
3. **`@testing-library/jest-dom` 6.10 → 7.0** — sólo tests, riesgo aislado.
4. **`jsdom` 29 → 30** — sólo tests, revisar canaries de PDF y JSDOM-only mocks.

**Cómo:** un PR por paquete, correr `bun run test` completo + Playwright E2E.

---

## 🔴 Bloqueadas por Lovable (NO actualizar)

Estas mayores están vetadas por la plataforma (`mem://constraint/lovable-stack-pins`):

- **Vite 5 → 8** ❌
- **TypeScript 5 → 7** ❌
- **Tailwind 3 → 4** ❌
- **react-router-dom 6 → 7** ❌
- **@vitejs/plugin-react-swc 3 → 4** ❌
- **tailwind-merge 2 → 3** ❌

---

## 🟠 Requieren decisión de negocio (mayor, no bloqueada por Lovable, pero costosa)

- **`recharts` 2.15 → 3.10** — v3 reescribió la API de componentes y tooltips. Impacta Dashboard, Profit, Presupuesto, Aging CxP. Costo alto, beneficio bajo.
- **`xlsx` 0.18.5** — última versión oficial en npm; el mantenedor migró a `xlsx.js` fuera de npm. No es urgente pero conviene evaluar alternativa (`exceljs`) por soporte a largo plazo.
- **`@babel/core` 7.29 → 8.0.1** (dev) — usado solo por `babel-plugin-react-compiler`. Esperar a que el plugin lo soporte.
- **`react-day-picker` "^10"** — está en `^10` amplio; validar que no rompió API.

---

## Detalles técnicos

- Ninguna vulnerabilidad reportada en `npm audit`/`bun audit`/`code--dependency_scan`.
- `sonner` ya está en 2.0.7 (última estable) por el fix reciente.
- El pin `^4` de `zod` cubre v4 completo, ya está al día.
- `react-helmet-async 3.0.0` es la última.
- Al aplicar Ola 1, regenerar `bun.lock` como texto (`bun install --save-text-lockfile`) para que el scanner pueda leerlo si aparece un CVE.

## Recomendación

Ejecutar **Ola 1 ahora** en un solo commit (`chore(deps): bump minor/patch dependencies`) + bump `APP_VERSION` + entrada en `CHANGELOG.md`. Postergar Ola 2 a sprints individuales. Congelar las bloqueadas hasta que Lovable habilite las mayores.

¿Quieres que ejecute Ola 1 en modo build?
