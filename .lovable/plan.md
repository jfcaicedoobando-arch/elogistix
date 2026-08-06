# Quitar el nombre del banco duplicado en el selector de cuentas

## Problema
En el modal "Registrar anticipo", el selector de cuenta bancaria muestra `BASE USD — BASE (USD)`. Se arma con `alias — banco (moneda)`, y como el alias ya incluye el nombre del banco (p. ej. alias "BASE USD", banco "BASE"), el banco aparece dos veces.

## Solución (solo presentación)
En `src/features/anticipos-proveedor/components/RegistrarAnticipoFields.tsx` (línea ~139), construir la etiqueta con una función auxiliar:

- Si el alias ya contiene el nombre del banco (comparación sin distinguir mayúsculas/acentos), mostrar solo `alias (moneda)`.
- Si no lo contiene, mantener `alias — banco (moneda)`.
- Si no hay alias, mostrar `banco (moneda)`.

Resultado: `BASE USD (USD)` y `BBVA USD (USD)` en lugar del texto repetido.

## Notas técnicas
- Cambio de solo UI; no se toca la consulta ni el servicio de cuentas bancarias.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION` (patch).
