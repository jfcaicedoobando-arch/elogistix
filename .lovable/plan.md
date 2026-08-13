# Arreglo: la vista previa del paso 3 falla al simular la sustitución de factura

## Qué está pasando

Al llegar al paso 3 del asistente de refacturación, la tarjeta de vista previa no carga y aparece "No pudimos cargar la información". El detalle técnico es `COALESCE types moneda and text cannot be matched` (código 42804).

La causa está confirmada en la función de simulación `refacturacion_simular_paso`: la variable interna de moneda se declara como texto (`'MXN'`), pero la columna `moneda` de facturas y pagos es un tipo enumerado (`moneda`). Cuando la función intenta combinar ambos con `COALESCE(v_new.moneda, v_moneda)` —cosa que solo ocurre en los pasos 3 y 5— la base de datos rechaza la mezcla. Los pasos 1, 2 y 4 no fallan porque ahí solo se usa el valor de texto.

Analogía: es como pedirle a alguien "dame el peso en kilos o, si no, en libras" sin decirle en qué unidad quieres el resultado; la base de datos prefiere no adivinar y se detiene.

## Qué se va a hacer

- Nueva migración que reemplaza `refacturacion_simular_paso` con la misma lógica, pero convirtiendo explícitamente a texto cada lectura de moneda (facturas y pagos) antes de combinarlas.
- Igualar también la comparación de monedas del paso 5 (bloqueo `LC_REFACT_MONEDA_INCONSISTENTE`) para que compare texto contra texto y siga detectando el caso real de moneda distinta.
- Sin cambios de datos, de permisos ni de la interfaz: el asistente vuelve a mostrar la vista previa de los pasos 3 y 5 tal como se diseñó.

## Detalles técnicos

- Archivo nuevo en `supabase/migrations/` con `CREATE OR REPLACE FUNCTION public.refacturacion_simular_paso(uuid, int)`, conservando `STABLE SECURITY DEFINER`, `SET search_path = public` y el bloque `REVOKE ALL` + `GRANT EXECUTE` a `authenticated`/`service_role` (endurecimiento H6).
- Cambios puntuales dentro del cuerpo: `v_moneda := COALESCE(v_old.moneda::text, 'MXN')`, `COALESCE(v_new.moneda::text, v_moneda)`, `pf.moneda::text`, `v_pago.moneda::text` y la comparación `v_pago.moneda::text <> COALESCE(v_new.moneda::text, v_pago.moneda::text)`.
- Se agrega una prueba en `src/features/facturacion/services/__tests__/refacturacionSimulacion.test.ts` que cubre la respuesta del paso 3 con moneda de la nueva factura distinta de nula.
- Verificación: `bunx vitest run` de las pruebas de refacturación más el paso 3 real del expediente `b191c213-5334-46cc-b2ab-8f323be424c9`.
- `APP_VERSION` a `13.589.4` y entrada en `CHANGELOG.md`.
