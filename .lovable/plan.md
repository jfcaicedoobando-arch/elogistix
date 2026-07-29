## Qué pasó

Al verificar la factura de proveedor **FP-000051** contra el SAT, el servicio respondió `N - 601: La expresión impresa proporcionada no es válida` y la app lo tradujo como "CFDI No encontrado en SAT" — un mensaje engañoso, porque el SAT ni siquiera llegó a buscar el comprobante: rechazó la petición por mal formada.

## Causa (verificada)

- El proveedor de esa factura tiene el RFC **`AL&0807074L5`** (con ampersand). En la base de datos hay 17 verificaciones "Vigente" exitosas y la única fallida es justo la de este RFC.
- La cadena que se envía al SAT usa `&` como separador de campos (`?re=…&rr=…&tt=…&id=…`). Al insertar un RFC que ya trae `&`, el SAT parte la cadena en el lugar equivocado y devuelve 601. Es un caso conocido y de larga data del web service del SAT.
- El formato del total (`371.200000`) **no** es la causa: montos con la misma forma (`179.800000`) sí devolvieron "Vigente".

## Qué se va a hacer

**1. Reintento con variantes de codificación del ampersand** (`supabase/functions/verificar-uuid-sat/index.ts`)

Cuando algún RFC contenga `&`, la consulta se intentará en cascada hasta obtener una respuesta válida:
1. `&` literal (comportamiento actual),
2. `&amp;` dentro del valor (doble escape en el sobre SOAP, como pide el Anexo 20),
3. `%26` (percent-encoding).

Se detiene en el primer intento cuyo `CodigoEstatus` no sea 601. Para RFCs sin `&` no cambia nada: un solo intento.

**2. Nuevo estatus "No verificable"** en lugar de un falso "No Encontrado"

- La función mapeará el código 601 (tras agotar las variantes) a `No verificable` en vez de `Error`/`No Encontrado`.
- El hook `useVerificarUuidSat` mostrará un aviso ámbar con copy claro: el SAT rechazó la consulta automática por el `&` del RFC y hay que verificar manualmente en el portal del SAT, con enlace directo a `verificacfdi.facturaelectronica.sat.gob.mx`.
- Mismo tratamiento en `useVerificarUuidNcSat` (notas de crédito) para no dejar el flujo a medias.

**3. Ajuste menor de formato del total**

Se omitirán los ceros no significativos según el Anexo 20 (`371.2` en vez de `371.200000`, `1.0`, `0.0`). No es la causa del error actual, pero es lo que exige la norma y reduce riesgo de futuros 601.

**4. Tests**

- Unitarios de la construcción de la expresión: RFC con `&`, sin `&`, formato de total (`0.99`, `1.0`, `0.0`, `371.2`).
- Test del mapeo 601 → `No verificable` y de que el hook emite el aviso ámbar con enlace, no un error rojo.

**5. Versionado**

Bump de `APP_VERSION` a `13.322.17` y entrada en `CHANGELOG.md`.

## Detalle técnico

- Sin cambios de base de datos: `uuid_estatus_sat` es texto libre y ya admite el nuevo valor. Se revisará que los badges de estatus SAT en la UI de compras contemplen `No verificable` con estilo ámbar.
- El estatus se seguirá persistiendo para que la lista muestre el resultado; una factura "No verificable" no bloqueará la aprobación, sólo pedirá revisión manual.
