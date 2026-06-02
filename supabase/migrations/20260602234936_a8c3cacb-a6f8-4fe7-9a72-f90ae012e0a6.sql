ALTER TABLE public.navieras ADD COLUMN IF NOT EXISTS tracking_url_template text;

WITH tpl(code, url) AS (VALUES
  ('COSU','https://elines.coscoshipping.com/ebusiness/cargoTracking?billNo={BL}'),
  ('MAEU','https://www.maersk.com/tracking/{BL}'),
  ('MSCU','https://www.msc.com/track-a-shipment?agencyPath=mscu&searchNumber={BL}'),
  ('HLCU','https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?blno={BL}'),
  ('ONEY','https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam={BL}'),
  ('CMDU','https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=BL&Reference={BL}'),
  ('EGLV','https://www.evergreen-line.com/static/jsp/cargoTracking.jsp?BL={BL}'),
  ('YMLU','https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx?bl_no={BL}'),
  ('HDMU','https://www.hmm21.com/cms/business/ebiz/trackTrace/trackTrace/index.jsp?type=2&number={BL}'),
  ('ZIMU','https://www.zim.com/tools/track-a-shipment?consnumber={BL}'),
  ('OOLU','https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx?BLNumber={BL}')
)
UPDATE public.navieras n
SET tracking_url_template = tpl.url
FROM tpl
WHERE upper(n.code) = tpl.code
  AND n.tracking_url_template IS NULL;