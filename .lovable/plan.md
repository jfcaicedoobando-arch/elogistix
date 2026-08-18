# Paquete de pulido UI/UX: UI-07, UI-08, UX-15, UX-16

Cuatro parches pequeños de consistencia visual y de feedback. Ninguno cambia lógica de negocio, datos ni permisos. Verifiqué en el código que los cuatro siguen sin aplicar y que los componentes y hooks compartidos que necesitan ya existen.

## 1. UI-07 — Spinners de pantalla completa → skeletons

Hoy `HomeRoute` (guard de sesión y fallback de la landing) y `Onboarding` (guard de carga) muestran un spinner `Loader2` solo, centrado. Se cambian por `PageSkeleton` (ya existe en `src/components/shared/skeletons/`), acotado a `max-w-3xl` dentro del mismo contenedor centrado. Se elimina el import de `Loader2` donde queda sin uso.

Resultado: la espera se percibe como "la página ya está llegando" en lugar de un disco girando.

## 2. UI-08 — Wrapper ad-hoc → `PageContainer` en Nueva Cotización

En `NuevaCotizacion.tsx` el banner de "restaurar borrador" vive en un `<div className="max-w-6xl mx-auto pt-4">` hecho a mano. Se reemplaza por `<PageContainer noSpacing className="max-w-6xl pt-4">`, que es el estándar del proyecto y agrega el padding lateral responsivo (mejora en móvil, neutro en escritorio).

Fuera de alcance, ya verificado: `NuevoEmbarque` no tiene wrapper propio (usa `WizardShell`, que dibuja su propio encabezado y altura fija; envolverlo rompería el layout), y `EditarEmbarque` / `EditarCotizacion` ya usan `PageContainer`.

## 3. UX-15 — Título de pestaña del navegador

`Cartera`, `Reportes` y `Tesorería · Pagos` no fijan el título del documento, así que la pestaña queda con el título genérico. Se agrega `useDocumentTitle` (mismo patrón que `AdminDashboard`) con los textos: "Cartera", "Reportes", "Tesorería · Pagos".

## 4. UX-16 — Botón "Agregar" en Navieras

En `TabNavieras` el botón "Agregar" está habilitado aunque falten Código o Nombre: el clic no hacía nada y sin aviso. Se deshabilita cuando cualquiera de los dos campos está vacío, conservando la validación existente del handler como red de seguridad.

## Detalles técnicos

- Archivos: `src/features/marketing/routes/HomeRoute.tsx`, `src/features/onboarding/routes/Onboarding.tsx`, `src/features/cotizacion/routes/NuevaCotizacion.tsx`, `src/features/bandejas/routes/Cartera.tsx`, `src/features/reportes/routes/Reportes.tsx`, `src/features/tesoreria/routes/TesoreriaPagos.tsx`, `src/features/configuracion/components/TabNavieras.tsx`.
- No se editan componentes compartidos (`PageSkeleton`, `PageContainer`, `WizardShell`): solo se importan.
- Solo tokens semánticos, sin colores literales.
- Cierre: `bunx tsgo --noEmit`, suites de arquitectura relevantes, entrada en `CHANGELOG.md` y bump de `APP_VERSION` a 13.655.0.
