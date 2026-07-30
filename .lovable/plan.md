# Corregir H6 en el trigger de cotizaciones sin importes

CI falla porque la migración `20260730160942_...sql` crea `public._cotizaciones_bloquear_envio_sin_importes()` como `SECURITY DEFINER` con `REVOKE ALL ... FROM PUBLIC` pero **sin** el `GRANT EXECUTE` que exige la regla H6. Los archivos de migración ya aplicados no se editan, así que se corrige con una migración posterior (mismo patrón que FIX-H6-01/02/03).

## Qué se hará

1. **Migración correctiva nueva** (`2026073016xxxx_fix_h6_cotizaciones_envio_sin_importes.sql`), con el cuerpo idéntico de la función más:
   - `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;`
   - `GRANT EXECUTE ON FUNCTION ... TO authenticated, service_role;`
   - Recreación del trigger `trg_cotizaciones_bloquear_envio_sin_importes` (DROP IF EXISTS + CREATE), sin cambiar la lógica de negocio.
2. **Subir el baseline** en `scripts/audit-migrations.ts` de `20260730051450` a un timestamp posterior a `20260730160942`, para que el archivo original quede como legacy auditado.
3. **Documentar el bump** en `docs/migrations-hygiene.md` (histórico de baseline bumps, entrada FIX-H6-04).
4. **Versionado**: bump de `APP_VERSION` y entrada nueva en `CHANGELOG.md`.

## Notas técnicas

- La función es sólo de trigger; el `GRANT EXECUTE` no amplía superficie real de ataque (los triggers corren bajo el owner), pero es obligatorio por la regla H6 del auditor.
- No cambia el comportamiento: sigue bloqueando el paso a `Enviada` cuando los totales USD y MXN son cero.
- Verificación: `bun run audit:migrations` debe terminar en verde.
