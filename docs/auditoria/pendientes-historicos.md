# Pendientes históricos que requieren verificación

Consolidación documental del **2026-09-26**. No es una auditoría nueva de
Live ni una cola de bugs confirmados. No se aplicó ninguna corrección de datos.

Fuente íntegra anterior:
[planes y reportes del commit b4d86b7](https://github.com/jfcaicedoobando-arch/elogistix/tree/b4d86b7c010b6f8f528f695df0c707b06db030f1).
Estos puntos se preservan porque el cierre no puede inferirse del código.

| Referencia histórica | Qué revisar antes de cerrar/actuar |
| --- | --- |
| Saneamiento 2026-09-13: vínculos factura MXN/costo USD | Monedas/TC e importe realmente aplicado, PDF/XML, banco y estado actual por renglón; incluía casos ya pagados |
| Cotizaciones antiguas sin TC | Paridad histórica justificable de su fecha; nunca usar una fecha disponible cualquiera |
| Marítimos con cantidad cero | Modo FCL/LCL, hijos reales y versión aceptada; cero no implica por sí solo dato inválido |
| COT-2026-0129 / ELIMP00321 | Importe real del cargo según documento/decisión del responsable |
| Reporte RPC-sync 2026-09-22 | Doce filas con created_at próximo a deleted_at; indicio, no prueba de borrado indebido |
| Mapeo histórico CRM Fuente → Origen | Valores actuales y migración realmente aplicada; el frontend ya ofrece Prospección/Finkargo/Referido |
| Roadmap visual antiguo | Tratamiento por renglón, textos de ruta/prospecto, contraste y densidad; reproducir en versión publicada antes de reabrir |
| Traspaso entre cuentas | Layout/TC/resumen en UI actual; no se volvió a probar aquí |
| Memorías de portal/revalidación | Adjuntos y avisos/email marcados antiguos como pendientes: revisar implementación/configuración antes de dar por cerrado |
| Tracking automático u otros planes de producto | Existencia, aprobación y alcance real; una propuesta antigua no es feature obligatoria |

Los conteos/totales de las propuestas viejas pueden ser inconsistentes o haber
cambiado. No reutilizar sus UPDATEs ni suponer que el caso sigue abierto.

## Cierre seguro

1. Consultar estado actual con permiso y registrar fecha/entorno.
2. Distinguir bug de código, dato histórico y decisión de producto.
3. Si requiere alterar dinero/datos, preparar cambios por identificadores,
   evidencia de antes/después y aprobación correspondiente.
4. Cerrar con evidencia o documentar que se descartó/no se reproduce.
5. No hacer cambios de datos ni publicar al mantener esta lista.
