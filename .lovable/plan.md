## Siguiente paso: E2E responsive de modales/wizards

Los specs 13-16 ya cubren **listas, detalle, navegación y AlertDialogs destructivos** en 768×1024 y 1440×900. Lo que aún no está cubierto por E2E son los **modales de captura tipo formulario** (`FormDialogShell`), que fue justamente el punto marcado como pendiente en `.lovable/plan.md` bajo "Grupo E · Detalles y modales".

### Qué falta validar

Los modales que abren formularios largos son los que más riesgo de overflow tienen en tableta (footer sticky, stepper, campos apilados):

1. **Nuevo Cliente** (`/clientes` → botón "Nuevo cliente")
2. **Nuevo Proveedor** (`/proveedores` → botón "Nuevo proveedor")
3. **Nueva Cotización — wizard** (`/cotizaciones` → "Nueva cotización")
4. **Capturar Factura CxP** (`/cxp` → "Capturar factura")

Checklist por modal (mismo patrón que specs 13-16):
- Se abre desde el botón trigger y renderiza dentro de `role="dialog"`.
- Título, primer campo y footer visibles sin scroll adicional del documento.
- `max-h-[85vh]` respetado: el contenido interno hace scroll, `<main>` no.
- Sin overflow horizontal (`scrollWidth - clientWidth ≤ 1`) en dialog ni en main.
- En wizards con stepper: al menos el paso 1 hidrata sin errores y el botón "Siguiente" está accesible.
- Cierre con Cancelar / Escape restaura foco al botón que lo abrió.
- Cero `console.error`.

Se prueba en **dos viewports**: 768×1024 (tableta) y 1440×900 (desktop xl+).
**No** se envía ningún formulario — sólo apertura, medición y cierre.

### Nuevo spec

`e2e/specs/17-modales-captura-responsive.spec.ts`

Estructura idéntica a los specs 13-16:
- Loop `for (const vp of VIEWPORTS)`.
- Helper local `assertNoDialogOverflow(dialog)` + reutilización del patrón `assertNoOverflow(page)`.
- Un `test()` por modal (4 tests × 2 viewports = 8 casos).
- Login con `internalCreds()` + `storageState` del `globalSetup`, project `chromium-internal`. Sin cambios en `playwright.config.ts` ni en CI.

### Método técnico

Para cada modal:

```text
1. loginAs(page, internalCreds())
2. page.goto("/<ruta>")
3. esperar tabla lista (evita medir mientras hidrata)
4. click en el botón trigger  → getByRole("button", { name: /nuev[oa]|capturar/i })
5. dialog = getByRole("dialog") — esperar visible
6. medir overflow del dialog y de <main>
7. verificar heading + primer input + footer visibles
8. cerrar con Escape → dialog oculto → foco vuelve al trigger
9. sin console.error
```

Fallback si un botón no se resuelve por nombre: usar `data-testid` existente o el `aria-label` del trigger — inspeccionar en la primera corrida y ajustar.

### Fuera de alcance (para no crecer el spec)

- Enviar los formularios (crear registros reales).
- Wizards multi-paso completos (sólo se valida el paso 1).
- Portal cliente/agente y `/admin/*`.
- Otros modales secundarios (Duplicar embarque, Compartir tracking, etc.) — se pueden añadir después si algún viewport lo requiere.

### Entregable

- `e2e/specs/17-modales-captura-responsive.spec.ts` nuevo.
- Bump `APP_VERSION` → `13.172.10`.
- Entrada `CHANGELOG.md` con el detalle de los 4 modales cubiertos y los 2 viewports.
- Corrida local del spec (headless chromium) confirmando los 8 casos en verde antes de dar por cerrada la iteración.

### Riesgos y mitigación

- **Trigger no encontrado por rol/nombre**: usar `data-testid` como fallback o ajustar el regex tras primera corrida.
- **Modal cambia foco tras cerrar (Radix Dialog vs AlertDialog)**: `Dialog` también restaura foco al trigger; si algún modal usa un patrón custom, se documenta y se relaja esa aserción para ese caso concreto.
- **Datos requeridos para abrir wizard de cotización**: sólo se abre el modal, no se envía; no requiere data seed.
