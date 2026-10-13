# Contratos de lectura histórica: export de organización e identidad PDF

Estos contratos caracterizan el alcance existente de dos lecturas. No cambian
permisos, RLS, datos, catálogo, DTO ni elegibilidad para operar sobre una entidad.
Las pruebas usan datos sintéticos; no certifican las políticas desplegadas.

## Export de organización

`fetchOrganizationExport` consulta exclusivamente `EXPORT_TABLES`, con
`select('*')` y `organization_id = organizationId` en **cada página** de 1.000
filas. Conserva las filas recibidas, incluidas las bajas lógicas visibles bajo
los permisos/RLS vigentes. No borra ni normaliza IDs, relaciones o `deleted_at`.
Una tabla del catálogo puede no tener esa columna, como `configuracion`.
Agregar un filtro universal de vigencia cambiaría este contrato.

- La organización proviene del contexto activo de `TabExportar`; sin ID o sin
  organización no se inicia la descarga. El servicio mantiene el ID recibido.
- El catálogo cerrado sigue excluyendo credenciales, control de acceso y los
  demás destinos definidos en `exportOrg.tables.ts`. No se amplía por este
  contrato y no se consulta otra organización ni un cliente privilegiado.
- Un error suave conserva las páginas ya obtenidas, añade el warning de esa
  tabla y continúa con las siguientes. Un error duro aborta antes del ZIP.
- El ZIP tiene un CSV por entrada del catálogo y un manifest con organización,
  catálogo, grupos, versión, fecha de generación, conteos efectivos y warnings.
  Los conteos incluyen las bajas recibidas; un resultado parcial sigue siendo
  parcial aunque la descarga haya terminado correctamente.
- Una fila silenciosamente excluida por RLS no produce un warning detectable
  por el cliente. Una tabla vacía o sin warning no demuestra completitud.

### Límites de la extracción

El ZIP es una extracción lógica del catálogo legible, útil para respaldo manual
o análisis. **No certifica un respaldo íntegro/restaurable ni un snapshot
transaccional.** No contiene todo el schema, Auth, Storage, adjuntos o secretos,
ni un restaurador. Las páginas no comparten un corte certificado ni un orden
estable declarado; cambios concurrentes pueden alterar lo obtenido.
`generated_at` fecha el manifest, no un instante común de todas las filas.

El CSV mantiene el escaping y la neutralización de fórmulas. Null/undefined se
representan como vacío y los objetos como JSON; no hay garantía de round-trip
exacto de tipos, null frente a cadena vacía o texto neutralizado. Conservar
`deleted_at` ayuda a una eventual recuperación, pero no prueba que sus padres,
adjuntos y efectos externos sean reconstruibles. No se deben reactivar bajas
transformándolas en filas con `deleted_at = null` al preparar una recuperación.

El servicio no valida cada organización de respuesta ni captura la sesión para
cancelar toda la extracción. Su predicado explícito y las políticas del servidor
son controles distintos. Probar cancelación ante cambio de sesión, aislamiento
RLS real o restauración exige trabajo adicional; véanse
[operaciones](operations.md) y [backups/rollback](backups-rollback.md).

## Identidad de una entidad para PDF interno

`fetchEmisorEntidad` admite sólo `proveedores`, `cuentas_bancarias` y
`proveedor_facturas`. Para representar un DTO ya obtenido por una ruta
autorizada, comprueba la pertenencia persistida de su ID a la organización
capturada. La baja lógica no invalida por sí sola esa pertenencia mientras el
servidor permita leer la fila.

1. Exige ID y organización, selecciona únicamente `id, organization_id` y
   filtra ambos valores. No selecciona importes ni contenido operativo.
2. Tras la lectura, comprueba el ámbito y que ID/organización coincidan. La
   ausencia, inaccesibilidad, respuesta incompleta o discordante, error o cambio
   de usuario/tenant/rol son rechazos. Un cambio A → B → A también invalida la
   operación anterior. Una respuesta null no permite inferir si hubo borrado
   físico o restricción RLS.
