
Re-audit post-Fase 4 (v8.16.0). Reflejo lo resuelto, lo pendiente y lo nuevo. Sin cambios.

Resuelto en Fase 4:
- TabPortalCliente: ya usa hook (useClientUsers) ✅
- SeccionCostosInternosPLUnificado: dividido en Local/Detalle ✅
- useDashboardData: parsers extraídos a lib ✅
- useCotizacionDetalleState: helpers + handlers separados ✅
- useEmbarqueDetalleActions: split en Estado + Documentos ✅

Aún pendiente: DialogConvertirProspecto y OrgSwitcher con supabase directo, EmbarqueDetalle/CotizacionDetalle siguen >500 líneas, useCotizacionWizardForm aún orquesta mucho, lib mezcla puras+services, prop-drilling en wizards, edge functions sin shared utils, tokens semánticos, tests, naming, barrel exports.
