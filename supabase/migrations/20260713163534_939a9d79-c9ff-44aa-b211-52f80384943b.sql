CREATE OR REPLACE FUNCTION public._docs_requeridos_por_estado(p_modo text, p_estado text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_estado
    WHEN 'Confirmado' THEN ARRAY[]::text[]  -- booking sin mercancía cargada: no aplican documentos
    WHEN 'En Tránsito' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'En Aduana' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'Llegada' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'Arribo' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'En Proceso' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'Entregado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'EIR' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'Cerrado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    ELSE ARRAY[]::text[]
  END;
$function$;