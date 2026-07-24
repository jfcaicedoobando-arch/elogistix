# Bug: usuarios con rol "Agente de carga" no ven los documentos de sus embarques

## Causa raíz (verificada en DB)

La tabla `embarques` tiene una política dedicada **"Agente read own embarques"** que deja al rol `agente_carga` ver los embarques donde `embarques.agente` coincide con el agente asignado. Pero las tablas hijas del embarque **no tienen esa política equivalente**.

Políticas actuales en `documentos_embarque` (verificado con `pg_policies`):
- `Tenant CRUD documentos_embarque` → sólo `admin`/`operador`/`super_admin`
- `Tenant viewer documentos_embarque` → sólo `viewer`
- `Cliente read own documentos` → sólo rol `cliente`

`has_role(_, 'operador')` incluye `coordinador_logistico`, y `has_role(_, 'viewer')` incluye `contador`, así que esos roles sí pasan. **Pero `agente_carga` no está en ningún grupo**, así que la RPC `get_embarque_full` devuelve `documentos: []` para ellos aunque el embarque sí aparezca.

Roles activos hoy en `user_roles`: `coordinador_logistico` (6), `cliente` (3), `admin_org` (3), `contador` (2), **`agente_carga` (2)**, `admin` (1), `super_admin` (1). Los dos usuarios con `agente_carga` son los afectados.

El mismo hueco existe en las tablas hermanas: `notas_embarque`, `conceptos_venta`, `conceptos_costo` y `facturas` (todas también devueltas por `get_embarque_full`). Un agente que entra al detalle ve el header pero los tabs Documentos, Notas, Costos, Facturación aparecen vacíos.

Analogía: al agente le dimos llave para entrar a la bodega (embarque), pero no a los cajones de adentro (documentos, notas, facturas). Vemos la bodega vacía, no porque no haya cosas, sino porque no puede abrir los cajones.

## Alcance del fix

Sólo lectura. No tocar UI, no cambiar quién puede editar. Es una migración SQL que agrega políticas SELECT análogas a "Agente read own embarques" para las tablas hijas.

## Cambios

Una migración con `CREATE POLICY ... FOR SELECT` en cada tabla hija, usando el mismo patrón: sólo si el `embarque_id` pertenece a un embarque cuyo `agente` coincide con `current_agente_id()` y `organization_id = current_agente_org()`.

Tablas a cubrir:
1. `documentos_embarque` — política `Agente read own documentos`
2. `notas_embarque` — política `Agente read own notas` (tipo `nota` y `cambio_estado`, igual que la de cliente)
3. `conceptos_venta` — política `Agente read own conceptos_venta`
4. `conceptos_costo` — política `Agente read own conceptos_costo`
5. `facturas` — política `Agente read own facturas`

## Verificación

- Correr `set_config('request.jwt.claims', ...)` simulando un usuario `agente_carga` y comprobar que `SELECT` sobre `documentos_embarque` para uno de sus embarques devuelve filas.
- Confirmar que un `agente_carga` de otra org sigue viendo cero (aislamiento tenant).
- Confirmar que roles ya funcionales (`admin_org`, `coordinador_logistico`, `contador`, `cliente`) no cambian su acceso.
- Bump `APP_VERSION` y entrada en `CHANGELOG.md`.

## Detalles técnicos

```sql
CREATE POLICY "Agente read own documentos"
  ON public.documentos_embarque FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND EXISTS (
      SELECT 1 FROM embarques e
      JOIN costeo_agentes a ON a.id = current_agente_id()
      WHERE e.id = documentos_embarque.embarque_id
        AND e.organization_id = current_agente_org()
        AND lower(trim(e.agente)) = lower(trim(a.nombre))
    )
  );
```

Se repite el patrón para las otras cuatro tablas cambiando el nombre y la columna `embarque_id`. Para `notas_embarque` se restringe adicionalmente por `tipo IN ('nota','cambio_estado')` para no filtrar bitácora interna, siguiendo el precedente de la política de cliente.

## Fuera de alcance

- No agrego permisos de INSERT/UPDATE/DELETE para agentes — sólo lectura, que es la queja reportada.
- No refactorizo `get_embarque_full` (la RPC es correcta; el problema estaba en las RLS de las tablas base).
