# EC-10 · Cerrar las pantallas pendientes del T/C de respaldo

El paquete EC-10 ya está aplicado en CxP, Facturación (REP), Profit y el paso de Costos del wizard. Lo que falta son las 5 pantallas que el documento dejó "pendientes de auditoría fina". La auditoría confirma que ninguna de ellas lee la bandera `esFallback`: todas usan el número (17.25 / 18.5) como si fuera oficial.

## Qué está mal hoy

| Pantalla | Problema confirmado |
|---|---|
| Tesorería | El badge muestra "TC DOF $17.2500" incluso cuando el valor es el respaldo, porque solo comprueba que exista un número. Da falsa confianza. Los KPIs y el flujo proyectado a 90 días se valúan con ese número. |
| Bandejas · Cartera | El equivalente en pesos de las tarjetas (total y vencido) se calcula con el respaldo, sin aviso. |
| Detalle de Proveedor | Facturado / Pagado / Pendiente se convierten a pesos con el respaldo, sin aviso. |
| Compras · Reportes | El ranking Top Proveedores y la evolución mensual convierten a pesos con el respaldo, sin aviso. |
| Dashboard Ejecutivo | Ya detecta el respaldo y lo registra en Sentry, pero el usuario no ve nada en pantalla. |

Analogía: es como un termómetro que, cuando se le acaba la batería, en vez de apagarse muestra siempre "25°C". El número parece normal, así que nadie sospecha.

## Qué haremos

Regla única: cuando el tipo de cambio sea de respaldo, la pantalla lo dice. Ninguna de estas 5 pantallas guarda dinero, así que **no bloqueamos nada** — solo avisamos, igual que ya hace el Dashboard Dirección.

1. **Reutilizar el aviso existente** (`TipoCambioFallbackBanner`, el mismo banner "Tipo de cambio estimado" que ya se ve en Dirección y en Profit) en: Tesorería, Cartera de Bandejas, detalle de Proveedor, Compras · Reportes y Dashboard Ejecutivo.
2. **Corregir el badge engañoso de Tesorería**: si el T/C es de respaldo, el badge deja de decir "TC DOF" y pasa a decir "T/C estimado" con estilo de advertencia.
3. **Marcar los importes convertidos**: en las tarjetas de Cartera, Proveedor y Compras, los montos equivalentes en pesos llevarán un indicador de "estimado" (tooltip) cuando aplique, para que nadie los copie a un documento fiscal.
4. **Actualizar el documento EC-10** para que la fila de "pendiente de auditoría fina" quede cerrada.

## Detalles técnicos

- Los hooks `useResumenTesoreria`, `useFlujoProyectado`, `useCarteraPage`, `useProveedorDetalleController` y `ComprasReportes` hoy descartan `esFallback` al desestructurar solo `usdMxn`; se propagará la bandera hacia el componente de presentación (sin cambiar cálculos ni queries).
- `TipoCambioFallbackBanner` ya solo depende de `useExchangeRates()`, así que se monta directo en cada página; no se duplica lógica.
- Sin cambios de base de datos, sin migraciones y sin tocar reglas de negocio ni valores calculados.
- Se respetan los límites de "Power of 10": si un archivo pasa de 200 líneas al añadir el aviso, se extrae la sección a un subcomponente.
- Se añaden pruebas de que cada pantalla renderiza el aviso cuando `esFallback` es verdadero y no lo renderiza cuando el T/C es oficial.
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION` a **13.658.0**.
