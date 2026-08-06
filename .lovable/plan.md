# Revisión masiva en SAT de facturas de proveedor nacional

## Situación actual (verificada en la base de datos)

Facturas de proveedor con UUID fiscal:

| Estatus SAT guardado | Facturas | Con XML |
| --- | --- | --- |
| Vigente | 32 | 31 |
| Sin verificar | 23 | 12 |
| Cancelado | 5 | 5 |

Hoy la verificación se hace factura por factura (o en lote desde la bandeja "Por aprobar", pero solo sobre lo seleccionado en pantalla y desde el navegador). No existe un proceso de backend que barra todo el padrón.

## Qué se va a construir

Un barrido de backend que consulta el SAT para **todas** las facturas nacionales con UUID (no solo las que nunca se verificaron: una que hoy dice "Vigente" puede haber sido cancelada por el proveedor después) y guarda el resultado en cada factura.

- Se ejecuta en el servidor, en fila y con una pequeña pausa entre consultas para no ser bloqueado por el SAT.
- Guarda el estatus y la fecha de verificación en cada factura, igual que la verificación individual.
- Devuelve un resumen: cuántas vigentes, canceladas, no encontradas, no verificables y con error, con la lista de folios de las canceladas.
- Lo corro una vez al terminar y te entrego el reporte de las canceladas detectadas en el chat.

## Detalles técnicos

1. Nueva Edge Function `verificar-sat-lote`:
   - Reutiliza `expresion.ts` y la lógica SOAP/parseo ya probada de `verificar-uuid-sat` (se extrae a `_shared` o se importa desde la carpeta existente para no duplicar reglas de mapeo de estatus, incluido "No verificable" por RFC con `&`).
   - Selecciona en `proveedor_facturas` los registros con `uuid_fiscal` no nulo cuyo proveedor no sea de origen `Extranjero`, con paginación y un parámetro `limite` y `solo_sin_verificar` (default: revisa todas).
   - Requiere autorización de membresía de organización (mismo patrón `authorizeOrgMembership`) y solo procesa facturas de la organización del solicitante.
   - Actualiza `uuid_estatus_sat` y `uuid_verificado_fecha`; nunca cambia el `estado` de la factura ni toca importes.
2. No hay cambios de esquema. No se modifica ninguna factura más allá de los dos campos de verificación.
3. Se registra el resumen en logs de la función para poder auditar la corrida.
4. CHANGELOG.md + bump de `APP_VERSION`.

## Fuera de alcance

- No se cancela, rechaza ni bloquea automáticamente ninguna factura marcada como cancelada por el SAT: solo se reporta para que ustedes decidan.
- No se programa como tarea recurrente en esta iteración (se puede agregar después si quieres revisión diaria automática).
