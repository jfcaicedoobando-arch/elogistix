## Objetivo

Eliminar la falsa asociación con navieras y las cifras sin fuente en la landing (hero) sin perder gancho visual.

## Cambios

### 1. Prueba social — reencuadrar navieras como "rastreables"

Archivo: `src/features/marketing/routes/landingCopy.ts`

- `PROOF_TITLE` → `"Rastreamos embarques de las principales navieras y cumplimos con los estándares mexicanos"`
- Reorganizar `PROOF_LOGOS` en **dos grupos** semánticos:
  - `PROOF_NAVIERAS`: `["Maersk", "MSC", "Hapag-Lloyd", "CMA CGM", "ONE", "COSCO", "Evergreen", "APM Terminals"]` (agrego 2 más para verse completo)
  - `PROOF_ESTANDARES`: `["SAT · CFDI 4.0", "UN/LOCODE", "Banxico DOF", "Facturapi"]`
- Deprecar `PROOF_LOGOS` (dejar comentario de compatibilidad si algún test lo importa).

Archivo: `src/features/marketing/components/sections/LandingHero.tsx`

- La franja de prueba social se renderiza en **dos filas** con etiqueta pequeña a la izquierda:
  - Fila 1: `Navieras que rastreamos` → chips con `PROOF_NAVIERAS`
  - Fila 2: `Estándares que cumplimos` → chips con `PROOF_ESTANDARES`
- Los "logos" siguen siendo texto tipográfico (no imágenes de marca, evita issues legales). Se mantiene el estilo actual (`text-sm font-semibold text-primary-foreground/70`).
- Debajo, microcopy: `"Libre Carga no es un partner oficial de ninguna naviera. Solo rastreamos sus embarques."` en `text-[10px] text-primary-foreground/50 text-center` para transparencia total.

### 2. KPIs — 1 beneficio + 2 hechos verificables

Archivo: `src/features/marketing/routes/landingCopy.ts`

Reemplazar `KPIS` por:

```ts
export const KPIS = [
  { value: "Minutos", label: "para armar una cotización profesional" },
  { value: "11", label: "módulos integrados en una sola plataforma" },
  { value: "CFDI 4.0", label: "con IVA dinámico y complementos SAT" },
] as const;
```

- Eliminar los porcentajes inventados (`−70%`, `100%`, `0`).
- El primer KPI es cualitativo (gancho) pero honesto: no dice "en 3 minutos", solo "minutos vs. horas/días".
- Los otros dos son hechos verificables mirando el producto.

Archivo: `LandingHero.tsx`

- Ajustar el tamaño del `value` para acomodar strings más largos (`text-2xl sm:text-3xl` en vez de `text-3xl sm:text-4xl`) y permitir hasta 2 líneas en el label sin romper el grid.

### 3. Versionado + changelog

- `src/constants/appVersion.ts`: bump `13.256.0` → `13.257.0`.
- `CHANGELOG.md`: entrada nueva describiendo el reencuadre honesto de prueba social y KPIs.

## Fuera de alcance

- No se tocan otras secciones de la landing (features, testimonios, FAQ).
- No se agregan logos reales de imagen (siguen siendo tipográficos).
- No se hace scan SEO ni cambios de meta tags.

## Verificación

- `bun run test:fast` para asegurar que ningún test importe `PROOF_LOGOS` de forma rota.
- Revisión visual: abrir `/` y confirmar las dos filas de la franja + los 3 KPIs nuevos.
