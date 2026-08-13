# Refuerzo de validaciones fiscales en refacturación

Objetivo: que un caso de refacturación no pueda avanzar (ni timbrarse) si los datos fiscales del nuevo receptor están incompletos, si la moneda o los impuestos no coinciden con la factura original, o si el importe de la nueva factura no cuadra con el depósito recibido.

## Situación actual (verificada en el código)

- `abrir_caso_refacturacion` valida que el cliente destino exista en la organización y sea distinto al original, pero **no revisa RFC, régimen fiscal ni código postal** del nuevo receptor.
- `duplicar_factura_para_refacturacion` copia el RFC del cliente destino tal cual, sin validar su formato, y hereda moneda, tipo de cambio e impuestos sin comprobar después que los conceptos copiados sigan cuadrando.
- `reasignar_pago_factura` sí valida moneda del pago vs. factura destino y sobrepago, pero **el RFC del ordenante se guarda sin validar** y no se exige registrar quién pagó realmente.
- No existe un chequeo único que confirme, antes de timbrar, que la nueva factura es consistente con la original y con el depósito.
- La validación de RFC vive duplicada: en `mutationSchemas.ts` (no exportada) y en los helpers de la función de timbrado.

## Qué se va a construir

### 1. Validaciones fiscales del nuevo receptor (base de datos)

Al abrir el caso y al crear el borrador:

- RFC del cliente destino presente y con formato SAT (12 o 13 caracteres); se rechaza el RFC genérico `XAXX010101000`/`XEXX010101000` para refacturación nominativa.
- Razón social no vacía.
- Régimen fiscal y código postal presentes (los exige el SAT para CFDI 4.0).
- Mensajes con códigos `LC_REFACT_*` traducidos al español para el usuario.

### 2. Consistencia de la nueva factura vs. la original

Nueva función de verificación que se ejecuta antes de permitir el timbrado:

- Misma moneda que la factura original y que el depósito recibido.
- Tipo de cambio presente cuando la moneda no es MXN.
- Subtotal, impuestos trasladados, retenciones y total iguales a la original (tolerancia de un centavo), y coherentes con la suma de sus conceptos.
- Mismos conceptos, claves SAT y tasas de impuesto (incluye distinguir exento de tasa 0%).
- Ruta fiscal `01` obligada a llevar la relación de sustitución hacia el CFDI original.

### 3. Consistencia con el depósito

- El importe a reasignar no puede exceder el saldo de la nueva factura (ya existía) y ahora tampoco puede quedar por debajo del total pagado en la original sin justificación explícita.
- Registro obligatorio del ordenante real (nombre y, si se captura, RFC válido) cuando el depósito vino de otra empresa.
- Bloqueo del cierre del caso si el pago sigue aplicado a la factura cancelada o el movimiento bancario quedó sin conciliar.

### 4. Asistente y experiencia de uso

- Paso 1 muestra un semáforo de "listo para facturar" del nuevo receptor y qué dato falta, con enlace al expediente del cliente para corregirlo.
- Paso 3 muestra un panel comparativo original vs. nueva (moneda, subtotal, impuestos, total) y bloquea el avance si hay diferencias.
- Paso 5 valida el formato del RFC del ordenante en vivo y exige el nombre cuando se marca que pagó otra empresa.
- Todos los mensajes en español mexicano, con formato de moneda y fecha locales.

## Detalles técnicos

- Migración con: helper `public._rfc_valido(text)`, `public._assert_receptor_fiscal_valido(uuid)` y `public.refacturacion_validar_consistencia(p_caso_id)` que regresa `jsonb` con `{ok, hallazgos[]}`; se invoca desde `duplicar_factura_para_refacturacion` (modo estricto al cerrar) y desde el asistente para mostrar el panel comparativo.
- Endurecer `abrir_caso_refacturacion`, `reasignar_pago_factura` y `cerrar_caso_refacturacion` con los nuevos guards; conservar `SECURITY DEFINER` + `REVOKE ALL` + `GRANT` a `authenticated`/`service_role` (regla H6).
- Frontend: nuevo módulo de dominio `refacturacionValidaciones.ts` (puro, con pruebas) y `rfcMx.ts` compartido en `src/lib/validation` reutilizado por `mutationSchemas.ts` para no duplicar el patrón.
- Nuevos códigos en `lcCodeMessages.*.ts`: `LC_REFACT_RECEPTOR_INCOMPLETO`, `LC_REFACT_RFC_INVALIDO`, `LC_REFACT_MONEDA_INCONSISTENTE`, `LC_REFACT_IMPUESTOS_INCONSISTENTES`, `LC_REFACT_TOTAL_INCONSISTENTE`, `LC_REFACT_ORDENANTE_REQUERIDO`, `LC_REFACT_CIERRE_INCONSISTENTE`.
- Pruebas: unitarias del dominio de validación y del RFC; prueba RLS/SQL que confirme que un caso con receptor incompleto o moneda distinta es rechazado.
- Archivos ≤200 líneas, sin `any`, cleanup en efectos, y registro en `CHANGELOG.md` con bump de `APP_VERSION`.
