# Plan: Migrar todo el sistema de toasts a Sonner

## Contexto actual

Hoy conviven **dos sistemas**:

- **shadcn toast (canónico)** — `useToast()` de `@/hooks/shared`, `Toaster` custom en `components/ui/toaster.tsx`, variantes `success` / `warning` / `destructive`, y el flujo rico `notifyError → ErrorReport → ErrorDetailsDialog` con botón "Ver detalles" copiable. Usado en ~69 archivos (embarques, cotizaciones, facturación, proformas, clientes, proveedores, configuración, catálogos, portal).
- **sonner** — `import { toast } from "sonner"` directo en ~13 archivos (CRM, auditoría, `ErrorDetailsDialog`, `crmToast.ts`, `useUndoToast.ts`).

El wrapper `appFeedback.ts` ya está diseñado con firma laxa (`AnyToastFn`) que acepta ambos, pero la mayoría de call sites pasan `toast` de shadcn obtenido vía `const { toast } = useToast()`.

## Objetivo

Una sola vía: **sonner** en todo el proyecto, conservando el flujo de "Ver detalles del error" copiable (`ErrorReport` + `ErrorDetailsDialog`).

---

## Qué implica (alcance del cambio)

### 1. Reescribir `appFeedback.ts` para emitir con sonner

Reemplazar el `toast({ title, description, variant, debug })` de shadcn por la API de sonner:

```ts
// notifyError
sonnerToast.error(title, {
  description,
  duration: Infinity,           // persistente porque tiene debug
  action: debug ? {
    label: "Ver detalles",
    onClick: () => openErrorReport(debug),
  } : undefined,
  onDismiss: () => {},
});
// notifySuccess → sonnerToast.success(title, { description, duration: 3000 })
// notifyWarning → sonnerToast.warning(title, { description })
```

Las firmas públicas (`notifyError(toast, opts)`) se mantienen por compatibilidad pero ignoran el primer parámetro `toast` (o se simplifican a `notifyError(opts)` en una segunda pasada). Para no tocar 60+ archivos en un solo PR, **mantenemos la firma con `toast` ignorado** y el internamente usa el `toast` importado de sonner.

### 2. Eliminar el stack shadcn toast

- Borrar `src/hooks/shared/useToast.ts` y removerlo del barrel `src/hooks/shared/index.ts`.
- Borrar `src/components/ui/toast.tsx` y `src/components/ui/toaster.tsx`.
- En `App.tsx` / root: dejar **solo** `<Toaster />` de sonner (de `@/components/ui/sonner`), eliminar el shadcn `<Toaster />`.
- Configurar el `<Toaster />` de sonner con: `richColors`, `position="top-right"`, `closeButton`, y theming acorde a tokens (mediante CSS vars sonner expone).

### 3. Reemplazar todos los `useToast()` directos

~9 call sites usan `toast({...})` directo (no vía `notifyError`). Migrarlos a `sonnerToast.success/error/warning/info` o a los helpers `notifySuccess/notifyError`.

Todos los `const { toast } = useToast()` que sólo se usan para pasar a `notifyError(toast, ...)` se eliminan (ya no se necesita el argumento).

### 4. Mantener `ErrorDetailsDialog` y `errorDetailsStore`

No cambian. Sonner soporta `action` con callback, así que el botón "Ver detalles" sigue abriendo el diálogo global vía `openErrorReport(debug)`. Hay que montar `<ErrorDetailsDialog />` una sola vez en el root (ya está).

### 5. Unificar wrappers locales

- `crmToast.ts` → ya usa sonner, se queda igual (o se elimina y se usa `notifySuccess` directo si queremos un único helper).
- `useUndoToast.ts` → ya usa sonner, se queda.

### 6. Theming / variantes

Sonner no tiene `variant: "warning"` nativo en versiones viejas; la versión actual sí (`toast.warning`). Verificar versión instalada y, si falta, mapear a `toast(message, { className: "..." })` con clases tokens del design system. Los colores HSL del proyecto se aplican vía `toastOptions.classNames` en el `<Toaster />`.

### 7. Tests

Actualizar `src/lib/ui/__tests__/appFeedback.test.ts` para mockear sonner en vez de un toast mock genérico.

### 8. Changelog + versión

Bump `APP_VERSION` minor y entrada en `CHANGELOG.md` ("Unificación de sistema de notificaciones a Sonner").

---

## Qué ganamos

1. **Una sola API** — fin de la confusión "¿uso `useToast` o sonner?". Onboarding más simple.
2. **Menos código mantenido** — borramos `useToast.ts` (~180 líneas), `toast.tsx`, `toaster.tsx`, y reducimos `appFeedback.ts`.
3. **Mejor UX out-of-the-box** — sonner ya trae stacking inteligente, swipe-to-dismiss, animaciones suaves, agrupación de toasts duplicados, promesas (`toast.promise`).
4. **Sin `<ToastProvider>` ni viewport** — sonner se monta con un solo `<Toaster />`.
5. **Mejor portabilidad** — el sistema queda alineado con la plantilla moderna de Lovable (que sólo trae sonner), facilitando copiar a otros proyectos.
6. **API más concisa** — `toast.success("Guardado")` vs `toast({ title: "Guardado", variant: "success" })`.

