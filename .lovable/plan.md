
# Plan v11.51 — Cierre de pendientes anti-fricción

## Contexto

Tras revisar el código vivo, varios pendientes del plan v11.50 **ya están implementados**:

- ✅ `OportunidadDetalleContent` ya tiene 3 tabs (Resumen / Comunicación / Trazabilidad), no 5.
- ✅ `ActividadRowActions` ya permite completar inline + posponer con menú rápido.

Quedan **3 pendientes reales** del plan anterior, más una mejora de consistencia.

---

## Alcance v11.51

### 1. Conversión Lead → Oportunidad sin navegación (Sheet)

**Hoy:** `ConvertirLeadDialog` es un `Dialog` modal grande con varios campos y, al confirmar, navega a `/crm/oportunidades/:id` (se pierde el contexto del lead).

**Cambio:**
- Crear `ConvertirLeadSheet.tsx` (variante `Sheet` lateral) con **solo 3 campos**: nombre de oportunidad (prefilled), monto estimado, modo. Checkbox "Crear cliente" colapsable.
- Al confirmar: ejecutar conversión, mostrar toast con acción **"Abrir oportunidad →"** y **quedarse en `/crm/leads/:id`** (el lead ya pasa a estado convertido y la card muestra los IDs resultantes — ya existe esa lógica).
- "Más campos →" sigue abriendo el `ConvertirLeadDialog` actual.
- Reemplazar en `LeadHeaderActions.tsx` el trigger actual por el nuevo Sheet.

### 2. Notas inline de actividad (Sheet ligero)

**Hoy:** completar actividad NO pide notas (bien), pero si el vendedor quiere añadir resultado/notas tiene que abrir la actividad completa.

**Cambio:**
- Añadir un tercer botón en `ActividadRowActions`: ícono "lápiz" → abre `ActividadNotasSheet` (Sheet derecho) con un solo `Textarea` de "Resultado / notas" y botón Guardar.
- Hook nuevo `useActualizarActividadNotas` (mutation pequeña que hace `update` sobre `crm_actividades.notas` o campo equivalente — verificar nombre real en types.ts antes de implementar).

### 3. Toasts silenciados y consistentes

**Hoy:** Se usa `notifySuccess(toast, {...})` en todo el CRM. Genera toasts shadcn tipo "card" con título + descripción, persisten ~5s, ocupan mucho espacio.

**Cambio:**
- Crear `src/lib/crm/crmToast.ts` con helpers `crmToast.success(msg)`, `crmToast.error(msg, err?)`, `crmToast.undo(msg, onUndo)` — todos usando `sonner` directamente con `duration: 2000` y posición `bottom-right`.
- Refactor superficial en el módulo CRM (`src/pages/crm/**`, `src/components/crm/**`, `src/hooks/crm/**`): reemplazar `notifySuccess(toast, { title: X })` → `crmToast.success(X)`.
- **NO tocar** `notifyError` con `error/context/step` (se conservan para flujos con panel de debug copiable — embarques, wizard, etc.). Sólo migrar los success/info simples del CRM.
- Mantener `showUndoToast` (ya usa sonner) y unificarlo dentro de `crmToast.undo`.

### 4. Verificación / cleanup

- Confirmar que `OportunidadDetalleContent` no tiene tabs muertas referenciadas en otro lado.
- Eliminar `OportunidadGanadaBanner` import si quedó huérfano tras consolidación (verificar primero).

---

## Detalles técnicos

**Archivos nuevos**
- `src/components/crm/ConvertirLeadSheet.tsx` (~150 líneas, usa `Sheet` de shadcn)
- `src/components/crm/actividades/ActividadNotasSheet.tsx`
- `src/hooks/crm/useActualizarActividadNotas.ts`
- `src/lib/crm/crmToast.ts`

**Archivos modificados**
- `src/components/crm/leadDetalle/LeadHeaderActions.tsx` — usar Sheet nuevo
- `src/components/crm/ActividadRowActions.tsx` — añadir botón notas
- `src/hooks/crm/useUndoToast.ts` — reexportar desde `crmToast` o consolidar
- ~15-20 archivos del módulo CRM para migrar `notifySuccess` → `crmToast.success`
- `src/hooks/crm/index.ts` — exportar nuevo hook
- `src/constants/appVersion.ts` → `11.51.0`
- `CHANGELOG.md` — entrada nueva
- `src/pages/Changelog.tsx` — nueva entrada al inicio del array

**Fuera de alcance (decidir después)**
- Permisos/ownership por vendedor
- Importación CSV de leads
- Razones de pérdida tipificadas
- Notificaciones push/email
- Integración Oportunidad ganada → embarque automático
- Reasignación masiva
- Métricas por vendedor en Analítica

Estos los abordamos en v11.52+ una vez que decidas cuáles son must-have para abrir al equipo.

---

## Resultado esperado

Al terminar v11.51, los 4 pendientes del plan anterior quedan cerrados y el CRM está listo para un **piloto controlado** (2 vendedores, 1 semana) mientras decidimos los gaps funcionales reales.
