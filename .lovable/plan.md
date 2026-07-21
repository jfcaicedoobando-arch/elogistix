## Problema

1. En el modal "Registrar pago a proveedor" el campo **Monto** es un `<Input type="number">` pelón: no muestra el símbolo `$` ni contexto de moneda, y visualmente parece un campo de cantidad genérico.
2. Todos los `<Input type="number">` de la app muestran las flechitas nativas (spin buttons) del navegador. Ya interceptamos el scroll wheel en `src/components/ui/input.tsx`, pero las flechas siguen ahí y son ruido visual (39 archivos las usan).

## Solución

### Parte 1 — Símbolo `$` en el input de Monto (y el de Tipo de Cambio y Diferencia cambiaria, por consistencia)

En `src/features/cxp/components/PagoProveedorFormBody.tsx`:

- Envolver el input de **Monto** en un contenedor `relative` con un `<span>` absolute-positioned a la izquierda que muestra `$` (color muted). El `<Input>` recibe `pl-7` para que el texto no encime el símbolo.
- Aplicar el mismo patrón al input de **Diferencia cambiaria MXN** (también es dinero).
- El campo **Tipo de cambio** NO lleva `$` (es un ratio, no un monto) — se deja igual.
- Mantener `type="number"` y el flujo actual (`setMonto` sigue recibiendo string). No se cambia lógica, sólo presentación.

Alcance mínimo: sólo este modal. Si más adelante se quiere en otros lugares se replica el patrón, pero el usuario reportó específicamente este.

### Parte 2 — Eliminar spinners de todos los `type="number"` de la app (fix global)

Agregar reglas CSS globales en `src/index.css` para ocultar los spin buttons:

```css
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;   /* Firefox */
  appearance: textfield;
}
```

Esto aplica a los 39 archivos que usan `type="number"` sin tocar ninguno. Los inputs siguen validando como número y aceptando `inputMode="decimal"/"numeric"` para mostrar teclado apropiado en móvil.

### Versión / Changelog

- Bump `APP_VERSION` a `13.303.89`.
- Bullet en `CHANGELOG.md` con analogía breve.

## Verificación

- Abrir el modal en `/compras/facturas` → registrar pago → confirmar que el input muestra `$` a la izquierda y que ya no hay flechitas.
- Revisar visualmente 2–3 pantallas más con `type="number"` (Configuración → Operaciones, Cotización → Tarifa, Comisiones) para confirmar que también perdieron las flechas.

## Fuera de alcance

- No migro los 39 inputs a `NumericInput` (ese componente ya existe y usa `type="text"`, pero migrar todo sería un refactor grande no solicitado).
- No cambio la lógica de captura/validación del monto (sigue siendo string → `Number`).
- No añado formato de miles con comas mientras se escribe (rompería `type="number"`). Sólo el símbolo `$` como prefijo visual.
