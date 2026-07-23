## Reconciliación con `instrucciones-lovable-arquitectura-4.md`

Verifiqué los 6 ítems del Bloque 1 y los 4 del Bloque 2 contra el repo actual (v13.309.25). **Casi todo el Bloque 1-2 ya está cerrado por los PRs previos** (v13.308.0 → v13.309.25):

| Ítem audit-4 | Estado real hoy | Evidencia |
|---|---|---|
| 1.1 scanner arch en `src/features/**` | ✅ | `scripts/lib/arch.ts:65-71` incluye `"src/features"` |
| 1.2 path obsoleto `facturas/services/` | ✅ | 0 matches en `eslint.config.js` |
| 1.3 tipos cxp fuera de `.tsx` | ✅ | `@/features/cxp/types/` ya existe con `FacturaFormValues`, `EmbarqueSeleccionado`, `TcOrigen` |
| 1.4 nueve `any` en `FacturaDetalle*` | ✅ | 0 matches |
| 1.5 AuthContext → `lib/` | ✅ | `AuthContext.tsx:7` importa `@/lib/auth/signOut` |
| 1.6 supabase en `.tsx` fuera de services | ✅ | grep vacío |
| 2.1 traducción central `LC_*` | ✅ | `getErrorMessage` (`src/lib/errors/index.ts:49`) usa `translateLcCode` |
| 2.2 snapshot triggers en CI | ✅ | `supabase/tests/schema-invariants.sql` presente |
| 2.3(a) promover a shared | ✅ | `ProfitBadge`, `badgeTone`, `estadoUnificado` ya en `components/shared`/`lib/ui`/`lib/domain` |
| 2.3(b) `no-restricted-imports` cross-feature | ✅ | Bloque 2.3 en `eslint.config.js:617` |
| 2.4 IVA único + Fases embarque | ✅ | 0 literales `0.16` en los 5 archivos listados; `embarqueFases.invariant.test.ts` verde |

**No hay refactor pendiente en Bloques 1-2.** El audit-4 refleja el estado de `main` antes de nuestros PRs (v13.308.x); documentaré esto en `docs/arquitectura-auditoria-3-status.md` y `CHANGELOG.md`.

**Sí queda trabajo real en Bloque 3**, alineado con el plan que ya venía ejecutando. El próximo turno es el **PR-5** que había propuesto: Ítem 3.4.

---

## PR-5 · Ítem 3.4 — Consolidar formateo y badges de estado (v13.309.26)

### Diagnóstico actual (medido este turno)
- 21 archivos con `toLocaleString` / `Intl.NumberFormat` inline.
- 15 archivos con `toLocaleDateString(...)` inline.
- 13 archivos ya usan `<StatusBadge/>`; **67 archivos** siguen con `estado === "Literal"` ad-hoc.

Refactor puro, sin cambiar comportamiento, textos ni contratos.

### Alcance (una pasada, sin sobrecargar el PR)
Migro **~10 archivos hotspot** de los 3 dominios más visibles + añado guardarraíl. Los ~26 restantes se dejan para PR-5b/c documentados.

#### Fase A · Formatters
1. Reforzar `src/lib/formatters/numbers.ts` y `dates.ts` (ya existen) con `formatMxn`, `formatUsd`, `formatMoneda(monto, moneda)`, `formatFecha(iso, "corta"|"larga")`. Si ya están, sólo re-exporto.
2. Migrar 10 callsites priorizados por visibilidad:
   - `features/facturacion/components/detalle/*` (3 sitios con `toLocaleString`)
   - `features/embarques/components/tracking/*` (2 sitios con `toLocaleDateString`)
   - `features/cxp/components/detalle/*` (2 sitios)
   - `features/dashboard/**` (3 sitios)
3. Añadir `no-restricted-syntax` en `eslint.config.js`: prohíbe `Intl.NumberFormat` / `.toLocaleString(` / `.toLocaleDateString(` **fuera de `src/lib/formatters/**`**. Documentar allowlist temporal para los 26 restantes con `// ARCH-DEBT: 3.4-b`.

#### Fase B · StatusBadge
4. Localizar los 3 clusters con más comparaciones `estado === "..."`: elegir 3 rutas (probablemente `features/facturacion/components/detalle`, `features/cxp/components/*Row.tsx`, `features/embarques/components/TabResumen*`).
5. Reemplazar comparaciones inline por `<StatusBadge estado={x} dominio="factura|cxp|embarque" />` usando el registry existente (`ESTADOS_*` arrays).
6. Eliminar 2-3 mapas ad-hoc: `operaciones/components/desempenoVisuals.ts:5` y `crm/routes/leadsColumns.tsx:13` (si están fuera de path crítico).

### Aceptación
- `bun run lint -- --max-warnings 0` verde con la nueva regla activa.
- `bunx tsgo --noEmit` limpio.
- 158+ tests de arquitectura verdes.
- `rg -c "toLocaleString|Intl\.NumberFormat" src/features src/components` baja de 21 → **≤11**.
- `rg -c "toLocaleDateString" src/features src/components` baja de 15 → **≤8**.
- Comportamiento idéntico: nada cambia visualmente (mismos formatos es-MX, mismas etiquetas de estado).

### Entregables
- `src/lib/formatters/numbers.ts`, `dates.ts` (ampliados si hace falta).
- ~10 archivos consumidores migrados.
- `eslint.config.js` con `no-restricted-syntax` nuevo + allowlist ARCH-DEBT.
- `CHANGELOG.md`: entrada `[13.309.26]`.
- `docs/arquitectura-auditoria-3-status.md`: marcar 3.4 ⚠️→ (parcial documentado), agregar sección de reconciliación con audit-4.
- `src/constants/appVersion.ts` → `13.309.26`.

### Fuera de scope (documentado como follow-ups)
- **PR-5b** (~15 min por feature): migrar los formatters restantes (~11 archivos).
- **PR-6** (Ítem 3.3): RHF+zod para `useNuevaFacturaProveedorForm` (11 `useState` → 1 `useForm`). Grande, aparte.
- **PR-7** (Ítem 3.1/3.2 restantes): sources canónicas para `crear_embarque_completo`, `saldo_factura`, `recalcular_estado_factura` + splitting de `auditoria_embarques_org` (664 líneas).

### Detalles técnicos
- El `no-restricted-syntax` sigue el patrón existente en `eslint.config.js:210` (los bloques `no-restricted-imports` cross-feature).
- La allowlist ARCH-DEBT se define con `files: [...]` y un override que desactiva la regla, igual que ya hacemos con la allowlist de Item 2.3.
- Los formatters usan `Intl.NumberFormat("es-MX", {...})` centralizado — misma semántica que hoy, sin cambio de output.
- `StatusBadge` ya soporta los 3 dominios en `src/components/shared/StatusBadge.tsx` (registry-based); sólo migro consumidores.

### Analogía
Hoy cada componente formatea moneda/fecha con su propia mano (21 recetas distintas para el mismo pastel); mañana todos van a la misma repostería centralizada (`lib/formatters`) y un letrero ESLint prohíbe volver a hornear en la cocina de cada casa.
