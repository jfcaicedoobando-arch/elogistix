## Bloquear cambio de valor con la rueda del mouse en inputs numéricos

### Problema

Los spinners ya están ocultos por CSS, pero el navegador sigue permitiendo cambiar el valor de un `<input type="number">` al girar la rueda del mouse cuando el campo está enfocado. Esto provoca cambios accidentales de montos, cantidades, tasas, etc.

### Causa

Comportamiento nativo del navegador: cualquier `input[type="number"]` con foco intercepta el `wheel` y modifica el valor. No se puede desactivar con CSS.

### Solución (mínima, global)

Parchar el componente base `src/components/ui/input.tsx` (único punto por donde pasan todos los inputs de la app, incluidos los 77 `type="number"` y los que ya usan `NumericInput`) para que, cuando `type === "number"`, se llame a `blur()` en el `onWheel`. Es el patrón estándar recomendado:

```tsx
onWheel={(e) => {
  if (type === "number" && e.currentTarget === document.activeElement) {
    e.currentTarget.blur();
    // re-enfocar en el siguiente tick para no perder la posición del cursor
    setTimeout(() => e.currentTarget?.focus({ preventScroll: true }), 0);
  }
  props.onWheel?.(e);
}}
```

Ventajas:
- Un solo archivo tocado.
- No cambia el tipo del input ni la validación.
- No rompe el scroll de la página (sólo desenfoca momentáneamente).
- Respeta cualquier `onWheel` que un consumidor haya pasado.

### Alternativa considerada (descartada)

`e.preventDefault()` dentro del handler no funciona porque React registra listeners pasivos por defecto en `wheel`; requeriría `addEventListener` manual con `{ passive: false }`. Más ruido por poca ganancia. El patrón de `blur()` es más simple y ampliamente usado.

### Versionado

- `APP_VERSION` → `13.303.31`
- Entrada en `CHANGELOG.md` describiendo el fix.

### Fuera de alcance

- No se migran inputs a `NumericInput`.
- No se toca validación ni RHF.