## Plan

**Analogía breve:** la app ya tiene una etiqueta nueva para tarifas (`reemplazada`), pero la base de datos sigue usando una lista vieja y la rechaza en la puerta.

### 1) Alinear la base de datos con la app
- Crear una migración para reemplazar el constraint `costeo_tarifas_estado_check`.
- Permitir explícitamente estos estados: `borrador`, `vigente`, `vencida`, `reemplazada`.
- No tocar datos existentes ni permisos RLS.

### 2) Confirmar el flujo de tarifa
- Revisar que `insertTarifaConRecargos` siga guardando nuevas tarifas como `vigente`.
- Mantener `marcarTarifaReemplazada` usando `reemplazada`, ahora válido en BD.
- No cambiar el formulario ni textos visibles.

### 3) Guardrail de regresión
- Actualizar/agregar prueba del servicio de tarifas para cubrir que `reemplazada` es un estado válido usado por el código.
- Si existe test de migraciones/arquitectura aplicable, agregar verificación simple del constraint.

### 4) Metadata obligatoria
- Subir `APP_VERSION` a `13.68.4`.
- Registrar el fix en `CHANGELOG.md` con una nota breve.

### Verificación
- Ejecutar prueba enfocada del módulo de costeo/tarifas o la suite relevante.
- Validar que el error copiado por Valeria ya no pueda ocurrir por el constraint de estado.