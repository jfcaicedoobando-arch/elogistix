## Objetivo

Las 6 suites RLS de CI (`logs_74424696920.zip`) fallan por **drift entre los fixtures de los tests y el esquema actual** de la base de datos. Cada error es distinto y deja a la suite con exit code 3. Hay que actualizar los fixtures (y el bootstrap de CI) sin tocar el código de la app ni el esquema de producción.

## Errores y arreglos

### 1. `test_rls_operaciones.sql` (líneas 73-74)
`invalid input value for enum categoria_proveedor: "Naviera"`

`categoria` ahora es enum `('Logistico','GastoOperativo')` con check constraint `Logistico ⇒ tipo NOT NULL`. El valor `'Naviera'` pertenece a `tipo_proveedor`.

**Fix**: incluir las columnas `tipo` + `categoria` en el INSERT:
```sql
INSERT INTO public.proveedores(
  id, nombre, rfc, contacto, email, telefono, moneda_preferida,
  organization_id, tipo, categoria
) VALUES
  (prov_a, 'Prov A', 'RFCA010101AAA', 'C', 'a@a', '555', 'USD', org_a, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor),
  (prov_b, 'Prov B', 'RFCB010101BBB', 'C', 'b@b', '555', 'MXN', org_b, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor);
```

### 2. `test_rls_tarifas_y_costeo.sql` (líneas 84-87)
`invalid input value for enum categoria_proveedor: "Agente"`

Mismo arreglo: usar `tipo='Agente de Carga'::tipo_proveedor` + `categoria='Logistico'::categoria_proveedor`.

### 3. `test_rls_financiero_critico.sql` (líneas 70-71)
`new row for relation "proveedores" violates check constraint "proveedores_categoria_check"`

El INSERT no envía `tipo` ni `categoria`, así que el default (`Logistico`) viola el check (falta `tipo`).

**Fix**: ampliar el INSERT a `(id, nombre, organization_id, tipo, categoria) VALUES (..., 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor)`.

### 4. `test_rls_crm_operacional.sql` (líneas 78-79)
`invalid input value for enum crm_lead_fuente: "web"`

El enum es case-sensitive (`Web`, `Referido`, ...).

**Fix**: `'web'` → `'Web'` en ambos VALUES.

### 5. `test_rls_financiero.sql` (línea 62)
`column "saldo" of relation "facturas" does not exist`

La columna `saldo` se reemplazó por `total_pendientes` y `pagado` (calculados aparte).

**Fix**: quitar `saldo` del INSERT y del VALUES (el cálculo de saldo no se ejercita en este test; sólo se valida aislamiento RLS).

### 6. `test_rls_isolation.sql` (línea 187)
`permission denied for table clientes`

El snapshot CI no tiene los GRANT por defecto sobre `public.*` que Supabase Cloud sí entrega. Esto no es un bug del esquema: es del entorno bare-Postgres de CI.

**Fix**: agregar al final de `supabase/tests/rls/_ci_post_migrate.sql`:
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;
```

Esto sólo corre en CI (no se ejecuta en Lovable Cloud) y elimina el bloqueo. RLS sigue siendo el único gate de aislamiento.

## Versionado
- Sólo cambios en tests/CI; no se bumpea `APP_VERSION` ni se añade entrada al `CHANGELOG.md` (convención: el changelog es para cambios visibles al usuario; estos arreglos son de tooling/QA interno).

## Fuera de alcance
- No se modifica el esquema de producción ni las migraciones.
- No se cambia la lógica de RLS.
- No se regenera el snapshot de CI (los GRANTs en `_ci_post_migrate.sql` lo hacen innecesario).
