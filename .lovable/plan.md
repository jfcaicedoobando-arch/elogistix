# Cerrar P1: guardado rápido coherente de costos

## Alcance
- Corregir únicamente el guardado rápido de costos de cotización.
- Conservar el mapeo aprobado de `unidad_medida` y referencias de tarifa.
- No tocar el texto de embarques, permisos, datos, SQL, RPC ni RLS.

## Implementación
1. Obtener costos y `updated_at` como una sola fotografía validada: leer el sello antes y después de los costos y aceptar el resultado sólo si ambos sellos coinciden. Así nunca se combinarán filas viejas con un sello nuevo, sin cambiar la base de datos.
2. Mantener dos estados separados en la pantalla:
   - última fotografía confirmada (filas + sello);
   - captura editable congelada al pulsar “Editar costos”.
3. Al guardar, enviar exclusivamente el sello congelado. Después del éxito, publicar en caché y pantalla la fotografía coherente devuelta; los refrescos posteriores podrán reemplazarla sólo con otra fotografía completa.
4. Al cancelar, descartar la captura y restaurar inmediatamente la última fotografía confirmada. Un cambio externo completo se adoptará fuera de edición; durante edición se conservará la captura y un conflicto seguirá mostrando un solo aviso.
5. Evitar reentrada mientras todavía no exista una fotografía segura; no se eliminará el candado optimista ni se mantendrán listas de sellos consumidos.

## Cobertura preparada para GitHub Actions
- Respuestas de detalle/costos en ambos órdenes con 500 inicial y 600 guardado, comprobando que nunca se guarden filas viejas con sello nuevo.
- Tres guardados consecutivos con refrescos retrasados, sin retroceso de importes, notas o sello.
- Cancelación antes del refresco restaurando el último dato guardado.
- Actualización externa adoptada sólo fuera de captura y conflicto durante captura conservando campos con un aviso.
- Mantener la comprobación existente de metadatos de tarifa.

## Entrega y límites
- Actualizar patch y `CHANGELOG.md` conforme a la convención vigente.
- Hacer sólo revisión estática de los archivos editados; no ejecutar tests, CI, SQL, RLS ni scripts de base de datos.
- No publicar. El smoke físico seguirá pendiente después de que el usuario publique.