## Qué perdemos / riesgos

1. **Control total de markup** — el toast deja de ser un componente shadcn editable. Si en el futuro queremos un toast con layout muy custom (ej. progress bar, mini-form), hay que usar `toast.custom(jsx)`, que funciona pero es menos directo que editar `toast.tsx`.
2. **Variantes tipadas estrictas** — perdemos el `cva` con variantes shadcn. Se reemplaza por `toastOptions.classNames` en el `<Toaster />`, que es menos estricto en tipos.
3. **Migración masiva** — ~69 archivos tocados. Aunque el wrapper `notifyError/notifySuccess` absorbe la mayoría sin cambios, los ~9 `toast({...})` directos y todos los `const { toast } = useToast()` deben revisarse a mano.
4. **Posible regresión visual** — el look-and-feel cambia (sonner stackea distinto, posición/animación diferente). Hay que afinar el `<Toaster />` con classNames para mantener identidad visual (colores HSL del design system, bordes, sombras).
5. **Pruebas a actualizar** — cualquier test que importe `useToast` o haga assertions sobre el shadcn toast hay que reescribirlo con el mock de sonner.
6. **Toasts persistentes con acción** — sonner sí soporta `duration: Infinity` + `action`, pero el comportamiento de click-en-toda-la-tarjeta (que hoy abre el dialog) cambia: en sonner sólo el botón `action` dispara el callback. Aceptable, pero es un cambio de UX sutil.

---

## Fases sugeridas (PRs incrementales)

### Fase 1 — Infraestructura (1 PR)

- Reescribir `appFeedback.ts` para emitir vía sonner internamente, manteniendo firma `notifyError(toast, opts)`.
- Asegurar `<Toaster />` de sonner montado en root con theming.
- Actualizar tests de `appFeedback`.
- **Resultado:** todos los `notifyError/Success/Warning` ya emiten sonner sin tocar call sites.

### Fase 2 — Migrar call sites de `toast({...})` directo (1 PR)

- Buscar `rg "toast\(\{" src` (~9 archivos) y convertir a `notifySuccess` o `sonnerToast.*`.

### Fase 3 — Eliminar stack shadcn (1 PR)

- Cambiar firma de helpers a `notifyError(opts)` sin `toast`.
- Borrar `useToast`, `toast.tsx`, `toaster.tsx`.
- Limpiar imports en los ~69 archivos (codemod con `rg --replace` o ts-morph).
- Quitar `<Toaster />` shadcn del root.

### Fase 4 — Pulido (1 PR)

- Unificar `crmToast.ts` con `notifySuccess` si conviene (o documentar que se mantiene por verbosidad mínima en CRM).
- Verificar que `ErrorDetailsDialog` sigue abriéndose desde el `action` de sonner.
- QA visual de cada tipo de toast (success, error con detalles, warning, undo).

---

## Detalles técnicos

**Versión sonner:** verificar `package.json`. Si <1.4 no hay `toast.warning`, hay que upgradear.

**Theming sonner con tokens HSL:**

```tsx
<Toaster
  position="top-right"
  toastOptions={{
    classNames: {
      toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
      description: "group-[.toast]:text-muted-foreground",
      actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
      cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
      error: "group-[.toaster]:border-destructive",
      success: "group-[.toaster]:border-success",
      warning: "group-[.toaster]:border-warning",
    },
  }}
/>
```

**Patrón para mantener "Ver detalles":**

```ts
sonnerToast.error(title, {
  description,
  duration: Infinity,
  action: { label: "Ver detalles", onClick: () => openErrorReport(debug) },
});
```

**Codemod sugerido para Fase 3:**

```bash
# Eliminar imports y desestructuración
rg -l 'from "@/hooks/shared"' src | xargs sed -i \
  -e '/const { toast } = useToast()/d' \
  -e 's/, useToast//; s/useToast, //; s/{ useToast }//'
```

(revisión manual obligatoria — algunos archivos importan otras cosas del barrel).

---

## Estimación

- Fase 1: ~1h (núcleo + tests).
- Fase 2: ~30min (9 archivos).
- Fase 3: ~2h (codemod + revisión de 69 archivos + borrado).
- Fase 4: ~30min QA.
- **Total: ~4h** de trabajo enfocado.

## Recomendación

Hacer las 4 fases en commits separados pero en la misma sesión, para no dejar el repo en estado mixto largo tiempo. Verifica si se puede hacer con agentes en paralelo o si tiene que ser uno despues del otro. 