# Fix: no se puede confirmar un embarque (error al asignar expediente)

## Diagnóstico (verificado en la base de datos)

El error no tiene relación con cotizaciones aprobadas. Es un problema de tipos en la base de datos:

- La función que genera el folio se declara como `generar_expediente(text)` — recibe el tipo de operación como texto.
- La función que cambia el estado del embarque (`avanzar_estado_embarque`) guarda el tipo de operación en una variable del tipo enumerado `tipo_operacion` y la pasa **sin convertir**: `public.generar_expediente(v_tipo)`.

Postgres no convierte automáticamente un enum a texto al resolver la función, así que responde `function public.generar_expediente(tipo_operacion) does not exist` (código 42883).

Este camino sólo se ejecuta cuando un embarque en estado `Borrador` pasa a `Confirmado` y todavía no tiene expediente asignado — exactamente el escenario reportado en el embarque `b1d91e96…`. Es la única llamada a `generar_expediente` en la base de datos, por lo que el resto de los cambios de estado no se ven afectados.

## Qué se va a cambiar

Una migración que reemplaza `avanzar_estado_embarque` con la conversión explícita del tipo de operación a texto (`v_tipo::text`) al pedir el expediente. Todo el resto de la función queda idéntico: mismas validaciones de rol, transición de estado, documentos faltantes, cierre e idempotencia.

Adicionalmente, para que el folio nunca quede como `ELGEN…` por un tipo nulo, se pasa el valor con respaldo (`coalesce(v_tipo::text, '')`), que la función ya interpreta como prefijo genérico.

## Detalles técnicos

- Migración: `CREATE OR REPLACE FUNCTION public.avanzar_estado_embarque(...)` con el cuerpo actual y el único cambio en la línea `v_expediente := public.generar_expediente(v_tipo::text);`.
- No se toca la firma, ni los permisos, ni `generar_expediente`.
- No hay cambios de código en el frontend: `HANDLE_AVANZAR_ESTADO` sigue llamando a la misma RPC.
- `CHANGELOG.md` + `APP_VERSION` → `13.399.4`.

## Verificación

- Consultar de nuevo la definición de la función para confirmar el cast aplicado.
- Confirmar que el embarque reportado avanza de `Borrador` a `Confirmado` y recibe su expediente `ELIMP…` / `ELEXP…` según el tipo de operación.
