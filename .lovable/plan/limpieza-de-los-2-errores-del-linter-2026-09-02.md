# Limpieza de los 2 errores del linter

`eslint` reporta exactamente 2 errores (0 advertencias), ambos de la misma regla
`complexity` (máximo 16 ramas por función) y ambos en archivos tocados en las
últimas rondas. No hay bugs de comportamiento: es deuda de estructura.

```text
src/features/portal/components/factura/PortalFacturaPagosCard.tsx  complejidad 32
supabase/functions/facturapi-webhook/index.ts (handler)            complejidad 17
```

Analogía: son dos recetas que crecieron hasta ocupar una sola hoja llenísima.
El guiso sabe bien; sólo hay que separarla en dos hojas para poder leerla.

## Qué se va a hacer

### 1. Tarjeta de pagos del portal (complejidad 32 → dentro del límite)

La tarjeta hoy hace tres cosas en un solo bloque: la lista de pagos, la lista de
notas de crédito y el resumen de totales/saldo. Se dividirá en componentes
hermanos dentro de la misma carpeta, sin cambiar nada de lo que ve el cliente:

- una pieza para la lista de pagos (fecha, forma de pago, descargas de REP,
  importe y su equivalencia cuando la moneda difiere),
- una pieza para las notas de crédito aplicadas,
- una pieza para el bloque de totales (facturado, pagos, notas, saldo),
- el componente actual se queda como contenedor: encabezado, badge de
  "Liquidada / Saldo pendiente", estado de carga, estado vacío y el aviso de
  lista truncada.

Los cálculos de saldo, el uso del agregado completo de la base y el aviso de
"se muestran los N más recientes" se conservan tal cual.

### 2. Webhook de FacturApi (complejidad 17 → dentro del límite)

El handler encadena validaciones y manejo de dedupe en una sola función. Se
extraen dos ayudantes en el mismo archivo, sin alterar códigos de respuesta ni
el orden de las comprobaciones:

- reservar el evento en la tabla de dedupe (devuelve "duplicado", "no
  disponible" u "ok", incluyendo las alertas que ya se envían),
- liberar la reserva y decidir el 503 reintentable cuando el destino aún no
  existe.

El handler queda como la secuencia legible: método → organización →
credenciales → cuerpo acotado → firma → reserva → despacho → resultado.

## Verificación

- `eslint` sobre los dos archivos: 0 errores.
- Typecheck del proyecto limpio.
- Pruebas focalizadas del portal y del webhook.
- Se registra el cambio en `CHANGELOG.md` y se sube `APP_VERSION`.
- CI completo, suite RLS y auditorías globales quedan para GitHub Actions.

## Fuera de alcance

Sin cambios de comportamiento, de base de datos, de permisos ni de textos
visibles. No se baja el umbral de la regla `complexity`.
