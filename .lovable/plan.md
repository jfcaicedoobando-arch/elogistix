# Tipos de cliente: Especial y General

## Qué verá el equipo
- Cada cliente tendrá un **Tipo de cliente**: "Cliente especial" o "Cliente general".
- INDIMEX TRADING e INDIMEX COLOMBIA S.A.S. quedan como **Cliente especial**; todos los demás, **Cliente general** (también los nuevos, por defecto).
- En **Clientes → Editar cliente** aparece un selector "Tipo de cliente" (sólo admin/gerente pueden cambiarlo).
- En la lista de Clientes y en la ficha del cliente se muestra una etiqueta "Especial" para identificarlos rápido, con filtro por tipo.

## Qué NO cambia por ahora
- Comisiones, crédito, autorizaciones y precios siguen igual. El tipo es sólo una clasificación visible; si después quieren que "Especial" cambie alguna regla, se define aparte.

## Detalles técnicos
- Migración: columna `clientes.tipo_cliente text not null default 'general'` con CHECK (`'general','especial'`); backfill a `'especial'` para ids `87bdcbf1-…` (INDIMEX TRADING) y `8cdb3331-…` (INDIMEX COLOMBIA). Sin cambios de RLS (hereda políticas de `clientes`).
- Frontend: campo en esquema/form de cliente (Select con valores no vacíos), badge en tabla y detalle, filtro en lista; constantes de selección de columnas actualizadas.
- Pruebas focalizadas: default "general", valores permitidos y badge. `db:postcheck` + baseline. CI/RLS completos en GitHub Actions.
