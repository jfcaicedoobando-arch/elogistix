# Cerrar automáticamente documentos del buzón cuyo CFDI ya fue capturado

## Respuesta corta

Sí, pasa: hoy en la base hay **5 documentos en "Por capturar"** cuyo CFDI (UUID fiscal) ya existe como factura de proveedor viva (FP-000021, FP-000026, FP-000051, FP-000055 — este último subido dos veces). El buzón sólo se cierra solo cuando la captura se hace **desde el buzón**; si la factura se capturó desde el tab Costos del embarque, o si el mismo PDF se subió dos veces, el documento se queda marcado como pendiente.

Analogía: el buzón es una bandeja de pendientes; hoy sólo se retira el papel cuando lo procesas *desde la bandeja*. Si lo capturas por otro lado, el papel se queda ahí aunque el trabajo ya esté hecho.

Hoy la lista ya muestra una etiqueta de "CFDI ya capturado" y un botón manual "Marcar como capturada", pero el estado real sigue en pendiente y ensucia los KPIs.

## Qué se va a hacer

1. **Cierre automático en la base de datos**: al crear (o revivir) una factura de proveedor con UUID fiscal, cerrar todos los documentos pendientes de la misma organización con ese mismo UUID: estado `capturada`, vínculo a la factura y sello de quién/cuándo.
2. **Corregir el historial**: cerrar los 5 documentos que ya quedaron colgados, vinculándolos a su factura correspondiente.
3. **UI**: dejar de mostrar la fila como "Por capturar" cuando ya está vinculada; el aviso de duplicado sigue existiendo para archivos que aún no tienen factura.
4. **Changelog + versión**: nueva entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Detalles técnicos

- Nuevo trigger `AFTER INSERT OR UPDATE OF deleted_at, uuid_fiscal ON public.proveedor_facturas` con función `SECURITY DEFINER` (con `REVOKE ALL ... FROM PUBLIC` para cumplir H6) que hace:
  `UPDATE embarque_facturas_entrantes SET estado='capturada', proveedor_factura_id=NEW.id, capturado_por=coalesce(auth.uid(), NEW.created_by) WHERE estado='por_capturar' AND deleted_at IS NULL AND organization_id=NEW.organization_id AND normalizar_uuid_fiscal(uuid_fiscal)=normalizar_uuid_fiscal(NEW.uuid_fiscal)`.
- Backfill idempotente en la misma migración con el mismo criterio de emparejamiento por UUID normalizado.
- Frontend: `useCfdisYaCapturados` / `FacturaEntranteRow` se quedan como red de seguridad para duplicados sin factura; no requieren cambio funcional más allá de refrescar la query del buzón tras capturar.
- Verificación: consulta que confirme 0 filas `por_capturar` con UUID que ya exista en `proveedor_facturas` vivas.
