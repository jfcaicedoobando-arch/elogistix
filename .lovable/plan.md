# Patch 2 — UX de feedback y errores (revisado contra el código actual)

Revisé los 6 fixes del parche contra el estado real del repo. Tres ya están resueltos (algunos con una solución mejor que la del parche), tres aplican, y uno lo aplico con un ajuste para no empeorar el resto de las pantallas.

## Ya resuelto — no se toca

- **FIX 1 (VB-03, layout del toast):** `src/components/ui/sonner.tsx` ya usa una rejilla `!grid !grid-cols-[auto_1fr] !items-start !gap-x-3` con `!min-w-[360px]`. El parche propone `flex-wrap` + `basis`, que sustituiría la rejilla actual por una solución equivalente pero más frágil. Se conserva lo que hay.
- **FIX 2b (nombre de campo crudo en validaciones):** `parseOrThrow` en `src/lib/validation/mutationSchemas.ts` ya detecta si el mensaje trae etiqueta humana y, si no, usa `getFieldLabel(path)` — mejor que el parche, que sólo elimina el path.
- **FIX 3 (VB-02/VT-01, `/sin-acceso` con copy falso):** ya está completo: `useAuthProfile` expone `profileError`, `AuthContext` lo publica, `ProtectedRoute` manda `motivo: "error-carga"` y `SinAcceso` tiene la variante con botón "Reintentar" que llama `refreshProfile()`.

## Qué se va a aplicar

### 1. Doble toast al guardar en el wizard de cotización (FIX 2a)
Los hooks de crear/actualizar cotización avisan el error por su cuenta y además lo hace el handler del wizard, así que el usuario ve dos toasts del mismo problema (uno con copy genérico). Los hooks pasarán a modo silencioso para que quede un solo aviso: el del wizard, que además hace scroll a la sección con el error.

### 2. Bloqueo total de la app cuando falla la carga del perfil (FIX 4, VT-03)
Hoy la página pública de inicio manda a `/sin-acceso` a cualquier usuario con sesión y sin rol resuelto, incluso cuando el rol no cargó por un problema de red: el usuario queda sin ninguna pantalla útil. La redirección sólo ocurrirá cuando el perfil realmente resolvió; con perfil en error se muestra la landing pública normal. Las rutas protegidas siguen cerradas (con la pantalla de reintento del FIX 3 ya existente).

### 3. "Ver detalles" no muestra nada (FIX 6, VF-02/VT-02)
Dos causas:
- **Capas:** el contenedor de toasts va forzado en `z-[60]` y los diálogos en `z-50`, así que con varios toasts de error encolados el diálogo de detalles abría por debajo. `DialogContent` aceptará un `overlayClassName` opcional (compatible hacia atrás) y el diálogo de detalles subirá a `z-[70]`, contenido y fondo.
- **Botón sin contenido:** en validaciones de captura ("Selecciona un cliente") no hay detalle técnico y el botón se siente roto. Sólo se adjuntará "Ver detalles" cuando exista detalle real, usando el helper `shouldAttachDetails` que ya existe.

### 4. Toast encima del stepper del wizard (FIX 5, VB-35) — con ajuste
El parche sube el margen superior del toast de `72px` a `168px`. Ese valor es global (hay un solo Toaster) y en pantallas normales dejaría el aviso flotando muy abajo, lejos del punto de acción. Propuesta: subirlo a `112px`, que ya libera el bloque de título del wizard, y además darle al indicador de pasos un poco de aire a la derecha en pantallas anchas para que la etiqueta "Resumen" no quede debajo del toast. Si prefieres el valor literal del parche (168px), lo cambio.

## Detalles técnicos

- `src/features/cotizacion/hooks/mutations/useCotizacionMutations.ts`: `silent: true` en `useCreateCotizacion` / `useUpdateCotizacion` (ninguno define `successTitle`, así que no se pierde ningún toast de éxito).
- `src/features/marketing/routes/HomeRoute.tsx`: leer `profileError` de `useAuth()` y condicionar el `<Navigate>` a `user && !profileError`.
- `src/components/ui/dialog.tsx`: prop opcional `overlayClassName` pasada a `<DialogOverlay>`.
- `src/components/ui/ErrorDetailsDialog.tsx`: `cn(dialogSize["3xl"], "z-[70]")` + `overlayClassName="z-[70]"`.
- `src/lib/ui/appFeedback.ts`: en `notifyError`, adjuntar la acción de detalles sólo si `shouldAttachDetails(opts)`; se conserva el fallback a `cancel` cuando ya hay acción primaria.
- `src/components/ui/sonner.tsx`: `offset.top` `72px` → `112px`.
- Pruebas: unitarias para `notifyError` (sin detalle → sin botón; con `error` → con botón) y para `HomeRoute` con `profileError`.
- `CHANGELOG.md` + `APP_VERSION` → `13.632.0`.
