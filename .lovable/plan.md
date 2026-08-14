# Estado de la Ola 14 y cobertura de pruebas

## ¿Terminamos todo?

Los 5 sprints del pack están implementados (v13.607.0):

| Sprint | Ítems | Estado |
|---|---|---|
| S01 Higiene de release | R5TC-02, R5BD-01 | Implementado |
| S02 Toolchain | R5TC-01, R5TC-03 | Implementado |
| S03 Edge functions | R5EF-01/02/03 | Implementado |
| S04 Frontend/UX | R5FE-01/02, R5UX-01 | Implementado |
| S05 BD | R5BD-02/03/04/05 | Implementado (R5BD-03 con saldo calendarizado a la Ola 17, según lo acordado en el propio sprint) |

## ¿Todo tiene tests?

Casi. Falta un hueco real:

- S03 y S04 sí tienen pruebas (funciones edge con `index_test.ts`, y pruebas unitarias de `facturaFlags`, permisos y wizard de refacturación).
- **S05 no tiene pruebas.** Los cambios de base de datos de este sprint (la nueva llave foránea de `pagos_factura` y el recorte de permisos de escritura en `refacturaciones`) se migraron pero ningún test verifica que se comporten como se documentó. Hoy nada impide que una migración futura los deshaga sin que CI se queje.

## Propuesta: cerrar el hueco de pruebas de S05

Crear una suite nueva `supabase/tests/rls/test_rls_refacturaciones_matriz.sql`, siguiendo el mismo patrón de `test_rls_saldo_factura_proveedor.sql` (transacción con `BEGIN`, helpers `pg_temp.as_user`, aborta con excepción al primer fallo), con estos casos:

1. Un usuario con rol de tesorería o cobranza **no puede** insertar ni actualizar directamente en `refacturaciones` (antes sí podía y saltaba las validaciones del SAT).
2. Un usuario con rol contable auxiliar **sí puede**, porque las RPC ya lo autorizan.
3. Un usuario de otra organización no ve ni escribe casos ajenos.
4. La lectura (`SELECT`) sigue funcionando igual para los roles que ya la tenían.
5. La llave foránea nueva rechaza un pago que apunte a un caso de refacturación inexistente (error de integridad referencial).
6. La llave foránea existe con la configuración documentada (borrado restringido, en estado `NOT VALID` a la espera del saneo manual).

Analogía: la migración puso la cerradura en la puerta; esta suite es el guardia que cada noche revisa que la cerradura siga puesta.

## Detalles técnicos

- Archivo nuevo: `supabase/tests/rls/test_rls_refacturaciones_matriz.sql`. Sin migraciones nuevas ni cambios de esquema.
- Semilla propia (dos organizaciones, usuarios por rol, un cliente, una factura y un caso de refacturación) creada como `postgres` para saltar RLS, igual que las suites existentes.
- Los intentos denegados se envuelven en `BEGIN ... EXCEPTION` esperando `42501` / `23503` según el caso.
- Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION` a `13.607.1`.
- Verificación: correr la suite contra la base y luego `audit:all` para confirmar que los 12 guardrails siguen en verde.
