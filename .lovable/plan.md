## Auditoría de la Fase P0 (v13.293.0)

Los 4 artefactos nuevos están limpios y compilan, pero **ninguno tiene tests**. Antes de arrancar P1 hay que blindarlos, sobre todo el autoguardado y el mapeo de errores (son puro dominio y fáciles de romper sin darse cuenta).

### Hallazgos menores durante la revisión

1. `useCotizacionDraftAutosave` — comentario dice "no guarda si `isDirty=false`" pero el código sí guarda en cada `watch`. Alineamos el comentario con la implementación (guardamos siempre; el gating de "borrador vacío" lo hace `enabled`). No cambia comportamiento.
2. `scrollToErrorSection` — el `setTimeout` interno queda sin limpiar si el usuario cambia de ruta en <320ms. Riesgo mínimo, pero envolvemos en un `try/catch` defensivo por si `document.getElementById` recibe un id malformado en tests JSDOM.
3. `NuevaCotizacion` — usa `loadDraft` una sola vez con `useMemo` (correcto), pero si el `userId` llega tarde (async auth), el banner nunca aparece. Cambiamos a re-detectar cuando `userId` cambia de `""` a un valor real.

---

## Fase 1 — Tests unitarios de P0

### 1.1 `useCotizacionDraftAutosave.test.tsx`
- `loadDraft` devuelve `null` cuando no hay nada guardado.
- `loadDraft` devuelve `null` y limpia storage cuando el borrador tiene >24h.
- `loadDraft` devuelve `null` si el JSON está corrupto o `version !== 1`.
- El hook persiste tras `DEBOUNCE_MS` (usando `vi.useFakeTimers()` + `form.setValue`).
- El hook NO persiste cuando `enabled=false`.
- `clearDraft` remueve la clave.
- Cleanup: el timer se cancela en `unmount`.

### 1.2 `scrollToErrorSection.test.ts`
- `seccionParaErrorPaso1` mapea correctamente para "cliente", "prospecto", "modalidad", "tarifa" y fallback.
- `scrollAndFocusSection` hace no-op cuando el id no existe.
- `scrollAndFocusSection` hace focus al primer input (mockear `scrollIntoView`).

### 1.3 `CotizacionSuccessDialog.test.tsx`
- Renderiza folio cuando llega y muestra "¿Qué sigue?" cuando no.
- Los 5 handlers se disparan al click (Enviar proforma / Crear embarque / Duplicar / Ver listado / Ver detalle).
- `onOpenChange(false)` al cerrar.

### 1.4 `DraftRestoreBanner.test.tsx`
- `formatRelative` cubre los 4 rangos (segundos, min, hrs, >1d).
- `onRestore` y `onDiscard` se disparan.

### 1.5 Fix menores (mismo commit)
- Alineación de comentario en `useCotizacionDraftAutosave`.
- `try/catch` defensivo en `scrollAndFocusSection`.
- Re-detección de draft cuando `userId` cambia en `NuevaCotizacion`.

---

## Fase 2 — Arranque de P1 (UX del wizard)

Prioridad final: los 4 items de P1 en orden de impacto/costo.

### 2.1 Barra flotante de totales (P&L en vivo) — pasos 2 y 3
Componente `WizardTotalsBar` sticky en el fondo del `CotizacionWizardLayout`. Muestra en tiempo real:
- **Costo total** (USD + MXN convertido)
- **Venta total** (USD + MXN)
- **Margen** (absoluto y %)
- Badge de color: verde si margen ≥ 15%, ámbar 5–15%, rojo <5%.

Consume los totales que ya calcula `useCotizacionWizardForm` (no duplicamos matemática, es sólo un consumidor). Se oculta en paso 1 y paso 4.

### 2.2 Atajos de teclado
Hook `useCotizacionKeyboardShortcuts`:
- `Ctrl/Cmd + Enter` → Siguiente / Guardar (según paso).
- `Ctrl/Cmd + ←` → Anterior.
- `Ctrl/Cmd + S` → Guardar borrador manual (fuerza flush del autosave).
- `Esc` → confirmar salida si hay cambios sin guardar.

Se muestra un tooltip discreto "⌘↵" junto al botón "Siguiente".

### 2.3 Preview de proforma en paso 4
Panel colapsable a la derecha en paso 4 con una miniatura HTML de la proforma (reutiliza el template ya existente). En desktop se ve al lado; en tablet/móvil queda como acordeón.

### 2.4 Sidebar progresivo (tablet)
`CotizacionWizardSteps` sidebar cambia de "solo iconos" (mobile) → "iconos + label corto" (tablet ≥768px) → "completo" (desktop ≥1024px). Puro Tailwind responsivo, sin JS.

---

## Detalles técnicos

- **Tests**: siguen el patrón del proyecto (`vitest` + `@testing-library/react` + mocks de Supabase existentes en `src/test/setup.ts`). Cada archivo <100 líneas; sin snapshots.
- **`useFakeTimers`**: se usa sólo dentro de los tests de debounce; se restauran en `afterEach`.
- **`WizardTotalsBar`**: consume props ya calculados por el hook orquestador; no llama a Supabase.
- **Atajos**: registrados en el `useCotizacionWizardForm` con cleanup obligatorio (regla core del proyecto).
- **Versionado**: bump a `13.293.1` para los tests + fixes, y `13.294.0` para P1.
- **Changelog**: dos entradas separadas.

## Fuera de alcance

- P2/P3 de la auditoría original (unificar "Agregar concepto", warnings inline, templates de cotización). Se queda para la siguiente fase.
- Cambios en el motor de cálculo del P&L (ya está estable).
- Migración a shortcuts globales de la app (sólo scope wizard).