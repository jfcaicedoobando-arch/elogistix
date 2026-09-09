# Mejorar acomodo visual de la tarjeta "Moneda detectada por la IA"

## Problema

En `src/features/cxp/components/MonedaDetectadaIaCard.tsx` (paso 1 del buzón de compras) el contenido se ve descuadrado:

- La columna "Tipo de cambio" tiene su rótulo compartiendo renglón con el botón "Obtener DOF" (`flex justify-between`), mientras la columna "Moneda" sólo tiene rótulo: los dos campos quedan a alturas distintas y el botón queda apretado en anchos medios.
- Con `sm:grid-cols-2`, en la ventana del asistente (~1108 px menos sidebar) la columna de T/C queda muy angosta para rótulo + botón.
- La pista de origen del T/C ("DOF 12/08/2026 · Banxico…") hereda ese ancho angosto.

## Cambio propuesto (sólo presentación, un archivo)

Reorganizar el interior de la tarjeta sin tocar estado, props ni lógica:

1. **Encabezado en una sola fila**: ícono + "Moneda detectada por la IA" a la izquierda y el botón "Obtener DOF" a la derecha (cuando aplica). Así el botón ya no compite con el rótulo del campo.
2. **Fila de campos con `flex flex-wrap`**: "Moneda de la factura" con ancho fijo compacto (~`w-36`) y "Tipo de cambio a MXN" con `flex-1 min-w-48`, ambos con rótulo encima del campo, alineados a la misma altura. En pantallas angostas se apilan en columna sin cortar nada.
3. **Pista del DOF** (`TcOrigenHint`) debajo del campo de tipo de cambio, como ya está, pero ahora con el ancho completo de su columna flexible.
4. El aviso ámbar inferior se conserva igual.

Sin dependencias nuevas, sin cambios de comportamiento ni de datos. Los tres tests existentes de `monedaDetectadaIa.test.tsx` deben seguir pasando (los selectores por rótulo y rol no cambian); se ajustarán sólo si algún `getByRole` del botón cambia de contexto.

## Verificación

- Typecheck + ESLint focalizado en el archivo.
- Inspección visual en el preview a 1280×720 (sidebar abierto) y en ancho móvil, moneda USD (con T/C) y MXN (sin T/C).
- No se ejecutan suites CI/Vitest/RLS/E2E localmente; quedan para GitHub Actions.
