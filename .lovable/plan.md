## Diagnóstico

La tarjeta sí está recibiendo datos, pero el backend que usa actualmente el dashboard principal es `dashboard_details()`, no `dashboard_stats()`.

El ajuste anterior se aplicó a `dashboard_stats()`, por eso el problema continúa: `dashboard_details()` todavía devuelve `cargasPorCliente` con campos en formato viejo:

```text
cliente_id, cliente_nombre, total
```

Mientras el componente espera:

```text
clienteId, clienteNombre, total, desglose
```

Resultado visible: solo aparece el número grande, pero falta el nombre del cliente y el desglose por estado.

## Plan de corrección

1. Actualizar la función de backend `dashboard_details()`
   - Cambiar `cargasPorCliente` para que devuelva:
     - `clienteId`
     - `clienteNombre`
     - `total`
     - `desglose` por estado: `Confirmado`, `En Tránsito`, `Arribo`, `En Aduana`, `Entregado`
   - Mantener el límite actual de top 10 clientes y el orden por mayor número de cargas.

2. Blindar el frontend para evitar que vuelva a verse incompleto
   - Mejorar `parseCargasPorCliente()` para aceptar temporalmente tanto el formato viejo como el nuevo.
   - Si llega `cliente_nombre`, mapearlo a `clienteNombre`.
   - Si no llega `desglose`, crear un desglose vacío para que el render no quede roto.

3. Mejorar la tarjeta visualmente para pantallas chicas
   - Hacer que cada fila tenga altura flexible cuando hay muchos badges.
   - Mantener el nombre del cliente visible con truncado correcto.
   - Evitar que la barra proporcional o los chips empujen/oculten información.

4. Actualizar changelog
   - Agregar una entrada nueva al changelog indicando que se corrigió la fuente real del dashboard (`dashboard_details`) y se reforzó el parser del frontend.

## Resultado esperado

En el dashboard principal, la tarjeta “Cargas activas por cliente” mostrará correctamente:

```text
70  INDIMEX TRADING
    26 En Tránsito   30 Arribo   ...

10  OTRO CLIENTE
    6 Confirmado     4 En Tránsito
```

Ya no debe quedar una lista de números sin nombres ni desglose.