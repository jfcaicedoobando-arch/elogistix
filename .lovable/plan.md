# Auditoría pre-release: Oleada 0 (bloqueantes) + Oleada 1 (pulido visual)

## Qué confirmé en el código (antes de planear)

- **B-1 real:** `signOut` en `src/lib/contexts/AuthContext.tsx` sólo hace `clearLoginAudit`, bitácora, cierre de sesión y `resetProfile()`. No hay `queryClient.clear()` en el cierre de sesión (sólo existe en `main.tsx` al cambiar versión y en el cambio de organización del super admin). La caché del usuario anterior sobrevive al logout.
- **B-2 real:** `permissionMatrix.ts` incluye `vendedor` para cotizaciones, pero la función SQL `public.puede_escribir_cotizaciones()` (migración `20260813003347…`) sólo admite `admin`, `operador`, `ejecutivo_pricing`, `gerente_comercial`, `super_admin`. El wizard hace INSERT directo, así que un vendedor recibe error de RLS al guardar.

## Oleada 0 — Bloqueantes (primero)

1. **Fuga de datos al cerrar sesión**
   - Limpiar la caché de datos en `signOut` (`queryClient.clear()`), y también cuando entra un usuario distinto al que estaba cacheado (evento de sesión con otro `user.id`).
   - Test unitario: tras `signOut`, la caché queda vacía.

2. **El rol `vendedor` no puede crear cotizaciones**
   - Migración que agrega `vendedor` a `public.puede_escribir_cotizaciones()` (decisión de producto: el vendedor sí debe poder cotizar; la matriz de permisos ya lo asume).
   - Prueba SQL en `supabase/tests/` que verifique que la función acepta exactamente los roles de la matriz, para que la desincronización no regrese.

## Oleada 1 — Pulido visual de alto impacto (esfuerzo S)

Agrupado por tema; todo es frontend/presentación salvo el punto de mojibake.

3. **Contraste WCAG AA** — oscurecer los tokens de estado (`--warning`, `--success`, `--state-*`, `--destructive`) en el CSS global para que pasen AA como texto. Un archivo, afecta cientos de badges.
4. **Toast de error global** — ancho mínimo, rejilla icono | contenido | acciones, un solo toast por error, nunca mostrar nombres de columna crudos (p. ej. `descripcion_mercancia` → "Descripción de la mercancía").
5. **`/sin-acceso`** — variante "no pudimos cargar tu perfil" con botón Reintentar cuando el fallo es de red, y no rebotar rutas públicas.
6. **Moneda** — eliminar duplicados tipo "MXN 460,868.00 MXN", un único formato de negativos, `tabular-nums`; usar el componente de celda monetaria en las tablas ya migradas.
7. **Fechas** — DD/MM/YYYY consistente y corregir la etiqueta de mes desfasada del panel de Profit (formatear desde la clave `YYYY-MM`, sin construir `Date` local).
8. **Copy EN → ES** — "Forwarders", "Mis deals", "Revenue/Profit", "tenant", "soft delete", "Cockpit fiscal", "P&L"; y typos visibles ("Usar esta tarifa esta", "Conciliacion", "0:60", "CIF :", "(s)").
9. **Títulos de pestaña por ruta** — cada pantalla con su `<title>` en español, sin el título de marketing ni "Iniciar sesión" después de entrar.
10. **Estados vacíos** — gráficas con menos de 2 puntos muestran mensaje en vez de ejes vacíos; tablas vacías sin encabezado colgando.
11. **Sidebar** — punto indicador cuando está colapsado y arreglo del corte a 1080 px.
12. **Accesibilidad puntual** — `aria-label` en botones de sólo icono e inputs sin etiqueta; soporte de teclado en tarjetas clicables; descripción en diálogos de alerta.
13. **Tablas** — ocultar paginación con una sola página, encabezado faltante en la columna "Neto", montos sin partirse en dos líneas, `overflow-x-auto` donde falta.
14. **Limpieza** — retirar la ruta de vista previa de PDF en producción, borrar el placeholder muerto, `theme-color` según tema.
15. **Landing / legales** — stat "Minutos" con valor, unificar el conteo de módulos, fecha real en términos.
16. **Wizard de cotización** — validación inline en el campo con scroll al primer error y asterisco visible en los campos que bloquean el avance.
17. **Mojibake en nombres de clientes** — corregir la función de mayúsculas del importador para que respete acentos y re-normalizar los nombres ya guardados; test anti-mojibake.

## Fuera de alcance de este plan

Los majors de dinero (comisiones, guardas de facturas canceladas, idempotencia, EERR/PvsR con IVA, miles con punto) quedan para una Oleada 2 posterior al release, con su propio plan y pruebas.

## Notas técnicas

- Se registra cada bloque en `CHANGELOG.md` con bump de `APP_VERSION`.
- Ejecución por sub-bloques verificables: tipos, lint y pruebas después de cada tema, respetando el límite de 200 líneas por componente y el uso obligatorio de `FormDialogShell` y `docs/design-system.md`.
- El cambio de tokens de color se valida con un check de contraste para evitar regresiones.
