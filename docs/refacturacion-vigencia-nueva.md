# Refacturación: referencia histórica y nueva operable

Base de revisión: `c85000b937aeed0d004b60e72023d15e9ca53686`.

## Contrato del cliente

- El lector de refacturación conserva identidad, número, UUID, estado fiscal y `deleted_at`. No filtra tombstones: una original Cancelada o Sustituida sigue siendo evidencia del caso.
- La nueva sólo habilita acciones si el caso y su referencia se pudieron consultar y `deleted_at === null`. Una caché antigua sin esa columna no confirma vigencia.
- `factura_nueva_id === null` en un caso consultado correctamente es el único estado que ofrece Crear borrador. Una referencia existente que devuelve null, un error, una baja o una vigencia desconocida bloquean y ofrecen actualizar el estado; nunca crean ni restauran automáticamente.
- Una baja, ausencia confirmada o error ya observado prevalece sobre cualquier fetch en curso de caso o factura. Un refresco pendiente no oculta ni revierte esa revocación. Antes de cada efecto, el guard consulta también el estado y la identidad actuales de QueryClient sin esperar la notificación/render de React. Una nueva observada Cancelada/Sustituida revoca las operaciones que exigen timbrado; no cambia el papel histórico del original.
- El polling conserva el historial visible y retira permisos al observar una baja o un error. El avance desde Nueva factura, la cancelación del original, la reasignación y el cierre requieren nueva vigente y timbrada. El cierre también valida cuando el pago ya estaba reasignado.
- Las operaciones revalidan caso y nueva al actuar. Cada continuación conserva el original, caso, referencia, apertura y generación de sesión de su inicio. Cerrar/reabrir, cambiar de caso/documento/organización, desmontar o detectar baja/error invalida las continuaciones previas, incluso en un ciclo A→B→A. Se comprueba el contexto tras cada lectura y antes de enviar el siguiente efecto.
- Un refetch de cortesía no equivale a una baja: no revive un token inválido ni sustituye la revalidación fresca. La invalidación tras mutar no pierde el cierre encadenado después de una reasignación válida.
- Si un cierre encadenado no puede iniciarse durante polling, se libera el cerrojo y puede reintentarse al confirmar vigencia sin repetir la reasignación.
- Los dobles clics simultáneos no duplican la RPC de creación, la reasignación, el cierre ni la navegación. La cancelación explícita del caso sigue disponible donde ya estaba autorizada.

La cancelación de una continuación de UI no revierte una RPC ya enviada. Una respuesta tardía puede invalidar la caché de su caso de origen, pero no avanzar ni cerrar una apertura o caso nuevos.

## Límite de backend pendiente

`duplicar_factura_para_refacturacion` actualmente puede reutilizar `factura_nueva_id` aunque el borrador referenciado tenga `deleted_at` (su salida anticipada comprueba estado Cancelada, no baja administrativa). El cliente verifica la referencia retornada antes de anunciar éxito. Esto **no repara ni garantiza la integridad transaccional del backend** ni elimina la carrera entre un precheck y una mutación.

Se necesita un guard separado en servidor y una prueba SQL aislada para la secuencia crear borrador → eliminarlo → repetir duplicación. También corresponde revisar la vigencia de la nueva en `cerrar_caso_refacturacion` y `refacturacion_validar_consistencia`; `reasignar_pago_factura` ya exige destino no eliminado. Este paquete no cambia SQL, contratos fiscales, migraciones ni datos.

Restaurar el borrador y sus conceptos o crear otro borrador vinculado al caso requiere una decisión independiente. No hay recuperación automática, restauración parcial ni desvinculación de la referencia histórica.

## Pruebas y auditoría

Cobertura mock: proyección de `deleted_at`, original histórica, estados ausente/error/desconocido, caché viva tras error, polling real de 15 segundos con reloj simulado, nueva viva→baja, revalidación por acción, retorno de tombstone, dobles clics, cierre/reapertura, cambios A→B→A y generación de organización, respuesta tardía de una RPC ya enviada y flujo de reasignar/cerrar con QueryClient real.

Las pruebas de React/servicios no equivalen a concurrencia PostgreSQL ni a pruebas en una base real. El lector histórico sigue en `audit-soft-delete-baseline.json`: no se retira deuda por reclasificación. No cambia el auditor ni se añade una excepción `SOFT-DELETE-OK`. El guard de detalle de factura de PR307 permanece intacto.
