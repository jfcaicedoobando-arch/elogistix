

# Changelog Page

## New file: `src/pages/Changelog.tsx`

Create a page displaying all features organized by date with semantic versioning. Based on the conversation history and codebase, the changelog entries are:

### Version History

- **v1.0.0** — Initial release: Dashboard with KPIs and charts, Embarques list and detail, Facturacion module, Clientes module with detail view, Proveedores module with CRUD, Reportes page, Sidebar navigation, mock data structure
- **v1.1.0** — New Client wizard: two-step dialog with mandatory document upload (CIF, opinion fiscal, acta constitutiva, etc.) before creating a client
- **v1.2.0** — New Embarque wizard: 4-step form (Datos Generales, Datos de Ruta, Documentos, Costos y Pricing) with port/shipping line selects, container types
- **v1.2.1** — Maritime route validation: all fields mandatory in Step 2 for maritime shipments except BL Master and BL House
- **v1.3.0** — Costos y Pricing: dynamic sales concepts and cost rows with add/remove, subtotal calculation, estimated profit (Utilidad Estimada)
- **v1.3.1** — Maritime concept dropdowns: "Flete marítimo" and "Revalidación" options for concept fields when mode is Marítimo
- **v1.3.2** — Simplified pricing: removed IVA (16%) and Total (Con IVA) lines, keeping only Subtotal (Sin IVA) as manual entry

### UI Design
- Clean timeline/card layout with version badges, dates, and descriptions
- Color-coded badges: major (red), minor (blue), patch (gray)

### Routing
- Add `/changelog` route in `App.tsx`
- Add "Changelog" menu item in `AppSidebar.tsx` with `ScrollText` icon

