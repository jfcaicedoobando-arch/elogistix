# Auditoría visual — Detalle de factura (F963, Full HD)

## Diagnóstico

Orden actual de la vista:

```text
Header (F963 · Pagada · CLIENTE · Exp · TOTAL)
Actions bar (Enviar · PDF · XML · Más acciones)
[ Emisor           |  Receptor              ]   ← 2 columnas
Datos generales
Timbrado fiscal
Desglose de conceptos
Totales
Historial de pagos
Notas de crédito
Historial de la factura
```

Problemas concretos que se ven en las capturas:

1. **Triple mención del cliente.** Aparece en el header (`ENTERA SALUD ANIMAL…`), otra vez en el card *Receptor* como campo "Cliente" (link), y una tercera vez implícita en la bitácora. En un CFDI el receptor es información fiscal, no un dato de contexto — con verlo una vez en el header basta.
2. **Card Emisor casi vacía ocupando 50% del ancho.** Muestra 2–3 líneas de texto (razón social + RFC) y desperdicia toda la columna izquierda del pliegue. Rompe el equilibrio contra Receptor, que sí tiene 5 campos + validaciones.
3. **"Ver embarque" enterrado en "Más acciones".** El expediente `ELIMP00298` ya está impreso en el header pero no es clickable, y para llegar al embarque hay que abrir el menú overflow. Es la navegación más frecuente desde una factura y hoy toma 2 clics + búsqueda visual.
4. **Timbrado fiscal como card independiente** con solo 4 datos (UUID, folio, serie, fecha emisión). La *fecha de emisión* ya está en *Datos generales*, así que se repite.
5. **Orden por importancia invertido.** Lo primero que un usuario mira en una factura ya emitida es *a quién*, *cuánto* y *si está pagada*. Hoy conceptos y totales quedan por debajo de dos cards fiscales de referencia.
6. **"Datos generales" mezcla dos naturalezas**: fechas/crédito (operativo) con Uso CFDI / Forma / Método de pago (fiscal). El bloque fiscal encajaría mejor junto a Timbrado.

## Recomendación

### 1. Header más limpio + expediente clickable

- Quitar el nombre del cliente del subheader (queda en el card Receptor, que es su lugar fiscal).
- Dejar el subheader como: `Exp: <ELIMP00298 clickable> · Proforma: PRO-2026-0962`. Ambos como enlaces suaves (`text-accent hover:underline`), no botones.
- El chip "Ver embarque" del menú "Más acciones" se elimina — la ruta al embarque es el expediente mismo.

### 2. Fusionar Emisor dentro del header / retirar como card

El emisor es constante para toda la organización. Opciones (elijo B en el plan, pero puedo cambiar si prefieres):

- **A.** Reducirlo a una línea tipo *"Emitido por Elogistix Shipping · ESH2311092R7"* debajo del total en el header.
- **B (recomendada).** Moverlo como bloque colapsable/secundario dentro de *Timbrado fiscal* — donde vive el resto de la información propiamente fiscal del CFDI.

Esto libera la fila superior para que **Receptor ocupe todo el ancho** (que es donde vive la validación fiscal ✓/✗ y donde el usuario realmente decide si puede timbrar).

### 3. Nuevo orden propuesto

```text
Header (F963 · Pagada · Exp🔗 · Proforma🔗 · TOTAL)
Actions bar (sin "Ver embarque")
Receptor (full width, con validaciones ✓/✗)
Datos generales  ← solo fechas + días crédito + tipo cambio + notas + Ref BL
Fiscal del CFDI (merge de Uso/Forma/Método + Timbrado + Emisor compacto)
Desglose de conceptos
Totales (Subtotal · IVA · Total)
Historial de pagos
Notas de crédito
Historial de la factura
```

Racional de la jerarquía: **quién → cuándo/cómo → qué se cobró → cuánto → cobros → ajustes → auditoría.**

### 4. Ajustes menores dentro de los cards

- Card *Receptor*: quitar la fila "Cliente" (redundante con header) y dejar solo los 4 campos fiscales + botón "Completar datos". Eleva la densidad útil.
- Card *Datos generales*: quitar *Uso CFDI / Forma de pago / Método de pago* (se mueven al bloque fiscal). Deja fechas + crédito + tipo de cambio + BL + notas.
- Card *Timbrado fiscal*: quitar *Fecha de emisión* (ya está en Datos generales); añadir Emisor compacto (razón social · RFC) en una fila superior.

## Alcance técnico

Archivos que se tocan (solo presentación, sin cambios de negocio):

- `src/features/facturacion/components/detalle/FacturaDetalleHeader.tsx` — reemplazar cliente por expediente/proforma clickables.
- `src/features/facturacion/components/detalle/FacturaDetalleBody.tsx` — remover grid Emisor|Receptor, dejar Receptor full-width, reordenar bloques.
- `src/features/facturacion/components/detalle/FacturaDetalleActionsBar.tsx` — eliminar entry `ver-embarque` de `buildMore()`.
- `src/features/facturacion/components/detalle/FacturaReceptorCard.tsx` — quitar fila "Cliente".
- `src/features/facturacion/components/detalle/FacturaResumenCard.tsx` — quitar Uso CFDI / Forma / Método.
- `src/features/facturacion/components/detalle/FacturaTimbradoCard.tsx` — absorber Emisor compacto + fiscal (Uso/Forma/Método); quitar fecha emisión.
- `FacturaEmisorCard.tsx` — se elimina como archivo (o se convierte en subcomponente interno del card fiscal).
- Bump `APP_VERSION` (13.308.16) + entrada en `CHANGELOG.md`.

## Verificación

- Playwright a Full HD (1920×1200) sobre F963: capturar 3 secciones (arriba, medio, abajo) y comparar con las capturas actuales que ya tengo.
- Repetir sobre una factura borrador (para confirmar que el flujo sin timbrar sigue mostrando Receptor + acciones correctas) y sobre una cancelada (para asegurar que los banners no chocan con el nuevo orden).
- `bun run lint --max-warnings 0`.

## Fuera de alcance (te lo dejo como preguntas si quieres iterar después)

- ¿Convertir *Totales* en un footer sticky del bloque de conceptos en vez de card aparte? Ganaría densidad pero cambia patrón usado en otras vistas. Si
- ¿Mostrar el saldo en el header como segundo número junto al total cuando `saldo > 0`? Hoy solo lo ves scrolleando hasta *Historial de pagos*. Si