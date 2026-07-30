## Objetivo

Que el operador entregue la invoice del agente chino como **archivo**, sin crear la factura de proveedor. Contabilidad la revisa y la convierte en factura con un clic.

## Por qué NO usar el checklist de documentos del embarque

El expediente actual (`documentos_embarque`) es un checklist con estados Pendiente / Recibido / Validado / No aplica, y alimenta el indicador "documentos faltantes" y las alertas de cierre. Si ahí se cargan N invoices sueltas:

- los indicadores de "expediente completo" se distorsionan,
- no hay un lugar natural para el estado contable (por capturar / capturada / rechazada),
- contabilidad tendría que entrar embarque por embarque a buscar.

Mejor: un **buzón (inbox) separado**, ligado al embarque, visible en su propia pestaña y en una bandeja global. Es el patrón estándar de un ERP: la entrega del documento y la captura contable son dos pasos con dueños distintos (segregación de funciones), unidos por un flujo de un solo clic.

## Flujo propuesto

```text
OPERADOR                         CONTABILIDAD
--------                         ------------
Embarque LC-297
 └ Tab "Facturas de proveedor"   Bandeja "Por capturar" (badge 7)
    [Subir PDF]                   └ agrupada por embarque
      · proveedor/agente            · ve PDF + datos leídos por IA
      · nota (opcional)             · [Crear factura]  -> formulario precargado
      -> estado: Por capturar       · [Rechazar] -> vuelve al operador con motivo
      IA lee folio/total/moneda     -> estado: Capturada (ligada a la factura)
```

Estados del documento: `por_capturar` → `capturada` | `rechazada` (con motivo) | `duplicada`.

## Reglas clave

- El operador **no** puede crear ni editar facturas de proveedor; sólo sube, edita su nota y borra su propio documento mientras siga en `por_capturar`.
- Un documento capturado queda **inmutable** y ligado a `proveedor_facturas.id`; el PDF pasa a ser el `archivo_pdf_url` de esa factura (sin duplicar el archivo en storage).
- **Anti-duplicados**: hash SHA-256 del contenido; si ya existe el mismo archivo en la organización se avisa al subir. Además, si la IA detecta un folio ya registrado se marca posible duplicado (reutiliza el aviso `CfdiDuplicadoAlert`).
- Todo con aislamiento por `organization_id` y RLS por rol; el operador sólo ve embarques a su cargo, según la matriz de permisos existente.
- Cada acción (subir, capturar, rechazar) queda en la bitácora de actividad.

## Detalles técnicos

**Base de datos** — nueva tabla `public.embarque_facturas_entrantes`:
`id, organization_id, embarque_id, proveedor_id (nullable), nota, archivo_path, archivo_hash, nombre_archivo, estado, ia_payload jsonb, ia_estado, folio_detectado, total_detectado, moneda_detectada, proveedor_factura_id (nullable), rechazo_motivo, subido_por, capturado_por, created_at, updated_at, deleted_at`.
Con GRANTs explícitos, RLS por organización y rol, índice único parcial por `(organization_id, archivo_hash)` sobre filas vivas, y trigger de `updated_at`.

**Storage**: bucket `documentos` existente, ruta `cxp-inbox/{embarque_id}/{hash12}-{archivo}`, subida idempotente reutilizando el patrón de `uploadDocumentoEmbarque`.

**IA al subir**: se invoca `parse-invoice-pdf` (ya existente) de forma asíncrona tras la carga; el resultado se guarda en `ia_payload`. Si falla, el documento sigue usable (`ia_estado = 'error'`), nunca bloquea al operador.

**Front**:
- `src/features/embarques/components/TabFacturasEntrantes.tsx` + diálogo de carga (usando `FormDialogShell`).
- `src/features/bandejas/routes/CxpFacturasEntrantes.tsx`: bandeja global agrupada por embarque, con visor de PDF, filtros por proveedor/antigüedad y badge de pendientes en el sidebar y en el KPI de "Por capturar".
- Botón **Crear factura** que abre `DialogNuevaFacturaProveedor` precargado con `embarque_id`, proveedor, PDF y conceptos leídos por IA; al guardar, marca el documento como `capturada`.
- Permisos nuevos en `permissionMatrix.ts`: `canSubirFacturaEntrante` (operador, coordinador, admin) y `canCapturarFacturaProveedor` (existente) para capturar/rechazar.

**Tests**: unitarios de dominio (transiciones de estado, detección de duplicados, derivación de estado), pruebas RLS (operador no captura, contador no sube a embarques ajenos) y un E2E: operador sube → aparece en bandeja → contador captura → documento queda ligado.

**Cierre**: `CHANGELOG.md` + `APP_VERSION` a `13.346.0`.

## Fuera de alcance (posible fase 2)

Ingesta directa por correo (buzón `facturas@…` que cree los documentos automáticamente) — vale la pena, pero conviene después de que el flujo manual esté en uso.
