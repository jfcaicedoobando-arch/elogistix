# Pack D — Sidebar sticky de progreso + Role gate

Cierre del roadmap del wizard de cotización: hacer visible el avance del Paso 1 mientras el usuario hace scroll, y blindar el atajo destructivo "Cotizar sin desglose" para que sólo los roles autorizados puedan dispararlo.

## D1 — Sidebar sticky de progreso (Paso 1)

### Funcional
- Columna vertical fija a la izquierda del contenido del Paso 1 (desktop ≥ `lg`), `w-56`, sticky `top-4`.
- Lista las 6 secciones (Cliente, Operación, Ruta, Mercancía, Tarifa, Cierre) con icono de estado:
  - **Verde + check**: completa (`usePaso1SectionStatus` ya lo calcula).
  - **Gris + círculo vacío**: pendiente.
  - **Azul + punto activo**: sección actualmente visible en viewport (detectada con `IntersectionObserver`).
- Click en una sección → `scrollIntoView({ behavior: "smooth", block: "start" })` sobre el `WizardSection` correspondiente.
- Footer del sidebar: contador `"3 de 6 completas"` y barra de progreso fina (`Progress` de shadcn).
- En mobile/tablet (`< lg`) se oculta (los checks por sección que ya existen cubren el feedback).
- En Pasos 2, 3, 4 no se renderiza.

### Técnico
- Nuevo `src/features/cotizacion/components/wizard/Paso1ProgressSidebar.tsx` (~120 líneas).
  - Consume `usePaso1SectionStatus()` y un nuevo hook `useActiveSection(ids: string[])` que devuelve el id de la sección actualmente visible (basado en `IntersectionObserver`, cleanup en useEffect).
- `WizardSection` ya existe; añadir prop opcional `id?: string` que se proyecta al `section` raíz para que el observer y el scroll funcionen.
- `PasoDatosGenerales.tsx` pasa ids estables (`cliente`, `operacion`, `ruta`, `mercancia`, `tarifa`, `cierre`) a cada `WizardSection`.
- `CotizacionWizardLayout.tsx`: cuando `currentStep === 1`, envuelve el contenido del paso en un grid `lg:grid-cols-[14rem_1fr] gap-6` y monta `<Paso1ProgressSidebar />` en la columna izquierda.

### Tests
- `usePaso1SectionStatus.test.ts` ya existe; añadir 1 caso de cómputo del contador "completas".
- Smoke manual: scroll por las 6 secciones → indicador azul sigue al viewport; click en "Mercancía" → salta a esa sección.

## D2 — Role gate "Cotizar sin desglose"

### Funcional
- El botón **"Cotizar sin desglose"** (atajo destructivo del Paso 1) deja de mostrarse para roles operativos sin autoridad para tomar la decisión.
- Roles autorizados: `super_admin`, `admin_org`, `admin`, `gerente_operaciones`.
- Roles bloqueados: `coordinador_logistico`, `operador`, `vendedor`, `ejecutivo_pricing`, `contador`, `tesorero`, `gerente_visor`, cualquier otro.
- Si un usuario no autorizado intenta el atajo por URL/teclado, el handler en el wizard también lo bloquea y muestra toast `"Tu rol no autoriza cotizar sin desglose. Pide a un gerente o admin."`.

### Técnico
- `src/hooks/shared/usePermissions.ts`: añadir capability derivada:
  ```ts
  const COTIZAR_SIN_DESGLOSE: readonly AppRole[] = [
    "super_admin", "admin_org", "admin", "gerente_operaciones",
  ];
  // ...
  canCotizarSinDesglose: has(COTIZAR_SIN_DESGLOSE, roleStr),
  ```
- `CotizacionWizardFooter.tsx`: nueva prop `canSkipCostos?: boolean`. Render del botón gated por `showSinDesglose && canSkipCostos`.
- `CotizacionWizardLayout.tsx`: consume `usePermissions().canCotizarSinDesglose`, lo pasa al footer y también al guard en `handleConfirmSinDesglose` (defensa en profundidad). Si gate falla, toast destructivo.
- `usePermissions.test.tsx`: añadir 2 casos (`gerente_operaciones` → true; `vendedor` → false).

## Fuera de alcance
- Gate del botón "Generar embarques" (ya cubierto por RLS y validación de costos del Pack v13.27.0).
- Sticky de progreso para Pasos 2/3/4 (esas pantallas son lineales sin sub-secciones).
- Personalización de columnas/ancho del sidebar por usuario.

## Versionado
- Bump `APP_VERSION` a `13.32.0`.
- Entrada en `CHANGELOG.md` bajo `## [13.32.0] - 2026-06-16` con 2 bullets (sidebar + role gate).

## Pregunta de decisión
Para el role gate, ¿quieres **ocultar** el botón a los roles no autorizados (más limpio, recomendado) u **mostrarlo deshabilitado** con tooltip explicativo (más educativo pero ruidoso)?
- **A.** Ocultar (recomendado).
- **B.** Mostrar deshabilitado con tooltip "Requiere rol de gerencia o admin".
