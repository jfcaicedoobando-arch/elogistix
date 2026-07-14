CREATE OR REPLACE FUNCTION public._docs_requeridos_por_estado(p_modo text, p_estado text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE p_estado
    WHEN 'Confirmado'  THEN ARRAY[]::text[]
    WHEN 'En Tránsito' THEN ARRAY[]::text[]
    WHEN 'En Aduana' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Llegada' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Arribo' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'En Proceso' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Entregado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'EIR' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Cerrado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    ELSE ARRAY[]::text[]
  END;
$function$;