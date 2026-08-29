-- _decisiones_negocio.sql — FUENTE ÚNICA de las decisiones de negocio que los
-- guards congelan. Se incluye con `\ir` desde las suites.
--
-- Por qué existe: varios guards repetían la misma lista de roles o el mismo
-- umbral. Cuando la decisión cambiaba (p. ej. C9: "ventas SÍ ve costos",
-- v13.796.0), el guard viejo seguía exigiendo la regla anterior y CI se ponía
-- rojo aunque el sistema estuviera correcto. Con una sola fuente, cambiar la
-- decisión es UN edit aquí + la migración correspondiente.
--
-- Reglas:
--  * cada función devuelve la decisión VIGENTE, con fecha y versión en el
--    comentario;
--  * los guards comparan el estado real de la base contra estas funciones;
--  * nunca se derivan del esquema (eso ocultaría regresiones): se editan a mano
--    junto con la migración que cambia la decisión.

-- C9 (v13.796.0, 2026-08-29) — Roles que pueden ver costos de cotización:
-- gerencia, finanzas y ventas. `vendedor` está incluido globalmente y
-- `puede_ver_costos_cotizacion_propia` se conserva como candado de propiedad.
CREATE OR REPLACE FUNCTION pg_temp.decision_roles_costos_cotizacion()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'admin','admin_org','super_admin',
    'gerente_operaciones','gerente_comercial','gerente_visor',
    'contador','tesorero','auxiliar_contable','ejecutivo_cobranza',
    'vendedor','ejecutivo_pricing'
  ]::text[]
$$;

-- F5 / N-multimoneda (v13.745.1) — Tolerancia aceptada al comparar montos
-- convertidos contra el T/C DOF (2%), para no bloquear la operación por
-- centavos de diferencia.
CREATE OR REPLACE FUNCTION pg_temp.decision_tolerancia_dof()
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT 0.02::numeric $$;

-- F2 (v13.796.0) — Las devoluciones de anticipo son SÓLO totales.
CREATE OR REPLACE FUNCTION pg_temp.decision_devolucion_anticipo_parcial()
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT false $$;
