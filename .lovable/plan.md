# COT-2026-0245: el botón "Crear embarque" no aparece para el administrador de la empresa

## Qué encontré (verificado en base y código)

La cotización está perfecta: estado **Aceptada**, cliente real (no prospecto), sin embarque ligado, y con venta por **4,823 USD** (Flete Aéreo 3,875 + Cargos Origen 600 + Cargos Destino 348). Nada de eso bloquea el botón.

Lo que bloquea es el **permiso del usuario**. La cuenta `hector@lopezbenavides.com` tiene el rol **`admin_org`** (administrador de la empresa), y la lista de roles autorizados para crear el embarque desde una cotización sólo incluye `super_admin`, `admin` (rol antiguo) y `operador`. Como `admin_org` no está en la lista, la pantalla ni siquiera muestra el botón.

El mismo hueco existe en el backend: la función que crea el embarque borrador también sólo acepta `super_admin`, `admin` y `operador`. Es decir, aunque se mostrara el botón, la operación sería rechazada por permisos. Hay que corregir los dos lados.

## Qué voy a hacer

1. Agregar `admin_org` a la lista de roles que pueden crear el embarque desde una cotización (con eso reaparece el botón para el administrador de la empresa).
2. Agregar `admin_org` al mismo permiso en la función de base que crea el embarque borrador, para que la operación sí se ejecute.
3. Dejar todo lo demás igual: los otros roles no ganan ni pierden permisos, y no se toca la cotización, sus importes, IVA, tipo de cambio, ni el embarque resultante.

## Detalles técnicos

- `src/lib/access/permissionMatrix.cotizaciones.ts`: agregar `"admin_org"` a `CREAR_EMBARQUE_BORRADOR` y actualizar el comentario de espejo.
- Nueva migración que hace `CREATE OR REPLACE` de `public.crear_embarque_borrador_core`, cambiando sólo el cálculo de `v_can_write` para incluir `has_role(auth.uid(),'admin_org')`. Sin cambios de firma, retorno, ni del resto del cuerpo; se sincroniza el espejo en `supabase/schema/`.
- Prueba focalizada: `CREAR_EMBARQUE_BORRADOR` incluye `admin_org` y `visibilidadAcciones` devuelve `mostrarCrearEmbarque=true` para ese rol con cotización aceptada y venta positiva.
- Sin cambios en RLS, otras RPCs, importes ni migraciones ya aplicadas.

## Validaciones

Typecheck, ESLint focalizado, pruebas focalizadas de cotización/permisos, `audit:schema-functions`, `audit:manifest` y build. CI completo, RLS globales y E2E quedan para GitHub Actions.

## Nota (no incluida en este cambio)

Otros roles operativos (`gerente_operaciones`, `coordinador_logistico`) también quedan fuera de este permiso. No los incluyo salvo que me lo pidas explícitamente.
