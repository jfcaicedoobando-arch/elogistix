## Diagnóstico

Analogía: el arreglo de subir el cupo de 10 a 200 conceptos (v13.303.63) sí está en el código, pero la "sucursal" del backend que procesa el CFDI (edge function `parse-cfdi-xml`) sigue trabajando con la versión vieja. El cliente le manda 11 conceptos, ella devuelve sólo 10 (le corta el último de $203.85 USD) y por eso el cuadre falla exactamente por esa diferencia.

Evidencia:
- El XML trae 11 conceptos que suman `11268.49` (subtotal exacto).
- El toast dice suma `11064.64` = `11268.49 − 203.85` (el último concepto).
- Los logs recientes de `parse-cfdi-xml` muestran `conceptos_count: 10`, aunque el archivo `supabase/functions/parse-cfdi-xml/parser.ts` en el repo ya tiene `.slice(0, 200)`.
- Regex probado localmente contra el XML: encuentra los 11 conceptos correctamente.

Conclusión: el archivo local es correcto; el fix no llegó al runtime desplegado.

## Cambios propuestos

1. Redeploy de la edge function `parse-cfdi-xml` (sin tocar código, sólo forzar despliegue) usando `supabase--deploy_edge_functions`.
2. Verificación:
   - Revisar en logs de `parse-cfdi-xml` que la próxima invocación reporte `conceptos_count: 11` para este XML.
   - Confirmar en la UI que el CFDI se puede registrar sin el toast rojo de cuadre.
3. Como salvaguarda contra regresiones futuras, añadir en `supabase/functions/parse-cfdi-xml/parser_test.ts` un caso "fixture con 11 conceptos" que verifique que el parser devuelve los 11 y no 10 (fuerza a que cualquier degradación del cap se detecte en CI).
4. Bump de `APP_VERSION` a `13.303.66` y entrada en `CHANGELOG.md` describiendo el redeploy + test de regresión.

## Fuera de alcance

- No cambia lógica de negocio ni de UI.
- No cambia la validación `validarCuadreCfdi`.
- No toca el flujo doble-toast (ya arreglado en 13.303.65).
