

## Plan: Eliminar proveedor JIANGSU SOHO RUNLONG INNOVATION

### Diagnóstico
- Hay exactamente 1 registro con nombre que contiene "JIANGSU SOHO RUNLONG" y tipo "Agente de Carga" (ID: `c45f3e51-c38d-4faa-a5b5-a5b43398e8b7`).
- No tiene registros en `conceptos_costo`, por lo que no hay bloqueo por FK.

### Acción
Ejecutar DELETE directo en la base de datos usando la herramienta de inserción/datos:

```sql
DELETE FROM proveedores 
WHERE id = 'c45f3e51-c38d-4faa-a5b5-a5b43398e8b7';
```

No se requieren cambios en código frontend.

