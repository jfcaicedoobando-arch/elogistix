## Diagnóstico

La tabla de **Embarques sin factura** está filtrando con una regla demasiado estrecha: sólo considera como “factura viva” a `facturas.estado = 'Emitida'`.

En los casos reportados:

- `ELIMP00007`: 10 conceptos, 0 pendientes, bridge activo, factura `726` en estado `Pagada`.
- `ELIMP00020`: 2 conceptos, 0 pendientes, bridge activo, factura `799` en estado `Pagada`.
- `ELIMP00022`: 8 conceptos, 0 pendientes, bridge activo, factura `755` en estado `Pagada`.

Por eso aparecen en el hueco: es como si el guardia de entrada sólo reconociera gafetes que dicen “Emitida”, pero dejara pasar “Pagada”, aunque “Pagada” también significa que ya existe factura.

## Plan de corrección

1. **Centralizar estados que sí cuentan como factura viva**
   - Agregar una constante del módulo de hueco con estados válidos para ocultar embarques:
     - `Emitida`
     - `Pagada`
     - `Vencida`
     - `Parcialmente pagada`
   - Mantener fuera:
     - `Borrador`
     - `Por timbrar`
     - `Cancelada`
     - `Sustituida` si no hay una sustituta viva vinculada.

2. **Corregir la consulta por bridge canónico**
   - En `fetchEmbarquesConFacturaViva`, cambiar el filtro actual de `estado = 'Emitida'` por `estado IN (...)` usando la constante.
   - Mantener `factura_embarques.activa = true` como fuente principal.

3. **Corregir fallback legacy por expediente**
   - En `fetchExpedientesConFacturaVivaLegacy`, usar la misma lista de estados vivos.
   - Mantener el requisito de PDF para facturas legacy, para no ocultar por borradores o registros incompletos.

4. **Agregar tests de regresión**
   - Caso bridge activo + factura `Pagada` debe excluir el embarque.
   - Caso fallback legacy + factura `Pagada` debe excluir el embarque.
   - Caso `Cancelada` debe seguir sin ocultar el embarque.
   - Caso concepto nuevo `pendiente` debe seguir re-apareciendo aunque exista factura viva, como se acordó en la fase anterior.

5. **Actualizar versión y changelog**
   - Bump de `APP_VERSION`.
   - Entrada breve en `CHANGELOG.md` explicando que el hueco ya reconoce facturas pagadas/parcialmente pagadas/vencidas como facturadas.