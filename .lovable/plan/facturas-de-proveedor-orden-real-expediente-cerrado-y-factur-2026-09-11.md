# Facturas de proveedor: orden real, expediente cerrado y facturas "faltantes"

## Lo que está pasando (verificado)

1. **El orden por Folio sólo ordena las 100 visibles.** La pantalla primero corta la página de 100 y luego la tabla ordena únicamente esa página. Analogía: ordenas alfabéticamente sólo el fajo que traes en la mano, no todo el archivero.
2. **La tabla sí tiene todas las facturas.** En la base hay 252: 122 Vigentes, 113 Pagadas y 17 Canceladas. Las Canceladas se esconden por defecto y la tabla muestra 100 por página, así que parece que faltan.
3. **El expediente ELIMP00189 está Cerrado.** Un expediente cerrado ya no acepta costos nuevos (lo bloquea la base), así que desaparece de la lista al vincular la factura, sin explicarte por qué.

## Cambios

### 1. Ordenar por todas las facturas (el reporte de hoy)
- El orden pasa a ser estado de la pantalla (queda en la dirección del navegador, se puede compartir y sobrevive al refresco).
- Se ordena la lista **completa** y después se corta la página, con las mismas reglas de hoy: texto con collator es-MX (acentos y mayúsculas no afectan), números y fechas comparados por valor, y vacíos siempre al final.
- Al cambiar el orden se regresa a la página 1.
- Aplica a Folio, Folio prov., fechas, importes y saldo.

### 2. Que se entienda cuántas facturas hay
- Aviso encima de la tabla: "17 canceladas ocultas" con un clic para incluirlas.
- El contador de la paginación muestra el total real de facturas que cumplen los filtros.
- Selector de filas por página (50 / 100 / 200).

### 3. Expediente cerrado: decir por qué no se puede
- Al buscar el expediente para vincular la factura, ELIMP00189 aparece marcado **Cerrado** y no seleccionable, con el motivo: "Este expediente está cerrado y no acepta costos nuevos. Reábrelo para capturar la factura."
- No se cambia ninguna regla de negocio: los expedientes cerrados siguen sin aceptar costos.
- Si quieres, reabro ELIMP00189 para que captures esa factura y luego lo cierras de nuevo: dime y lo hago (queda registrado en la bitácora).

## Detalles técnicos

- `src/features/cxp/hooks/useCxpPageState.ts`: agregar `sortKey`/`sortDir` a los filtros de URL (`useTableFilters`), con default `folio_interno` desc.
- Nuevo `src/features/cxp/services/proveedorFacturas.orden.ts`: mapa `columnId → extractor + tipo` (string/número/fecha) con contrato null-last y `Intl.Collator("es-MX", { sensitivity: "base" })`, espejo de los `sortingFn` de `cxpColumns.tsx`.
- `src/features/cxp/routes/Cxp.tsx`: ordenar `data` con ese mapa, luego `slice` de la página; pasar `sortMode="server"` + `controlledSort` + `onSortChange` a `ResponsiveDataTable` (TanStack deja de ordenar por su cuenta, no hay dos fuentes de verdad); `pagination.total` = largo de la lista filtrada; `onPageSizeChange`/`pageSizeOptions`.
- Aviso de canceladas: contar con la consulta existente (`incluirCanceladasCxP`) sin nueva query; el clic sólo cambia el filtro `estatus`.
- Expediente cerrado: `buscarEmbarquesPorTexto` deja de excluir `Cerrado`/`Cancelado` y devuelve el estado; el selector los muestra deshabilitados con el motivo. `esEstadoNoVinculable` sigue siendo el candado en cliente y el trigger de base sigue intacto.
- Sin migraciones, sin tocar importes, IVA, pagos, permisos ni RLS.

## Pruebas

- Unitarias del comparador (folio, fechas, importes, nulos al final, acentos).
- Prueba de la pantalla: con 150 facturas simuladas, ordenar por Folio pone el primer folio global en la página 1.
- Prueba del selector de expediente: uno Cerrado aparece deshabilitado con el motivo.
- Validación local: typecheck, ESLint focalizado, pruebas focalizadas de CxP y build. CI/RLS completos quedan para GitHub Actions.

## Cierre

Bump patch de `APP_VERSION` + entrada en `CHANGELOG.md`.
