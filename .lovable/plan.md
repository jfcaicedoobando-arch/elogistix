# Liquidaciones de comisión + prueba de cierre de otra empresa

## 1. Regla de acceso a liquidaciones (sólo lectura)

**Situación actual (verificada en producción):**
- Hoy sólo **administración** y la **propia vendedora** pueden ver las liquidaciones.
- Las funciones para generar, pagar y cancelar liquidaciones ya dejan pasar a contador y tesorero.
- Resultado: contador, tesorero y gerentes pueden entrar a Comisiones, pero ven la tabla vacía.

**Cambio:** se agrega sólo el permiso de **ver**, sin permiso de escribir directo:
- Pueden ver: admin, admin de empresa, contador y tesorero.
- También pueden ver, sólo leyendo: gerente comercial, gerente de operaciones y gerente visor.
- Todo queda limitado a su propia empresa; super admin conserva el alcance que ya tiene.
- **No** se aplica la parte del archivo viejo que daba escritura completa ("FOR ALL"). Generar, pagar o cancelar sigue siendo sólo por las funciones controladas, como dice la regla del proyecto.

Analogía: les damos la llave para ver el cajón, no para meter o sacar papeles.

## 2. Prueba de cierre de periodo de otra empresa

**Situación actual:** la prueba falla, porque un contador de la empresa A logra cambiar el cierre de la empresa B. La función revisa bien la membresía, así que **todavía no está confirmada la causa**. Puede ser un permiso que se cuela, como super admin o la jerarquía de roles, o un error de la propia prueba, como la identidad que arrastra de pasos anteriores.

**Pasos:**
1. Reproducirla en la base local reconstruida y averiguar por qué entra.
2. Si es un hueco real de seguridad: corregir la función con un cambio nuevo y mínimo a la base.
3. Si el error está en la prueba: corregir sólo su preparación, sin aflojar lo que revisa.
4. Confirmar que falla antes de la corrección y pasa después.

## Validación
- Pruebas SQL de liquidaciones con cada rol: quién ve, quién no ve y que nadie pueda escribir directo. Además, la prueba de cierre.
- Reconstrucción limpia, referencia del esquema regenerada, `db:postcheck` en verde y registro del cambio en el historial de pruebas.
- CI/RLS completos quedan en GitHub Actions. No se publica ni se toca la versión.

## Detalles técnicos
- La migración Drizzle nueva hace `CREATE POLICY liq_finanzas_read FOR SELECT` usando `has_any_role_in_org` / `current_user_org_id()` con `(SELECT auth.uid())`. No se crean políticas INSERT/UPDATE/DELETE.
- Se agrega la entrada a `drizzle/replay.json`, `control.mjs` y el verificador de historial, igual que en 0042–0048.
