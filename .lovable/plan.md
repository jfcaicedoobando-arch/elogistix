## Contexto

Enum `tipo_contacto` = `('Proveedor', 'Exportador', 'Importador')`. En la jerga de forwarder "Proveedor" y "Exportador" son sinónimos (el que embarca la mercancía desde origen). Datos actuales: 22 filas `Proveedor` + 1 fila `Exportador`.

## Cambio

Unificar en un solo valor canónico: **`Exportador`**. Se elimina `Proveedor` del enum.

### Migración BD (una sola)

1. `UPDATE contactos_cliente SET tipo = 'Exportador' WHERE tipo = 'Proveedor'` (23 filas quedarán como Exportador).
2. Rename enum: crear `tipo_contacto_new AS ENUM ('Exportador','Importador')`, alterar columna con cast, dropear enum viejo, renombrar el nuevo a `tipo_contacto`.
3. No hay CHECK constraints ni triggers que dependan del literal — verificado que no hay más usos en BD (sólo la columna `contactos_cliente.tipo`).

### Frontend

- `src/features/cliente/components/DialogContacto.tsx`
  - `TIPOS_CONTACTO` → `['Exportador', 'Importador']`.
  - Default `tipo: 'Exportador'`.
  - Descripción: "Exportador o importador asociado a este cliente."
- `src/features/cliente/components/TablaContactos.tsx`
  - Remover `case 'Proveedor'` del `switch` de badge.
  - Renombrar título de la tarjeta `Proveedores / Exportadores` → `Exportadores`.
- `src/features/embarques/components/secciones/BloqueClienteContactos.tsx` — sin cambios; ya filtra por `Exportador` (v13.303.27).
- Test `src/features/cliente/domain/__tests__/resolverValorContactoDesdeTexto.test.ts` — actualizar fixture y aserción a `Exportador`.
- Types autogenerados (`src/integrations/supabase/types.ts`) — se regeneran tras la migración; no se editan manualmente.

### Bump y changelog

- `APP_VERSION` → `13.303.28`.
- Entrada en `CHANGELOG.md`.

## Fuera de alcance

- Enum `tipo_proveedor` de la tabla `proveedores` (nuestros proveedores logísticos): NO se toca, es otro dominio.
- No se ofrece un flag de "rollback" — los 22 registros históricos quedan como `Exportador` sin distintivo especial. Si el usuario luego quiere separarlos con un tag, se abordará aparte.

## Analogía

Teníamos dos etiquetas en la agenda del cliente que decían lo mismo ("Proveedor" y "Exportador"). Las juntamos en una sola: **Exportador**. Es como fusionar los grupos "Móvil" y "Celular" en tu libreta de contactos.
