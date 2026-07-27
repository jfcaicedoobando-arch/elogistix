## Auditoría de toasts

### Cómo está hoy (verificado en código)

- **Backend único:** Sonner (`<Toaster />` montado 1 sola vez en `src/App.tsx`, config global en `src/components/ui/sonner.tsx`).
- **Wrapper canónico:** `@/lib/ui/appFeedback` con `notifyError / notifySuccess / notifyInfo / notifyWarning`. Todos añaden acción "Ver detalles", integran `reportCaughtError` (Sentry) y filtran ruido vía `shouldReportToSentry`.
- **Wrapper para mutaciones:** `useMutationWithFeedback` + `queryClient` global hooks, que ya usan los helpers.
- **Guardrail ESLint:** bloque `no-raw-table-and-sonner` prohíbe `import { toast } from "sonner"` fuera de allowlist (`eslint.config.js` líneas ~176–780).
- **Uso real hoy:**
  - `notify*` helpers: **~1,069 call sites en 272 archivos** ✅
  - Import directo de `sonner` fuera de wrappers: **84 archivos** (baseline `SONNER-LEGACY` congela 82; hay **2 archivos que se colaron sin permiso**).
  - Llamadas crudas `toast.success/error/info/…`: **77 sitios** en 58 archivos.

### Hallazgos (severidad ↓)

**HIGH · 1. Baseline SONNER-LEGACY se está oxidando.** 82 archivos siguen importando `sonner` directo. Sin plan de cierre, la deuda crece cada release y la promesa "todo toast pasa por `appFeedback`" es falsa. **Impacto:** errores sin panel "Ver detalles", sin breadcrumb Sentry, textos inconsistentes.

**HIGH · 2. Fugas de la allowlist.** Comparé `rg` vs baseline: hay 84 archivos importando `sonner` directo pero sólo 82 en la lista → **2 archivos regressionaron** sin actualizar `eslint.config.js` (probablemente `useTesoreriaMovimientos.ts` y otro; a confirmar). El lint no falló porque los otros overrides desactivan `no-restricted-imports` en varias carpetas.

**MEDIUM · 3. `duration: Infinity` fuera del helper.** `useNuevaFacturaProveedorForm.sideEffects.ts` fija Infinity manualmente. La regla actual es "sólo `notifyError` bloquea"; toasts persistentes sueltos rompen esa expectativa (usuario ve un warning que nunca desaparece sin acción).

**MEDIUM · 4. Estilos de severidad ambiguos.** `sonner.tsx` retiró `richColors` (correcto) y usa borde izquierdo + icono. Sin embargo `success` y `info` en dark mode comparten un token muy parecido (`--success` vs `--info`) — vale una revisión de contraste rápida.

**MEDIUM · 5. Falta `toast.promise` / patrón loading.** 0 usos hoy. Muchos flujos largos (subida XML/PDF, timbrado, cancelación SAT) emiten "empezó" + "terminó" a mano. `notifyLoading` + `notifyResolve` podrían simplificar.

**LOW · 6. Duplicación semántica.** `crmToast.ts` reimplementa una capa fina encima de `notify*` para "silenciar" mensajes CRUD (2s). Es útil, pero duplica lógica: podría vivir como preset `notifySuccess(…, { duration: 2000 })` en `appFeedback` para no tener 2 APIs.

**LOW · 7. `useToast` legacy shim.** `src/hooks/shared/useToast.ts` sigue exponiendo la firma `const { toast } = useToast()` para ~7 archivos. Ya no aporta; añade una capa más para entender el sistema.

**OK · 8.** Toaster está montado 1 sola vez, posición `top-right`, cerrable, con swipe. Sin bugs.

**OK · 9.** Integración con Sentry (filtro anti-ruido + breadcrumb + `Ver detalles`) está bien pensada.

### Propuesta: 3 olas incrementales

**Ola A — Higiene inmediata (1 PR pequeño)**
1. Detectar los 2 archivos que se colaron sin permiso vs. baseline y **migrarlos** a `notify*` (o agregarlos con comentario si son casos legítimos, ej. `toast.dismiss`).
2. Mover `duration: Infinity` de `useNuevaFacturaProveedorForm.sideEffects.ts` a `notifyWarning({ persistent: true })` (nuevo flag).
3. Test de regresión: `scripts/audit-sonner-baseline.ts` que compare `rg 'from "sonner"'` contra la allowlist y falle si crece.

**Ola B — Cerrar la baseline (SONNER-LEGACY → 0)**
Migrar los 82 archivos en tandas de ~15 archivos por módulo, en este orden por riesgo:
1. `auditoria/` (7 archivos) + `admin/` (2) — flujos internos.
2. `crm/` (~12) — reemplazar `crmToast` por preset `notifySuccessQuiet` en `appFeedback` y borrar el archivo.
3. `cxp/` (~11) + `facturacion/` (~15) — módulos financieros; migrar y verificar que "Ver detalles" aparece en cada error.
4. `embarques/` + `costeo/` + `cotizacion/` (~20).
5. `tesoreria/` + `presupuesto/` + `comisiones/` + `proveedor/` + resto (~15).

Cada tanda: (a) sustituir `toast.*` por `notify*`, (b) quitar entrada de allowlist, (c) test suite específico de la carpeta, (d) bump CHANGELOG. Objetivo: baseline queda **vacía** y la regla ESLint bloquea el 100 %.

**Ola C — Mejoras de plataforma (post-baseline)**
1. Añadir `notifyPromise(promise, { loading, success, error })` en `appFeedback` (wrap de `toast.promise`) y adoptarlo en 6 flujos largos (timbrar factura, cancelar SAT, subir XML/PDF IA, generar PDF cotización, envío masivo, backfill legacy).
2. Deprecar y borrar `src/hooks/shared/useToast.ts` migrando los ~7 call sites a `notify*` directo. Menos superficie de API.
3. Revisar contraste `--success` vs `--info` en dark mode (screenshot side-by-side) y ajustar tokens si es necesario.
4. Documentar el sistema en `docs/ui/toasts.md`: cuándo usar cada helper, `duration`, cuándo pasar `context/method` para trazabilidad Sentry.

### Métricas de éxito

| Métrica | Hoy | Meta post-Ola C |
|---|---|---|
| Archivos con `import { toast } from "sonner"` (fuera de wrappers) | 84 | 0 |
| Baseline SONNER-LEGACY | 82 | 0 |
| Call sites vía `notify*` | 1,069 | ~1,150 (100 %) |
| `toast.*` crudos | 77 | 0 |
| `duration: Infinity` fuera de `appFeedback` | 1 | 0 |
| APIs de toast públicas | 3 (`notify*`, `useToast`, `crmToast`) | 1 (`notify*`) |

### Sección técnica (para referencia)

- Wrapper canónico: `src/lib/ui/appFeedback.ts` (143 líneas) + `appFeedback.sentry.ts` + `appFeedback.details.ts`.
- Regla ESLint clave: `eslint.config.js` block `no-raw-table-and-sonner` (línea 176), `no-restricted-imports` sobre `sonner`, con allowlist en líneas ~695–780.
- Toaster global: `src/components/ui/sonner.tsx` montado en `src/App.tsx:41`.

### Alcance del siguiente turno

Necesito confirmar contigo antes de tocar código:

1. ¿Ejecuto **sólo Ola A** ahora (safe, 1–2 archivos + script de regresión), o quieres que arranque también con la primera tanda de Ola B (`auditoria/` + `admin/`)?
2. ¿Consolido `crmToast` dentro de `appFeedback` como `notifySuccessQuiet` (recomendado), o lo dejo como wrapper propio del módulo CRM?
