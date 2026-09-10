# Arreglar la captura y el pegado de fechas

Los usuarios tienen razón: hoy el campo de fecha pelea con ellos. Encontré tres causas concretas en el código del campo (`DatePickerMx`).

## Qué está pasando

1. **El guion no se puede teclear.** Las teclas `-`, `_`, `+` y `=` están tomadas como atajos para subir o bajar un día. Quien escribe `13-03-2026` no captura una fecha: le resta días a la fecha actual.
2. **No se puede escribir encima de una fecha existente.** Al entrar al campo se selecciona sólo el bloque del día. Al teclear el primer número, la máscara reconstruye el texto completo, el cursor salta al final y como el campo tiene un tope de 10 caracteres, los siguientes números se pierden. Resultado: escribir corrido sólo funciona si el campo está vacío.
3. **El pegado sólo funciona con formatos exactos.** Si el texto pegado no coincide con los patrones esperados (`13/3/26`, `2026-03-13 00:00`, fecha con texto extra, valores copiados de Excel con hora), el pegado se deja al navegador, la máscara lo mutila y queda una fecha inválida.

## Qué voy a cambiar

- Quitar `-`, `_`, `+` y `=` como atajos: los separadores se podrán teclear libremente. Subir/bajar seguirá funcionando con las flechas, `Re Pág`/`Av Pág` y `T` para hoy.
- Reescribir la captura para que se pueda teclear corrido siempre, con el campo vacío o con fecha previa: al entrar, el número tecleado empieza una fecha nueva; la máscara mantiene el cursor donde corresponde y ya no se pierden dígitos.
- Hacer el pegado tolerante: se acepta cualquier texto pegado, se le quita la hora y el texto sobrante, se aceptan años de dos dígitos y se admite pegar sólo números (`13032026`). Si de plano no hay una fecha reconocible, el campo lo avisa en lugar de dejar basura.
- Aplicar el mismo criterio de pegado y separadores a los campos de fecha con hora y de periodo (mes/año), que comparten la misma base.

Sin cambios en cálculos, guardado, permisos, base de datos ni reglas fiscales: sólo la captura del campo.

## Detalles técnicos

- `date-picker-mx-atajos.ts`: eliminar los casos `+ = - _` de `resolverAtajo`; conservar flechas, `PageUp/PageDown`, `t/h`.
- `date-picker-mx-helpers.ts`: agregar `parseFlexible` más tolerante (recorte de hora `T`/espacio, año de 2 dígitos con pivote, 8 dígitos corridos) reutilizable por los tres pickers.
- `date-picker-mx-valor.ts`: `handleChange` calcula el texto enmascarado y restaura el caret por cuenta de dígitos (nuevo helper puro `caretTrasMascara`); si la selección cubre un segmento, el dígito reinicia la captura en lugar de re-normalizar el texto completo. `handlePaste` siempre hace `preventDefault`, usa `parseFlexible` y, si falla, marca inválido.
- `date-picker-mx.tsx`: quitar `maxLength={10}` (la máscara ya limita) y evitar reseleccionar segmento en `onClick` cuando el usuario está arrastrando selección.
- `date-time-picker-mx-valor.ts` y `month-picker-mx-valor.ts`: agregar `handlePaste` equivalente y usar los helpers compartidos.
- Pruebas focalizadas nuevas/ampliadas en `src/components/ui/__tests__/`: teclear `13-03-2026`, teclear corrido sobre fecha existente, pegar `2026-03-13T10:00`, `13/3/26`, `13032026` y texto no reconocible.
- Validación local: typecheck, ESLint focalizado, pruebas de los pickers, build, `audit:manifest`, `APP_VERSION` + `CHANGELOG.md`. CI, RLS y E2E completos quedan para GitHub Actions.
