# Revisión de errores de Sentry (13/10/2026)

Hay 8 problemas abiertos. 6 son de Librecarga y 2 de LiftGO (otro proyecto, no se tocan).

## Fallas reales que hay que corregir
1. **JAVASCRIPT-REACT-80**: al dar de alta a un agente desde Usuarios falta el proveedor (`proveedor_id` vacío). Revisar `user-management/agenteHandlers.ts`. Probablemente choca con el alta provisional nueva: hay que crear o exigir el proveedor antes de guardar el agente, y mostrar un mensaje claro en lugar del error.
2. **JAVASCRIPT-REACT-7Z**: «function max(uuid) does not exist» en el detalle de cotización. Primero se busca la consulta o función de la base que lo causa. Si está en la base, se corrige con una migración pequeña (te pido permiso antes).
3. **JAVASCRIPT-REACT-82**: no se pudo leer un PDF en Compras → Buzón (3 veces en los últimos minutos). Se revisan los registros de `parse-invoice-pdf`. Si el problema es el archivo, solo se mejora el mensaje. Si es un error del código, se corrige.
4. **JAVASCRIPT-REACT-81**: un error genérico de función en la página de inicio. Se averigua de qué función viene. Si ya está cubierto por otro caso, se cierra.

## Se quedan abiertos (son casos de datos, no del código)
- **7Q**: la factura 892 no tiene tipo de cambio. Contabilidad tiene que corregirla.
- **77**: el saldo del complemento de pago no cuadra. Contabilidad tiene que revisarlo.

## Cierre
- Marcar en Sentry como resueltos los casos que se corrijan y anotar sus IDs en el CHANGELOG.
- Solo se ejecutan las pruebas de lo que se toque. CI y RLS completos quedan para GitHub Actions.
- No se publica la app.