3. Obtiene el emisor para la organización **leída de la entidad**, sin fallback
   al perfil, organización seleccionada posteriormente o identidad de otro PDF.
   El loader fiscal verifica `org_scope` incluso al reutilizar su caché.

El resultado identifica la representación. **No habilita búsquedas operativas,
pagos, conciliación, timbrado, envío o modificación de entidades dadas de baja.**
Tampoco permite navegar todas las bajas ni acceder a filas que RLS oculta.

### Identidad actual y procedencia del DTO

El emisor usa la configuración fiscal actual/cacheada de `configuracion` y el
nombre comercial actual de `organizations`, separados entre sí. Si faltan datos
fiscales, se conserva el fallback neutral (`Empresa`, RFC vacío); no se toma la
marca, el proveedor o el perfil como identidad fiscal.

Esto **no reconstruye un emisor histórico congelado a fecha de emisión**. Tras
invalidar la caché puede cambiar el emisor de una misma entidad. Replicar una
identidad legal original exige una fuente histórica versionada y verificada;
los PDFs fiscales de FacturAPI no se generan mediante esta ruta.

Los consumidores mantienen el DTO que ya tenían, sin recuperar operaciones
eliminadas ni recalcular cifras por permitir la lectura de pertenencia:

- Proveedor: periodo, movimientos, apertura, saldos, aging y aviso de truncado.
- Cuenta bancaria: movimientos visibles, filtros, resumen del periodo y
  advertencia de cobertura histórica parcial o ausente.
- Bitácora: filas y filtros visibles de la factura indicada. El componente
  padre bloquea la exportación durante `isPlaceholderData` para no mezclar filas
  retenidas de la factura anterior con un nuevo ID.

Los tres consumidores comprueban el ámbito antes de descargar y notifican los
rechazos de identidad sin descargar ni anunciar éxito.

## Frontera con lecturas operativas y análisis estático

Estos dos propósitos no crean excepciones por carpeta, nombre de función,
catálogo, unión de tipos, tabla o filtro de organización. Los listados activos,
validaciones de padres y operaciones necesitan sus propias condiciones de
vigencia. No se reutiliza el origen de estas lecturas para una selección
operativa más amplia.

Este cambio no añade declaraciones de excepción al guard ni modifica su
baseline. Cualquier reconocimiento estático posterior debe estar limitado al
builder exacto, con pruebas de consultas vecinas y anidadas independientes.
El parser no verifica RLS, permisos ni el motivo comercial.

## Evidencia automatizada y sus límites

- `exportOrg.historical.test.ts`: filas vivas/bajas y relaciones, catálogo
  mixto, predicados por página, fronteras 0/999/1000/1001/2000, visibilidad
  simulada, errores iniciales/parciales, CSV real y manifest.
- `emisorPdf.historical.test.ts`: tres entidades por dos estados de baja,
  proyección mínima, respuesta inválida/ausente, rechazo de ámbito tardío,
  scope remoto con caché y configuración actual tras invalidación.
- `historicalEntityPdfConsumers.test.tsx`: resolver real con servidor sintético
  y descarga mockeada para los tres consumidores, preservación del DTO y cero
  descarga ante error o cambio de ámbito.
- `TabExportar.organization.test.tsx`: organización explícita y bloqueo cuando
  falta el contexto requerido.
- Las suites existentes conservan catálogo/exclusiones, separación fiscal y
  comercial, cambios de usuario/tenant y bloqueo de placeholders de bitácora.

El servidor sintético aplica filtros antes de paginar y proyectar. Representa
visibilidad limitada, pero no prueba RLS desplegada. Los mocks de descarga no
certifican renderizado PDF, exactitud monetaria retrospectiva, aislamiento real,
snapshot concurrente, restauración ni acceso de todos los roles a bajas.
