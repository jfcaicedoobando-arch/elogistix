# Fase 3 — Limpieza del enum `estado_cotizacion` (brecha E)

## Contexto

El enum `estado_cotizacion` contiene el valor `'Confirmada'` que es **código muerto**:
- 0 filas en `cotizaciones` lo usan (verificado: solo existen Borrador, Enviada, Aceptada, Rechazada, En operación).
- No aparece referenciado en código de aplicación (`src/`) ni en edge functions activas — solo en migraciones históricas.
- La RPC `portal_responder_cotizacion` solo acepta `Aceptada` o `Rechazada`.
- Es ruido en el modelo de dominio y riesgo de uso accidental.

Estado actual del enum:
`{Borrador, Enviada, Confirmada, Rechazada, Vencida, Aceptada, "En operación"}`

Estado objetivo:
`{Borrador, Enviada, Aceptada, Rechazada, Vencida, "En operación"}`

## Alcance

### 1. Migración SQL — recrear el enum sin `Confirmada`

Postgres no soporta `DROP VALUE` en enums, así que el patrón estándar es:

1. Crear `estado_cotizacion_new` con los 6 valores válidos (sin `Confirmada`).
2. `ALTER TABLE cotizaciones ALTER COLUMN estado TYPE estado_cotizacion_new USING estado::text::estado_cotizacion_new` — seguro porque ya validamos 0 filas con `Confirmada`.
3. Hacer lo mismo con cualquier otra tabla/función que use el tipo (verificar `pg_depend`/`information_schema.columns` antes de la migración para detectar dependencias).
4. `DROP TYPE estado_cotizacion`.
5. `ALTER TYPE estado_cotizacion_new RENAME TO estado_cotizacion`.
6. Recrear el `DEFAULT` de la columna si existía.

**Salvaguarda**: la migración hace `SELECT count(*) FROM cotizaciones WHERE estado::text = 'Confirmada'` y lanza `RAISE EXCEPTION` si encuentra >0 (evita pérdida silenciosa si algo cambió entre planning y ejecución).

### 2. Verificar funciones que referencian el enum

Antes de soltar el tipo, listar funciones que lo referencien con:
```sql
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%estado_cotizacion%';
```
Si alguna usa `'Confirmada'::estado_cotizacion` literal, ajustar (no debería haber según el grep, pero verificamos en build mode).

### 3. Documentación

- `docs/flujo-aceptacion-cotizacion.md` → actualizar sección 8 (Brechas conocidas): brecha 5 (`Confirmada` huérfano) marcada como ✅ cerrada en 12.28.0, y la sección de estados en la parte superior del doc eliminando `Confirmada` del listado.

### 4. Versión y changelog

- `src/constants/appVersion.ts` → `12.28.0`
- `CHANGELOG.md` → entrada `[12.28.0] - 2026-05-31`:
  - Removido `'Confirmada'` del enum `estado_cotizacion` (código muerto, 0 filas afectadas).
  - Brecha E del flujo de aceptación cerrada.

## Lo que **NO** se hace en esta fase

- No se toca lógica de la RPC ni de notificaciones (eso quedó listo en Fases 1 y 2).
- No se crea embarque borrador automático (eso es Fase 4, requiere decisión de producto).
- No se activa el envío de email (sigue esperando configuración de dominio).

## Detalles técnicos

- **Riesgo**: bajo. 0 filas afectadas + 0 referencias en código.
- **Tipo regenerado**: `src/integrations/supabase/types.ts` se actualizará automáticamente; el campo `estado` en TypeScript pasará de tener 7 literales a 6.
- **Compatibilidad**: cualquier código que hiciera `if (estado === 'Confirmada')` (no encontrado en grep) dejará de compilar — esto es deseable, expone uso accidental.

## Resultado esperado

- Enum limpio, 6 estados válidos, alineado con la lógica real de la app.
- Brecha E cerrada en la doc.
- Sin cambios funcionales visibles al usuario.
