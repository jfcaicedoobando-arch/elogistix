# LC_CXP_DESCUADRE en FP-000140 — diagnóstico y corrección

## Qué pasó (en simple)

La factura **FP-000140** (AGUNSA L&D, 886.34 MXN) tiene una partida capturada por la IA del PDF así:

```text
INTERNATIONAL SHIP AND PORT FACILITY   cantidad 51   precio unitario 17.38   ->  886.38
Subtotal de la factura                                                          886.34
Diferencia                                                                        0.04
```

La base de datos exige que la suma de partidas cuadre con el subtotal con una tolerancia de **1 centavo**. Aquí hay 4 centavos de diferencia, así que la aprobación se bloquea.

El precio unitario real es 886.34 / 51 = **17.3792**. Al redondearlo a dos decimales (17.38), el error de medio centavo se multiplica 51 veces. Es como medir una tabla con una regla de centímetros y luego cortar 51 tablas: el pequeño error se acumula.

Nota: la segunda partida ("Cargos en Destino", 51.00) sí está ligada a un costo del embarque, y por diseño la validación sólo suma las partidas del CFDI cuando existen, así que no participa en el descuadre — pero parece un dato mal extraído por la IA y conviene revisarlo también.

## Corrección propuesta

### 1. Tolerancia sensible a la cantidad (base de datos)

En `public._cxp_validar_aprobacion`, sustituir la tolerancia fija de 0.01 por una tolerancia de redondeo que crezca con las cantidades:

```text
tolerancia = mayor( 0.01 , 0.005 * suma_de_cantidades_de_las_partidas )
```

Con esto, 51 unidades admiten hasta ~0.26 de diferencia por redondeo (lo correcto contablemente), pero un error real de captura (decenas o cientos de pesos) sigue bloqueando la aprobación. Se re-emite la función con los permisos H6 declarados en la misma migración.

### 2. Mismo criterio en la UI

`src/features/cxp/utils/cuadreConceptos.ts` replica la regla del trigger con `TOLERANCIA = 0.01`. Se actualiza al mismo cálculo para que el semáforo de cuadre y la base digan lo mismo, más tests unitarios del caso 51 × 17.38 vs 886.34.

### 3. Mensaje de error más útil

Hoy el usuario lee "los conceptos no cuadran, revisa la captura" sin números. Se ampliará el texto de `LC_CXP_DESCUADRE` en el catálogo de errores para mostrar suma, subtotal y diferencia (la base ya los envía en el mensaje) y sugerir corregir el precio unitario o usar más decimales.

### 4. Guardar más precisión al importar por IA

Al capturar desde PDF, cuando la línea tiene cantidad > 1 se guardará el precio unitario con hasta 4 decimales (la columna `monto` ya es numérico con decimales), en vez de redondear a 2, para que no se genere el desfase de origen.

## Alcance técnico

- Migración: re-emisión de `public._cxp_validar_aprobacion` (tolerancia por cantidad) + `REVOKE/GRANT` H6 y archivo espejo en `supabase/schema/cxp/`.
- Frontend: `cuadreConceptos.ts`, catálogo `lcCodeMessages` (CxP), normalización de importes en la captura por IA.
- Tests: unitarios de cuadre y prueba SQL del caso con cantidades altas.
- `CHANGELOG.md` + bump de `APP_VERSION` a 13.617.0.

## Arreglo inmediato para esta factura

Sin esperar el cambio: en la captura de FP-000140, poner el precio unitario en **17.3792** (o cantidad 1 con importe 886.34) y borrar la partida sobrante "Cargos en Destino" si no corresponde. Con eso la aprobación pasa hoy mismo.
