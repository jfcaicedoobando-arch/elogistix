

## Correccion: Cotizacion COT-2026-0007

### Problema
La cotizacion COT-2026-0007 quedo en estado "Embarcada" pero no tiene embarques activos asociados, lo que la deja en un estado inconsistente.

### Solucion
Ejecutar un UPDATE directo (no migracion de schema) para revertir el estado a "Aceptada":

```sql
UPDATE public.cotizaciones 
SET estado = 'Aceptada' 
WHERE folio = 'COT-2026-0007' 
  AND estado = 'Embarcada';
```

### Ejecucion
Dado que es una operacion de datos (no de schema), se usara la herramienta de datos para ejecutar el UPDATE directamente en la base de datos. No se requieren cambios en codigo ni migraciones.

