# Cierre de los 5 pendientes de la auditoría (v13.542.0)

Analogía: la casa ya está construida y revisada; falta apretar cinco tornillos que quedaron flojos.

## 1. BL-04 — Traspasos entre monedas (el más importante)

Hoy el frontend manda tipo de cambio `1` por defecto aunque las cuentas sean de monedas distintas:
- `src/features/tesoreria/services/traspasos.ts:33` → `p_tipo_cambio: input.tipoCambio ?? 1`
- `src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx:45` → `tipoCambio: mismoMoneda ? 1 : state.tipoCambio`

Cambios:
- En el servicio, hacer `tipoCambio` obligatorio y validar antes de llamar la RPC: si es `<= 0`, lanzar error en español ("Captura el tipo de cambio del traspaso") en vez de enviar `1`.
- En el diálogo, dejar `1` sólo cuando ambas cuentas comparten moneda; si son distintas y el usuario no capturó tipo de cambio válido, bloquear el botón de guardar y mostrar el aviso en el campo.
- Precargar el tipo de cambio DOF vigente como sugerencia editable cuando las monedas difieren (usando el helper de TC ya existente en tesorería).

## 2. UIA-13 — Toast técnico en descarga de factura

`src/features/facturacion/components/FacturaDownloadButton.tsx:39` muestra `(err as Error).message` (p. ej. "Failed to fetch").
Cambio: mostrar un mensaje accionable en español ("No se pudo descargar el PDF. Revisa tu conexión e inténtalo de nuevo.") y conservar el error técnico sólo en el log/Sentry.

## 3. UX-04 — Labels ligadas al input en `FormField`

`src/components/shared/FormField.tsx` renderiza `<Label>` sin `htmlFor`.
Cambio: generar un id con `useId()`, pasarlo al `Label` vía `htmlFor` y exponerlo al hijo mediante `React.cloneElement`/prop `id` cuando el hijo lo acepte, además de ligar el error con `aria-describedby`.

## 4. UX-08 — Variante de tamaño en `Label`

`src/components/ui/label.tsx` no tiene variantes; hay 92 usos de `<Label className="text-xs">`.
Cambio: agregar `size: { default: "text-sm", sm: "text-xs" }` al `cva` y usar `size="sm"` en los usos nuevos. No se migran los 92 llamados existentes en este paso (cambio cosmético masivo); queda la variante disponible y documentada en `docs/design-system.md`.

## 5. FE-11 — Dirty guard fuera de CxP

`useDirtyGuard` sólo se usa en `src/features/cxp/components/DialogNuevaFacturaProveedor.tsx`.
Cambio: aplicarlo también en el editor de conceptos de cotización y en el wizard de embarque, para que al cerrar con cambios sin guardar pida confirmación.

## Detalles técnicos

- Sin migraciones de base de datos: la RPC `registrar_traspaso_bancario` ya valida el tipo de cambio; sólo se corrige el lado cliente.
- Se respetan las reglas Power of 10 (archivos ≤ 200 líneas, sin `any`).
- Tests: añadir casos para la validación de tipo de cambio en traspasos y para el `htmlFor` de `FormField`.
- Versionado: `APP_VERSION` 13.541.0 → **13.542.0** y entrada nueva en `CHANGELOG.md`.
