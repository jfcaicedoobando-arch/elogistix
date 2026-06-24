## Problema

En el modal de Nueva tarifa (`/agente/tarifas`), al dar click en **Guardar tarifa** no pasa nada y no aparece toast.

## Causa raíz

`TarifaForm.tsx` calcula la validez así:

```ts
const baseValido = esFormValido(form);              // exige form.ruta_id ≠ ""
const valido = multiple ? baseValido && rutaIds.length > 0 : baseValido;
```

En modo creación (`multiple = true`) la(s) ruta(s) se capturan en el estado aparte `rutaIds` (multi-select), y `form.ruta_id` **siempre queda vacío**. Como `esFormValido` exige `form.ruta_id` no vacío, `baseValido` es `false`, `valido` es `false`, y `guardar()` hace `return` silencioso antes de llamar la mutación — por eso no hay toast ni error.

Adicionalmente, al marcar `intentoEnvio = true` sí se pintan errores en los campos, pero el usuario reporta que tampoco ve indicación clara de qué falta porque el campo "ruta" sí está lleno desde su punto de vista.

## Fix propuesto

Un único cambio acotado en `src/features/costeo/components/TarifaForm.tsx`:

1. Hacer que `esFormValido` reciba un flag `skipRutaId` (o exponer un helper alterno) para que en modo `multiple` no exija `form.ruta_id`.
2. Reemplazar el cálculo de `valido` por:
   ```ts
   const baseValido = esFormValido(form, { skipRutaId: multiple });
   const valido = multiple ? baseValido && rutaIds.length > 0 : baseValido;
   ```
3. Aplicar el mismo flag en `calcularErrores` para que la celda `ruta_id` no se marque roja basándose en `form.ruta_id` cuando es multi (ya usa `rutaIdsCount === 0` para multi, así está bien — no se toca).

Sin cambios de UI, sin cambios de business logic, sin tocar mutaciones ni servicios.

## Riesgo

Muy bajo: sólo cambia la condición de habilitar el botón Guardar en modo creación. El modo edición (`multiple = false`) sigue exigiendo `form.ruta_id` como antes.

## Versionado

- `APP_VERSION` → `13.135.40`
- Entrada nueva en `CHANGELOG.md`

## Verificación

Reproducir el flujo: abrir Nueva tarifa, llenar agente/naviera/ruta(s)/contenedor/flete base, click Guardar → debe disparar `crear`/`crearMultiples` y mostrar toast de éxito/error.
