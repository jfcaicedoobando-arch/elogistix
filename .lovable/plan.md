# Fase 2 · Guards de estado + confirmaciones destructivas

## Auditoría Fase 1 (v13.303.49) — sin bugs

Verificado:
- ✅ Todos los dumps/lockfiles borrados (ni `bun.lockb` ni `package-lock.json` presentes).
- ✅ `.gitignore` con `.lovable/` y `reports/junit.xml`.
- ✅ Gitleaks corre en push a main.
- ✅ `vitest.config.ts` sólo tiene UNA ocurrencia de `isolate: true` (línea 43).
- ✅ ESLint sin overrides a rutas inexistentes.
- ✅ Sólo queda **1** `confirm()` nativo en toda la app: `PlantillasMensajeEditor.tsx:132` (menos de lo estimado — la mayoría ya migró).

Sin regresiones. No hace falta tests nuevos porque Fase 1 sólo tocó config/tooling.

**Nota `.lovable/` en `.gitignore`:** este plan lo agregué yo, por lo que este archivo (`.lovable/plan.md`) no persistirá entre commits. ¿Quieres que quitemos `.lovable/` del `.gitignore` para futuras fases? (No bloqueante.)

## Fase 2 — Alcance

Guards de estado en BD + higiene de confirmaciones destructivas. Todo trivial a medio, sin riesgo financiero.

### Lote D · FIX-21 + FIX-25 (migración SQL)
Guardas en RPCs para prevenir transiciones inválidas silenciosas.

- `crear_embarque_borrador_desde_cotizacion` / `crear_embarque_borrador_core`:
  - Rechazar cotización si `estado NOT IN ('Aceptada','En operación')` con `LC_COT_ESTADO_INVALIDO`.
  - Rechazar si `deleted_at IS NOT NULL`.
  - Rechazar si ya existe embarque activo (no eliminado) apuntando a esa cotización → `LC_COT_YA_TIENE_EMBARQUE`.
  - `FOR UPDATE` sobre la cotización para evitar doble creación concurrente.
- `portal_responder_cotizacion`:
  - Rechazar respuesta si cotización `estado NOT IN ('Enviada')` → `LC_COT_NO_RESPONDIBLE`.
  - Rechazar si `token` expirado o cotización `deleted_at IS NOT NULL`.
  - Idempotencia: si ya está `Aceptada`/`Rechazada`, devolver estado actual sin re-escribir.

### Lote E · FIX-34 + FIX-37 (UI confirmaciones)
- `src/features/crm/components/PlantillasMensajeEditor.tsx:132` — reemplazar `confirm()` nativo por `AlertDialog` de shadcn.
- Auditar destructivas sin confirmación en:
  - `NotasCreditoSection.tsx` (borrar borrador NC).
  - `CatalogoClavesSATCard.tsx` (borrar clave SAT).
  - `FacturaConceptosEditor.tsx` (borrar concepto en borrador).
  - Añadir `AlertDialog` donde falte.

### Tests
- `plantillasMensajeEditor.test.tsx`: verifica que el `AlertDialog` aparece y sólo elimina tras confirmar.
- Test SQL sintáctico vía migración (los guards se validan en el próximo test de RPCs si hay cobertura existente; si no, no forzamos test dedicado ya que las policies existentes ya cubren happy path).

### Detalles técnicos
- Errores nuevos: `LC_COT_ESTADO_INVALIDO`, `LC_COT_YA_TIENE_EMBARQUE`, `LC_COT_NO_RESPONDIBLE` — mapear en `src/lib/errors/lcErrorMap.ts` con mensajes es-MX.
- `AvanzarEstadoButton` y wizard ya manejan `LC_*` genéricos, así que sólo hay que agregar entradas al mapa.
- Bump `APP_VERSION` → `13.303.50`, entrada en `CHANGELOG.md`.

## Fuera de alcance (Fase 3+)
- Residuos `|| 1` (FIX-11) y `toISOString().slice()` (FIX-12) → Fase 4 junto con FIX-19/20/22.
- Credenciales hardcoded en `scripts/visual-audit/` → Fase 3 (higiene de scripts).
