## Objetivo

Cambiar quién puede cerrar embarques:
- **Antes**: Finanzas (admin, contador, super_admin).
- **Ahora**: **Coordinadores logísticos** (operativos), siempre que el checklist esté 100% en verde. Admin/admin_org/super_admin/gerente_operaciones también pueden cerrar (respaldo gerencial). El equipo financiero **ya no puede cerrar**.

La validación del checklist (`validar_cierre_embarque`) sigue siendo el guardián: el botón ya está deshabilitado hasta que `puede_cerrar = true`.

## Cambios

### 1. Backend — RPC `cerrar_embarque`
Archivo: nueva migración SQL.

Reemplazar el chequeo de rol:
```sql
-- Antes
IF NOT (has_role(v_uid,'super_admin') OR has_role(v_uid,'admin') OR has_role(v_uid,'contador')) THEN

-- Después
IF NOT (
  has_role(v_uid,'super_admin') OR
  has_role(v_uid,'admin') OR
  has_role(v_uid,'admin_org') OR
  has_role(v_uid,'gerente_operaciones') OR
  has_role(v_uid,'coordinador_logistico')
) THEN
```

`reabrir_embarque` se queda igual (sigue siendo solo super_admin/admin).

### 2. Frontend — `TabCierre.tsx`
- Sustituir el gate `canEditFinance` por una nueva bandera `puedeCerrarEmbarque` derivada del rol efectivo (coordinador_logistico, gerente_operaciones, admin, admin_org, super_admin).
- Actualizar el mensaje informativo cuando el usuario no tiene permiso:
  > "El cierre del embarque es responsabilidad del **coordinador logístico**."
- El botón sigue deshabilitado si el checklist no está completo (`!todoOk`).

### 3. Permisos centralizados — `usePermissions.ts`
Agregar derivado `canCerrarEmbarque` (lista: super_admin, admin_org, admin, gerente_operaciones, coordinador_logistico) y consumirlo desde `TabCierre`.

### 4. Versionado y documentación
- `APP_VERSION` → `13.106.4`.
- `CHANGELOG.md`: entrada `[13.106.4]` explicando la transferencia de responsabilidad.

## Verificación

1. Login como `coordinador_logistico`: con checklist verde → puede cerrar; con checklist rojo → botón deshabilitado.
2. Login como `contador`: ve el checklist informativo pero **no** ve el botón Cerrar; mensaje indica que ahora es responsabilidad del coordinador.
3. Login como `admin_org`: sigue pudiendo cerrar (respaldo).
4. Intento directo de RPC desde un rol financiero → error "No autorizado para cerrar embarques".

## Notas técnicas

- No se cambia la lógica del checklist ni del log de cierre.
- La capacidad de **reabrir** sigue limitada a admin/super_admin (no se toca).
- Migración idempotente con `CREATE OR REPLACE FUNCTION`.
