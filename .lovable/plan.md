# Condición de release C1 — Docs canónicos

Origen: `auditoria-arquitectura-r3-release-readiness-2026-07-24.md` (veredicto **GO con 1 condición**). Todo el resto del roadmap (Olas 1-3) queda **post-release** y **no** se toca en este plan.

## Contexto verificado (contra HEAD)

- `src/pages/` → **no existe** (la topología real vive en `src/features/`, 32 módulos: admin, auditoria, auth, bandejas, catalogos, cliente, comisiones, compras, configuracion, costeo, … ).
- `src/contexts/` → **no existe** (movido a `src/lib/contexts/`: Auth, Breadcrumb, Organization, Theme).
- `src/hooks/` → solo transversales (`emails/`, `layout/`, `shared/`, `__tests__/`); ya **no** hay `hooks/<dominio>/`.
- `eslint.config.js` — `CROSS_FEATURE_ALLOWLIST`: **44** entradas (no 43).
- `eslint.config.js` — bloque `locale-format-legacy`: quedan **2** entradas productivas (`lib/formatters/**`, `lib/date/mx.ts`) → **agotada** para hotspots.
- `scripts/audit-migrations.ts:47` — `BASELINE = "20260723223436"` (no `20260723180000`).
- `eslint.config.js:697` — comentario dice `"84 archivos"`; el bloque SONNER-LEGACY real tiene **82** archivos + **6** wrappers autorizados.
- `docs/arquitectura-auditoria-3-status.md:41` — fila 3.3 marca "❌ Sin cambios", pero el **paso 1 (zod)** ya existe: `useNuevaFacturaProveedorForm.schema.ts` con `buildFacturaFormSchema` + `validateFactura`. Lo pendiente es el paso 2 (migrar el estado a `useForm`).

## Nota sobre los diffs del auditor

Los archivos `arch-md-c1.diff` y `docs-banners-c1.diff` **no están** en el repo. Aplicamos los mismos cambios directamente con `line_replace`, reproduciendo el efecto descrito por el auditor (sin tocar código de aplicación).

---

## Cambios a aplicar

### 1) `ARCHITECTURE.md` — reescribir §1 "Estructura de carpetas"

Reemplazar la sección `## 1. Estructura de carpetas` completa por la topología **real** verificada contra HEAD:

- `src/features/` como raíz de dominio (32 módulos con plantilla `routes/ · components/ · hooks/ · services/ · domain/ · types/ · utils/ · queryKeys.ts`).
- `src/components/` y `src/hooks/` **solo** transversales (shared, ui, layout, emails).
- `src/lib/` con sus ~24 subdirs, incluyendo `auth/` y `contexts/` (ya no está en `src/contexts/`).
- Eliminar referencias a `src/pages/`, `src/contexts/`, `src/hooks/<dominio>/` (obsoletas).
- Mencionar `supabase/schema/` canónico y `supabase/tests/` (invariants + conductual).
- Anotar la regla cross-feature con allowlist ARCH-DEBT (44 entradas hoy).

### 2) Banners de OBSOLETO en dos docs de arquitectura

Insertar en el **top** de cada archivo un banner que apunte al canónico (`ARCHITECTURE.md`) y marque el documento como histórico:

- `docs/architecture-map.md` — banner "⚠️ OBSOLETO — ver `ARCHITECTURE.md`".
- `docs/architecture.md` — mismo banner.

### 3) Corregir 4 números stale (ediciones chicas)

- `docs/arquitectura-auditoria-3-status.md`:
  - CROSS_FEATURE_ALLOWLIST: `43` → **`44`**.
  - locale-format-legacy: `27` → **AGOTADA** (solo `lib/formatters/**` + `lib/date/mx.ts`).
  - Fila 3.3 (formularios): "❌ Sin cambios" → **paso 1 hecho** (schema zod `buildFacturaFormSchema`); pendiente el paso 2 (RHF `useForm`).
- `docs/migrations-hygiene.md:4`: baseline `20260723180000` → **`20260723223436`**.
- `eslint.config.js:~697` (comentario **de línea**, no lógica): `"84 archivos + 7 wrappers"` → **`"82 archivos + 6 wrappers"`**.

## Fuera de alcance (post-release)

Todas las Olas 1-3 del roadmap (cascada de hidratación, PR-6 paso 2 RHF, migración a `useMutationWithFeedback`, complexity disables, prop drilling, shim bitácora, backend chico, regla H7, clones jscpd, knip/SONNER/CROSS_FEATURE burn-down, layout pospuesto, cosméticos). Se rastrean pero **no** son bloqueantes del release.

## Validación

- Los cambios son **solo docs + 1 comentario en `eslint.config.js`** → no hay riesgo de romper lint/tsc/vitest.
- Verificar tras aplicar: `bun run lint` sigue verde y `docs consistentes con el código`.
- Bump de `APP_VERSION` + entrada en `CHANGELOG.md` (patch): "docs: condición C1 release — ARCHITECTURE.md §1 al día + banners obsoleto + números stale".

## Detalles técnicos (para el modo build)

Archivos a modificar:

```text
ARCHITECTURE.md                             (reescribir §1)
docs/architecture-map.md                    (insertar banner al top)
docs/architecture.md                        (insertar banner al top)
docs/arquitectura-auditoria-3-status.md     (3 correcciones puntuales)
docs/migrations-hygiene.md                  (1 corrección: baseline)
eslint.config.js                            (1 comentario: 84→82 / 7→6)
src/constants/appVersion.ts                 (bump patch)
CHANGELOG.md                                (nueva entrada)
```

Sin migraciones DB. Sin cambios de código de aplicación. Sin cambios en tests.
