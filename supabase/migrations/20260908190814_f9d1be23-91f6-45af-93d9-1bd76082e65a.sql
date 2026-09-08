-- v13.823.221 · CRM: extiende el enum de fuente de leads con los nuevos orígenes.
-- Los valores históricos se migran en una operación de datos aparte.
ALTER TYPE public.crm_lead_fuente ADD VALUE IF NOT EXISTS 'Prospección';
ALTER TYPE public.crm_lead_fuente ADD VALUE IF NOT EXISTS 'Finkargo';