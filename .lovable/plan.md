## Validación COT-2026-0138

**Resultado:** la cotización **no tiene embarque creado por ella**.

### Evidencia
- `cotizaciones`: estado = `Aceptada` (id `5fe12c7f-...`).
- `embarques` con `cotizacion_id = 5fe12c7f-...`: **0 registros**.
- Consistente con el trigger `sync_cotizacion_embarque_link`: si existiera un embarque vinculado, la cotización estaría en `En operación`, no en `Aceptada`.

### Acción
Ninguna. Solo validación, sin cambios en código ni datos.