# Embarques y contenedores

Revisado el **2026-09-26**. Modelo: un embarque puede tener varios
`embarque_contenedores`. Conceptos de costo/venta tienen `contenedor_id`
opcional; `NULL` representa cargo general.

## Persistencia

Tipos en `src/features/embarques/types/contenedor.ts`.
Servicios en `src/features/embarques/services/contenedores/` y
`services/mutations.ts`; hooks en `hooks/mutations/`.

Alta: contenedores viajan **dentro de la RPC** junto al embarque/conceptos.
No describir una segunda llamada de inserción como flujo vigente.
Actualización con contenedores usa `actualizar_embarque_con_contenedores`,
en una transacción, con requestId/control optimista según el servicio.

Lista omitida al actualizar no significa vaciar hijos.
Conservar IDs existentes y remapear sólo en duplicación; no dejar conceptos
referenciando hijos de otro embarque.

## Modos

- Marítimo FCL: lista de contenedores y captura requerida según el paso/estado.
- LCL: rama específica de carga consolidada, no exigir número FCL ficticio.
- Aéreo/terrestre: no inventar contenedores marítimos.
- Campos de cabecera legacy se sincronizan según el trigger SQL vigente.

La UI de wizard y los requisitos al cerrar no son idénticos: un borrador
puede necesitar captura posterior. Consultar schemas y guard de cierre.
Los consumidores legacy deben migrarse antes de retirar columnas/triggers.

## Conceptos y proformas

La selección por contenedor distingue cargos específicos y generales.
Un cargo general no se factura una vez por cada contenedor: revisar
elegibilidad/estado/proforma de origen antes de seleccionar.

Proformas multi-contenedor agrupan conceptos y subtotales en UI/PDF.
Consolidación requiere mismo embarque/cliente según RPC y conserva origen.
Conceptos asociados a hijos eliminados necesitan el tratamiento del helper
vigente, no un nuevo cargo duplicado.

## Duplicación

`duplicar_embarque_completo` crea hijos nuevos y remapea `contenedor_id`;
concepto general continúa general. Nunca reutilizar IDs de contenedor origen.

## Verificación de cambios

Comprobar FCL de varios hijos, LCL y no marítimo, guardado/edición sin pérdida
de IDs, conceptos específicos/generales, proformas y datos pendientes.
Pruebas SQL en base efímera. Esta guía no cambió registros o schema.
