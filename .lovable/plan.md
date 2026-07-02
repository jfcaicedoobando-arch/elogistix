## Contexto

En el header del detalle de proforma (`EstadoBadges` en `ProformaDetalleCards.tsx`) se muestran hasta 3 badges en paralelo, mezclando 3 dimensiones distintas:

1. **Revisión interna** (`estado_revision`): Pendiente / Aprobada / Consolidada
2. **Respuesta del cliente** (`estado_cliente`): Sin responder / Aceptó / Rechazó
3. **Facturación** (`estado_proforma`): Pago pendiente / Facturada

## Diagnóstico

Tienes razón en el badge "Pago pendiente":

- Una proforma **no cobra**, solo la factura sí. Etiquetarla como "Pago pendiente" es engañoso — sugiere una obligación de pago que aún no existe.
- Ese badge en realidad refleja `estado_proforma !== "facturada"`, que ya está cubierto por el resto del flujo (Aprobada + Cliente aceptó → botón "Convertir a factura"; una vez convertida, aparece la tarjeta "Factura asociada" con su propio estado).

Los otros dos badges sí aportan información distinta y complementaria, pero se pueden pulir para que se lean como una sola línea de estado, no como 3 chips sueltos.

## Propuesta

**1. Eliminar el badge "Pago pendiente" / "Facturada" del header de la proforma.**
El estado de facturación ya se comunica mejor por:
- La tarjeta **Factura asociada** (aparece solo si existe) con su propio badge de estado fiscal (borrador/timbrada/cancelada).
- Los botones de acción (`Convertir a factura` desaparece cuando ya está facturada).

**2. Unificar los 2 badges restantes en una línea de estado más clara**, con orden lógico (revisión → cliente) y con un badge "final" cuando ya se cerró el ciclo:

```text
[Pendiente de revisión]                    ← aún no la revisa un operador
[Aprobada] [Cliente sin responder]         ← lista, esperando al cliente
[Aprobada] [Cliente aceptó]                ← lista para convertir a factura
[Aprobada] [Cliente rechazó]               ← ciclo cerrado (rojo)
[Consolidada]                              ← se unió a otra
```

Además, cuando ya existe factura asociada, ocultar el badge de "Cliente sin responder" (ya es irrelevante) y opcionalmente mostrar un badge sutil `Convertida a factura` que enlace por scroll a la card de la factura.

**3. Cambios de copy menores** para que suenen consistentes:

- "Pendiente de revisión" → se queda igual.
- "Cliente sin responder" → "Esperando al cliente" (más neutral, no suena a reclamo).
- "Cliente aceptó" / "Cliente rechazó" → se quedan.

## Detalles técnicos

Archivo único a tocar: `src/features/proformas/components/ProformaDetalleCards.tsx`, función `EstadoBadges` (líneas 23–45).

- Quitar las líneas 40–42 (`facturada ? Facturada : Pago pendiente`).
- Añadir un ternario que oculte `Cliente sin responder` cuando `estadoRev !== "aprobada"` o cuando ya hay factura asociada (pasar `tieneFactura?: boolean` como prop opcional desde `ProformaDetalle`).
- Cambiar el texto "Cliente sin responder" por "Esperando al cliente".
- Actualizar la llamada en `ProformaDetalle` para pasar la nueva prop (buscar dónde se renderiza `<EstadoBadges …/>`).

Sin cambios de datos, sin migración, sin cambios en flujos ni permisos. Puramente presentacional.

## Bump

- `APP_VERSION` → `13.144.2`
- Entrada en `CHANGELOG.md` describiendo el ajuste de badges.

## Fuera de alcance

- No se toca la tabla de proformas (ya se limpió en 13.144.1).
- No se toca `AccionesProforma` ni la lógica de conversión a factura.
- No se toca la card de factura asociada.
