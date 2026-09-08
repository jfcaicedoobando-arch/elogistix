# Arreglar el error "No pudimos cargar la información" en la ficha del cliente

## Qué pasó

Al abrir el cliente (pestaña Portal) la tarjeta de números financieros falló con un tiempo de espera agotado de la base de datos (código 57014), versión 13.823.231.

## Lo que se verificó

- La tarjeta usa dos consultas: las facturas del cliente y el cálculo de utilidad `profit_por_cliente`.
- `profit_por_cliente` no recibe el cliente: calcula la utilidad de **todos** los clientes de la empresa (recorre los 281 embarques, sus conceptos de venta, costo y notas de crédito) y luego la app se queda solo con la fila del cliente abierto. Es como pedir el estado de cuenta de toda la empresa para leer un solo renglón.
- Al medirla con permisos internos, una parte del cálculo tardó ~35 ms, así que el tiempo agotado no se reprodujo en el momento de la revisión: es un cálculo pesado que se cae cuando la base está ocupada. Por eso el primer paso del arreglo es medir la función completa y confirmarlo.

## Plan

1. **Confirmar el costo real**: medir la función completa tal como la ejecuta la app (usuario de la empresa) y dejar registrado el tiempo antes y después del cambio.
2. **Calcular solo lo del cliente abierto**: agregar un filtro opcional de cliente a `profit_por_cliente` (sin cambiar los resultados que ya entrega cuando no se filtra) y usarlo desde la ficha del cliente. Los mismos números, muchísimo menos trabajo.
3. **Índices si hacen falta**: revisar los índices que usan facturas y embarques por cliente, y agregar solo el que la medición justifique.
4. **Regresión**: prueba que verifique que la ficha pide el cálculo filtrado por cliente y que los totales (facturado, pendiente, utilidad, casos sin tipo de cambio) no cambian.

## Detalles técnicos

- Migración: `CREATE OR REPLACE FUNCTION public.profit_por_cliente(_fecha_desde date, _fecha_hasta date, _modo text, _cliente_id uuid DEFAULT NULL)`, añadiendo `AND (_cliente_id IS NULL OR e.cliente_id = _cliente_id)` en el CTE `base`. Se conserva firma compatible, `STABLE SECURITY DEFINER`, `search_path`, `org_scope()` y los grants actuales; `useRentabilidadClientes` sigue llamándola sin el parámetro.
- `src/features/cliente/services/financials.ts`: pasar `_cliente_id: clienteId` y tomar la primera fila (se conserva el `find` por `cliente_id` como salvaguarda).
- Se regenera la baseline y se corre `bun run db:postcheck` en el mismo cambio.
- No se toca la lógica de conversión a MXN (`aMxn`), estados vivos de factura, ni datos.

## Validación

Typecheck, ESLint y build focalizados, más `db:postcheck`. Vitest completo, RLS, E2E y CI quedan para GitHub Actions. No se publica.
