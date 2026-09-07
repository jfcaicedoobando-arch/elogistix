# Aprobar en lote los gastos sin embarque (caso FP-000221)

## Qué está pasando

En **Compras → Por aprobar** se puede seleccionar varias facturas y aprobarlas de un
golpe. Cuando una de ellas es un gasto que no está ligado a un embarque (como
FP-000221, de administración), el sistema pide por regla una justificación escrita de
mínimo 10 caracteres. La aprobación en lote nunca pide ese texto, así que la factura
falla siempre con el aviso "no está ligada a un embarque ni a costos acordados".

Además el aviso se registra como error desconocido, cuando en realidad es una
validación de negocio esperada.

## Qué se va a cambiar

1. **El lote pregunta la justificación cuando hace falta.**
   Si alguna de las facturas seleccionadas no está ligada a un embarque, el diálogo de
   confirmación mostrará un campo "Justificación del gasto" (mínimo 10 caracteres,
   obligatorio) y dirá cuántas de las seleccionadas lo requieren. Ese texto se usa sólo
   para esas facturas; las que sí tienen embarque se aprueban igual que hoy.

2. **Aviso honesto en el resultado.**
   El aviso de fallo dejará de reportarse como error desconocido cuando sea una
   validación de negocio (falta justificación, monto sobre el límite, etc.).

Nada cambia en la aprobación individual, ni en las reglas de la base, ni en permisos.

## Detalle técnico

- `useAprobarFacturasLote.ts`: `aprobar(ids, justificacion?)` pasa el texto como
  `p_motivo` sólo para las facturas sin `embarque_id` (recibiendo la lista de filas o un
  set de ids que la requieren, resuelto en el llamador). Sigue siendo secuencial, con
  la misma invalidación única al final.
- `ComprasPorAprobar.confirmDialog.tsx`: nuevo campo controlado de justificación
  (`Textarea` + `FormField`), visible sólo si `requierenJustificacion > 0`; botón
  deshabilitado hasta cumplir `JUSTIFICACION_SIN_VINCULO_MIN` (10) y sin exceder
  `MOTIVO_RECHAZO_MAX` (500). Se conserva `ConfirmActionDialog`.
- `ComprasPorAprobar.tsx`: calcula `seleccionadasSinEmbarque` desde las filas ya en
  memoria y lo pasa al diálogo y al hook. Sin cambios de consultas ni columnas.
- Clasificación de avisos: añadir a `VALIDACIONES_NEGOCIO` los textos que faltan
  ("escribe la justificación", "monto que puede aprobarse") y propagar el `code` de
  `AprobacionFacturaError` a `notifyError` (`errorCode`) en lugar de `UNKNOWN`.
- Regresiones focalizadas preparadas: el lote manda justificación sólo a las facturas
  sin embarque; el diálogo bloquea el botón con menos de 10 caracteres; el aviso de
  falta de justificación se clasifica como validación de negocio.
- Bump de patch en `src/constants/appVersion.ts` + entrada en `CHANGELOG.md`.

## Fuera de alcance

Sin SQL, migraciones, RLS ni permisos; sin aprobar ni modificar FP-000221 ni ninguna
otra factura; sin publicar; sin ejecutar CI, RLS ni suites globales localmente.
