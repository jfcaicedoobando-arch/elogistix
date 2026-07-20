## Problema

En los `<input type="number">` de la app, cuando el valor es `0` y el usuario hace clic para escribir, el `0` no desaparece. Resultado: si teclean `5`, queda `05` (o el navegador lo interpreta raro), en lugar de `5`.

Analogía: es como una calculadora donde no se borra el `0` inicial al empezar a teclear — molesto y propenso a errores.

## Solución

Parchear el componente base `src/components/ui/input.tsx` (mismo archivo que ya intercepta el `wheel`) para agregar un handler `onFocus` que:

1. Solo actúa cuando `type === "number"`.
2. Si el valor actual es `"0"` (o `0`), lo limpia a `""` y dispara el evento `change` nativo para que React Hook Form / estado controlado se entere.
3. Además, en `onBlur`, si el campo queda vacío, restaura `"0"` para no romper validaciones/cálculos que asumen número.

Con esto:
- Click en un campo con `0` → se vacía, el usuario teclea `1500` y queda `1500`.
- Si sale del campo sin escribir nada → vuelve a `0` automáticamente.
- Aplica globalmente a todos los inputs numéricos (peso, volumen, piezas, tarifas, etc.) sin tocar cada formulario.

## Archivos

- `src/components/ui/input.tsx` — agregar handlers `onFocus`/`onBlur` respetando los que ya vengan por props.
- `CHANGELOG.md` + `APP_VERSION` → `13.303.32`.

## Verificación

- Playwright a 1280×1800 en `/embarques/.../editar`: click en Peso (kg) con valor `0`, escribir `1500`, screenshot confirma `1500`. Blur en campo vacío → vuelve a `0`.
- Lint + typecheck automáticos del CI.
