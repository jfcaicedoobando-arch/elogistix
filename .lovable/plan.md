## Hallazgo: no hay trabajo adicional que hacer

Audité toda la carpeta `src/` buscando otros lugares donde se rendericen inputs numéricos:

- **`<input type="number">` crudo (HTML nativo, sin pasar por el componente base):** 0 coincidencias.
- **Componentes wrapper propios tipo `NumberInput` / `CurrencyInput` / `InputNumber`:** no existen en el proyecto.
- **Uso de `<Input type="number" ... />` (el componente shadcn `@/components/ui/input`):** 43 archivos (embarques, cotización, facturación, CxP, costeo, CRM, admin, tesorería, presupuesto, comisiones, etc.).

Los 43 archivos ya usan el `Input` base que parchamos en `v13.303.32`, así que **automáticamente heredan** los tres comportamientos:

1. La rueda del mouse no cambia el valor.
2. Al enfocar un campo con `0`, se limpia para que el usuario escriba directo.
3. Al salir del campo vacío, se restaura `0`.

## Acción propuesta

Ninguna edición de código. Cerrar el hilo confirmando que la cobertura ya es global desde el componente base.

Si en algún momento se agrega un `<input type="number">` fuera del `Input` base, la regla de arquitectura a seguir es: **siempre usar `@/components/ui/input`** (nunca `<input>` HTML pelón) para heredar estos comportamientos y el estilo del sistema.

## Verificación opcional

Puedo agregar un test de arquitectura (`architecture-baseline.test.ts`) que falle si alguien introduce `<input type="number"` crudo en `src/`. Dime si lo quieres y lo incluyo.
