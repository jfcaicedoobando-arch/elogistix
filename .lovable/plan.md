# Verificación ampliada: XML de la factura y de sus REPs

Hoy el botón "Verificar estatus en FacturApi" (detalle de factura) sólo compara el estado de la factura contra lo que reporta FacturApi. La nueva versión, en el mismo clic, descargará y leerá el XML del CFDI y el de **todos** los REPs timbrados de esa factura (incluidos cancelados), comparará sus datos contra la base de datos y consultará el estatus real en el SAT por UUID.

## Qué verá el usuario

Al abrir el diálogo, además de las tarjetas actuales:

1. **Tarjeta "CFDI (XML)"** — UUID, RFC emisor, RFC receptor, total, moneda y fecha leídos del XML real, con marca verde si coinciden con la base de datos y marca roja donde difieran.
2. **Estatus SAT** — badge por documento: Vigente / Cancelado / No encontrado / No verificable.
3. **Sección "REPs (complementos de pago)"** — una fila por REP con folio, UUID, monto y moneda del XML, su estatus en el SAT y su estatus en FacturApi, más el aviso cuando el REP local no concuerda.
4. **Divergencias** — las diferencias encontradas en XML/SAT se suman a la lista de divergencias existente, distinguiendo si son de la factura o de un REP.

Reconciliación automática: se mantiene la ya existente para la factura y se extiende a los REPs cuando el SAT/FacturApi los reportan cancelados y la base de datos aún no (mismo criterio que el cron de reconciliación).

## Detalles técnicos

**Edge function `facturapi-consultar`**
- Nuevo módulo local `xmlSat.ts` dentro de la carpeta de la función (el bundle sólo admite mismo folder o `_shared/`):
  - `descargarXml(apiKey, facturapiId)`: `GET {FACTURA PI_BASE}/invoices/{id}/xml` con `basicAuthHeader` (mismo patrón que `facturapi-descargar`).
  - `leerMetaCfdi(xml)`: parseo por regex (Deno no tiene DOMParser garantizado en edge) de `Comprobante@Total|Moneda|Fecha|Serie|Folio`, `Emisor@Rfc`, `Receptor@Rfc` y `TimbreFiscalDigital@UUID`.
  - `verificarSat(meta)`: reutiliza `_shared/satConsulta.ts` (`consultarSat`, `mapEstatus`, `normalizarRfc`) — sin duplicar reglas.
- Carga los REPs de la factura: `pagos_factura` filtrando `facturapi_rep_id` no nulo y sin prefijo `PENDING:` (se incluyen los cancelados), acotado a la organización de la factura.
- Consultas de XML + SAT en paralelo con límite de concurrencia y `withFacturapiTimeout` para no exceder el tiempo de la función; cada documento falla de forma aislada (`estatus: "Error"`) sin tumbar la respuesta.
- Comparación XML↔BD: UUID, total, moneda y RFC receptor de la factura; UUID, monto y moneda del REP. Tolerancia de 0.01 en importes.
- Respuesta ampliada (retrocompatible, sólo campos nuevos):
  ```ts
  xml: { uuid, rfc_emisor, rfc_receptor, total, moneda, fecha, estatus_sat, diferencias: string[] } | null
  reps: Array<{ pago_id, folio, uuid, monto, moneda, estado_rep, rep_cancellation_status,
                remoto_cancellation_status, estatus_sat, diferencias: string[] }>
  ```
- Bitácora: acción `facturapi_consulta_xml_sat` con el resumen (documentos revisados, divergencias).

**Frontend**
- `services/facturapiConsultar.ts`: extender `ConsultarFacturapiResult` con `xml` y `reps` (opcionales).
- Nuevos componentes en `components/detalle/`: `ConsultaXmlCard.tsx` y `ConsultaRepsTable.tsx`, montados dentro de `DialogConsultarFacturapiResult.tsx` (se mantiene el límite de 200 líneas por archivo dividiendo en subcomponentes).
- El diálogo pasa a `max-w-3xl` y agrupa el contenido en secciones con títulos; el spinner indica "Consultando FacturApi y SAT…" porque la consulta ahora tarda más.
- Tokens semánticos y etiquetas es-MX; importes con los helpers de formato existentes.

**Pruebas y cierre**
- Tests Deno para `leerMetaCfdi` (CFDI 4.0 con y sin serie, REP con complemento de pagos) y para la comparación XML↔BD.
- Test de UI de las nuevas tarjetas con datos simulados (coincide / difiere / error).
- `supabase/config.toml` sin cambios; se redespliega `facturapi-consultar`.
- Bump de `APP_VERSION` a `13.593.0` y entrada en `CHANGELOG.md`.
