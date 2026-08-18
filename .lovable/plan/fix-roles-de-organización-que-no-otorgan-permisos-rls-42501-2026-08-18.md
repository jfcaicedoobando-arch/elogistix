# Fix: roles de organización que no otorgan permisos (RLS 42501)

## Qué está pasando

Cinthia (`vendedor` en Elogistix) no puede guardar el Paso 1 de una cotización nueva: la base de datos rechaza el insert con "new row violates row-level security policy".

La política de escritura de `cotizaciones` sí permite `vendedor`. El problema es de dónde lee el rol: la función `has_role` consulta únicamente la tabla `user_roles`, mientras que el rol de Cinthia solo existe en la tabla de membresías de la organización. Para la base de datos, ella no tiene ningún rol.

Analogía: tiene su gafete de la empresa, pero su nombre nunca se dio de alta en la lista de la caseta de vigilancia. El guardia no la deja pasar aunque el gafete diga "vendedor".

Alcance real (verificado en la base de datos): **10 de 19 membresías** no tienen espejo en `user_roles` — roles vendedor, gerente_comercial, gerente_operaciones, contador, coordinador_logistico, ejecutivo_pricing y gerente_visor. Es decir, 10 usuarios están operando con permisos degradados en todos los módulos, no solo en cotizaciones.

## Enfoque aprobado

Sincronizar membresías → `user_roles`, sin tocar `has_role` ni las 352 políticas que dependen de ella.

1. **Backfill**: insertar el espejo faltante de las 10 membresías en `user_roles` (idempotente, `ON CONFLICT DO NOTHING`).
2. **Trigger de sincronía**: al crear, cambiar o borrar una membresía, el espejo en `user_roles` se actualiza automáticamente, para que el desfase no vuelva a ocurrir.
3. **Guardas de seguridad**: el espejo nunca crea roles de plataforma (`super_admin`) ni roles legacy deprecados (`admin`, `operador`, `viewer`), respetando los triggers de bloqueo existentes.
4. **Pruebas + auditoría**: prueba SQL que falla si vuelve a haber membresías sin espejo, para que CI lo detecte.

## Verificación

- Reproducir el insert de cotización como `vendedor` de Elogistix y confirmar que ya persiste.
- Confirmar que un usuario sin membresía sigue siendo rechazado (la corrección no debe abrir la puerta a todos).
- Confirmar que el conteo de membresías sin espejo queda en cero.
- Correr el linter de seguridad y las suites de RLS existentes.

## Detalles técnicos

- **Migración**:
  - `public._sync_user_roles_desde_membership()` — `SECURITY DEFINER`, `SET search_path = public`; en `INSERT`/`UPDATE` inserta `(user_id, role)` en `user_roles` con `ON CONFLICT (user_id, role) DO NOTHING`; en `UPDATE` de rol y en `DELETE` limpia el espejo anterior solo si ninguna otra membresía del usuario conserva ese rol.
  - Filtro explícito: si `NEW.role` ∈ (`super_admin`, `admin`, `operador`, `viewer`) no se escribe espejo (evita choque con `trg_bloquear_rol_legacy_ur` y con `_bloquear_rol_plataforma_om`).
  - Triggers `AFTER INSERT OR UPDATE OF role OR DELETE ON public.organization_members`.
  - `REVOKE ALL ... FROM PUBLIC, anon, authenticated` sobre la función nueva (cumple H6 / FIX-45); solo trigger interno.
  - Backfill dentro de la misma migración con `INSERT ... SELECT ... ON CONFLICT DO NOTHING`.
- **Prueba SQL** `supabase/tests/roles_membership_mirror.sql`: (1) alta de membresía crea espejo; (2) cambio de rol reemplaza espejo; (3) baja de membresía retira espejo; (4) `super_admin`/legacy no generan espejo; (5) invariante global: cero membresías sin espejo. Registrada en el workflow `rls-tests`.
- **Sin cambios de frontend.** `puede_escribir_cotizaciones`, `has_role` y las políticas de `cotizaciones` quedan intactas.
- `CHANGELOG.md` + `APP_VERSION` → 13.665.0.
- Nota de deuda técnica: la fuente de verdad sigue duplicada (membresías + `user_roles`). Queda documentado para unificar más adelante, sin ejecutarlo ahora.
