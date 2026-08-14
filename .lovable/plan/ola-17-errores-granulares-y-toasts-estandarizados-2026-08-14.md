# Ola 17 · Errores granulares y toasts estandarizados

Objetivo: que cada error diga exactamente qué pasó y qué hacer, sin textos técnicos crudos y sin toasts duplicados.

## Estado actual (verificado)

- Ya existe un pipeline central: `getErrorMessage()` en `src/lib/errors/index.ts` → regex legacy → `translatePostgresError()` → catálogo `LC_*`.
- `translatePostgresError()` (`src/lib/errors/pgErrorCodes.ts`) ya traduce 42501/RLS, 23503, 23505 (con 3 constraints con mensaje propio) y 23514. **No** cubre 23502, 22001, 22P02, 22003, 40001/40P01, 57014, 23P01, P0001/P0002, 2200x.
- `notifyError` ya deduplica por `id = err-<errorCode|phase>` y siempre lleva "Ver detalles" → `ErrorDetailsDialog` copiable.
- Las Edge Functions ya normalizan el error de FacturApi con `describeFacturapiError()` (preserva `code`, `path`, `errors[]`, `logId`), pero **el frontend no traduce nada de eso**: el usuario ve el mensaje en inglés/técnico de FacturApi o "El servicio en la nube rechazó la solicitud".
- Guardrails ya activos: `error-toasts-use-notifyError`, `no-double-toast-on-mutate`, `mutations-have-onerror`. No hay guardrail para `console.error` huérfano (7 archivos lo usan hoy).

## Fase 1 · Traducción de errores de base de datos

Ampliar `src/lib/errors/pgErrorCodes.ts`:

- Nuevos SQLSTATE con mensaje de negocio en es-MX: 23502 (falta un campo obligatorio, nombrando la columna), 22001 (texto demasiado largo), 22P02 / 22003 (número o fecha con formato inválido), 23P01 (traslape de periodo), 40001 / 40P01 (dos usuarios guardaron al mismo tiempo → reintenta), 57014 (la consulta tardó demasiado), P0001 (mensaje del `RAISE` de la BD, ya limpio de prefijos).
- Extraer el nombre de columna/constraint del detalle (`Failing row`, `column "x"`) para redactar mensajes concretos.
- Mover el diccionario de constraints con mensaje propio a un mapa `CONSTRAINT_MESSAGES` (folios de factura y de proveedor, RFC de cliente/proveedor, UUID fiscal, refacturación abierta, unicidad de contacto principal) para poder crecerlo sin tocar la lógica.
- Dividir el archivo en `pgErrorCodes.ts` (orquestador) + `pgConstraintMessages.ts` para respetar el límite de tamaño.

## Fase 2 · Traducción de rechazos FacturApi / SAT

- Nuevo `src/lib/errors/satErrorCodes.ts`: catálogo de códigos del SAT/FacturApi más frecuentes en timbrado, cancelación y REP, con **título corto + acción sugerida** (301 XML mal formado, 302 sello inválido, 305 certificado inválido, 401 versión no soportada, 402 RFC del emisor no está en el padrón, 403 RFC del receptor no válido, 404 régimen/uso de CFDI incompatible, 702 fuera de rango de fechas, CFDI33/40 de impuestos, folio ya cancelado, cancelación no autorizada por el receptor, etc.).
- Nuevo `src/lib/errors/facturapiError.ts`: dado el body que devuelven las Edge Functions (`{ status, detail }`), extrae `código SAT`, `campo` (`path`/`location`), `errors[]` y `logId`, y arma `{ titulo, descripcion, detalles }`.
- Enganchar en `getErrorMessage()` **antes** del fallback genérico de Edge Functions, y en los servicios de facturación que hoy sólo reenvían el mensaje crudo, para que el toast use el texto humano.
- El detalle técnico (código SAT, `logId`, campo, lista de `errors[]`) viaja en `context` de `notifyError`, de modo que quede visible y copiable en `ErrorDetailsDialog` para soporte administrativo (no se muestra en el título del toast).
- Los servicios de facturación pasarán el body completo del error (hoy varios pierden `detail` al leer sólo `error.message`): se leerá vía `FunctionsHttpError.context` con el mismo patrón que ya usa `parseCfdi.invoke.ts`.

## Fase 3 · Higiene de toasts

- Guardrail nuevo `src/__tests__/architecture/no-orphan-console-error.test.ts`: prohíbe `console.error` en `src/features/**` y `src/hooks/**` salvo allowlist (observabilidad y boundaries), obligando a `notifyError`.
- Revisar los archivos que hoy usan `console.error` y sustituirlos por `notifyError` (o `reportCaughtError` cuando no haya UI).
- Dedupe de éxito: `notifySuccess` recibirá un `id` estable derivado de `method`/`phase` (mismo criterio que `notifyError`), para que un doble clic rápido reemplace el toast en lugar de apilar dos.
- Reforzar el guardrail existente `no-double-toast-on-mutate` para cubrir también los `mutateAsync` con `try/catch` que emiten toast además del `onError` del hook.

## Pruebas

- `pgErrorCodes`: un caso por SQLSTATE nuevo y por constraint del mapa.
- `satErrorCodes` / `facturapiError`: parseo de un rechazo 301 y uno 402 con `logId`, más un error sin código conocido (fallback).
- `appFeedback`: doble llamada a `notifySuccess` con el mismo `method` emite un solo toast.
- Los tres guardrails de arquitectura corriendo en verde.

## Notas técnicas

- No se toca la base de datos: es traducción en el cliente. Los mensajes `LC_*` de la BD siguen siendo la fuente de verdad cuando existen.
- Nada de textos técnicos en el título del toast (regla Q-15.3 vigente).
- Al cerrar: bump de `APP_VERSION` y entrada nueva en `CHANGELOG.md`.
