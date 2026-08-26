# Homologar la convención mexicana de tipo de cambio en todo el ERP

## Resultado de la verificación

Revisé todos los lugares del ERP donde se captura o se muestra un tipo de cambio. La buena noticia: **el comportamiento ya es el estándar mexicano** ("cuántos pesos por 1 dólar", ~18.42) en la lógica de cálculo de todos los módulos. La conversión a pesos siempre multiplica, nunca divide, y el helper central de dinero documenta esa regla.

Lo que no está homologado es la **etiqueta**: en algunos formularios dice solo "Tipo de cambio", sin decir el par. El usuario tiene que adivinar si teclea 18.42 o 0.054.

Estado por módulo:

| Módulo | Etiqueta actual | Estado |
|---|---|---|
| Tesorería / traspasos | "Tipo de cambio (MXN por 1 USD)" | Correcto (modelo a seguir) |
| Compras / factura de proveedor | "Tipo de cambio a MXN" | Correcto |
| Anticipos a proveedor | "Tipo de cambio a MXN" | Correcto |
| Embarques / costos | "Tipo de Cambio USD" y "Tipo de Cambio EUR" | Correcto |
| Compras / pago a proveedor | "Tipo de cambio" | Ambiguo |
| Facturación / datos fiscales de factura | "Tipo de cambio" | Ambiguo |
| Facturación / factura manual | "Tipo de cambio" | Ambiguo |
| Facturación / registrar pago de factura | "Tipo de cambio" | Ambiguo |

No encontré ningún formulario que pida el tipo de cambio al revés. El único valor "invertido" que existe es un multiplicador interno que la app calcula sola para el movimiento bancario del traspaso; nunca se le pide al usuario.

## Qué se va a cambiar

Solo texto de interfaz, sin tocar cálculos ni base de datos:

1. Usar la etiqueta dinámica ya existente de tesorería ("Tipo de cambio (MXN por 1 USD)") en los cuatro campos ambiguos, tomando la divisa del documento.
2. Poner un placeholder realista (por ejemplo `18.4200`) en lugar de `0.00`, para que se vea de inmediato la magnitud esperada.
3. Añadir un texto de ayuda breve bajo cada campo: "Pesos que se pagan por 1 USD", más la vista previa del monto convertido donde ya exista ese cálculo.
4. Homologar el `aria-label` de los inputs con la etiqueta visible, para lectores de pantalla y pruebas.

## Detalles técnicos

- Mover `etiquetaTc`/`parTc` de `src/features/tesoreria/domain/tcPar.ts` a un módulo compartido (`src/lib/financial/tcPar.ts`), reexportando desde la ruta actual para no romper imports ni tests existentes.
- Consumirlo en:
  - `src/features/cxp/components/TcPagoField.tsx` (recibe la moneda del pago por props).
  - `src/features/facturacion/components/detalle/DatosFiscalesForm.tsx`.
  - `src/features/facturacion/components/FacturaManualDatosFiscales.tsx`.
  - `src/features/facturacion/components/DialogRegistrarPagoParts.tsx` / `PagoFormFields`.
- Sin cambios en `convertir.ts`, en las RPC, ni en las columnas `tipo_cambio` / `tipo_cambio_usd`: la semántica del valor guardado es la misma.
- Test nuevo en `src/lib/financial/__tests__/tcPar.test.ts` cubriendo la etiqueta para USD, EUR y el caso MXN (sin par).
- Actualizar `CHANGELOG.md` y subir `APP_VERSION` a `13.751.1`.

## Fuera de alcance

No se toca la dirección del cálculo en ningún módulo, porque ya es la correcta.
