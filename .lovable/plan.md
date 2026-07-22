## Diagnóstico

En el embarque `c996fa28…` el guardado falló porque una fila de contenedor tenía **Número = "1"**. La base de datos exige que el número siga el estándar **ISO 6346** (4 letras mayúsculas + 7 dígitos, ej. `MSCU1234567`) o quede vacío. El valor `"1"` no cumple y el check `contenedor_iso6346` bloquea el INSERT.

**Analogía**: es como si en la caja de un supermercado el código de barras tuviera que ser de 11 caracteres exactos. Si tecleas solo `1`, el lector lo rechaza. Hoy el "lector" (la BD) sí rechaza, pero el formulario deja escribir cualquier cosa y solo te avisa al final con un error técnico feo.

## Alcance

Cambios sólo de **frontend** (UI + validación del formulario). No se toca la BD ni edge functions ni lógica de negocio del embarque.

## Qué se va a construir

1. **Validación en vivo en `FilaContenedor.tsx`**
   - Autoconvertir a mayúsculas y quitar espacios al escribir.
   - Marcar el input en rojo y mostrar mensaje inline: *"Formato ISO 6346: 4 letras + 7 dígitos (ej. MSCU1234567). Déjalo vacío si aún no lo asignan."* cuando el valor no esté vacío y no cumpla el patrón `^[A-Z]{4}[0-9]{7}$`.
   - `aria-invalid` para accesibilidad.

2. **Bloqueo del wizard en `useEditarEmbarqueWizard.helpers.ts` (`validarContenedoresMaritimo`)**
   - Además de exigir tipo, si algún `numero_contenedor` está lleno pero no cumple ISO 6346, devolver un error que reabra el paso 2 con mensaje claro.
   - Mismo chequeo en el flujo de creación (`useEmbarqueSubmitOrchestrator`) para simetría.

3. **Mensaje amistoso cuando la BD devuelva `contenedor_iso6346`**
   - En el mapper de errores de guardado del embarque, si el código Postgres es `23514` y el `constraint = contenedor_iso6346`, mostrar el mismo texto guía en vez del volcado técnico.

## Detalles técnicos

- Patrón único centralizado en un helper `esNumeroContenedorValido(v: string): boolean` dentro de `src/features/embarques/domain/contenedorIso6346.ts` (nuevo, ~15 líneas) reutilizado por la fila, la validación del wizard y los tests.
- Test unitario del helper (casos: vacío ✅, `MSCU1234567` ✅, `1` ❌, `mscu1234567` ❌ salvo que se normalice antes).
- Test del helper `validarContenedoresMaritimo` extendido con caso de número inválido.
- Bump `APP_VERSION` a `13.307.6+1` y entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se elimina ni relaja la CHECK constraint (es útil como red de seguridad).
- No se autocompleta el número desde ningún otro campo — sigue siendo captura manual.
