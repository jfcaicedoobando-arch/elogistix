SET LOCAL app.bypass_cierre = 'on';
UPDATE public.embarques
SET facturado_historico = true
WHERE id IN (
  '88488697-08a4-4eb9-a6fb-3b4d00096506',
  'eac3b411-354e-44f8-8716-5c0ddd30d495',
  '85f3de0d-e433-4e32-9059-7cb311c8b2ff',
  '20890ffb-7045-4e08-b158-9e59360e1672',
  'e554c703-f464-4c63-b9e8-24f002cf5072',
  '06800b24-4cd5-433f-9a06-9765068ff33e',
  '85e96efe-174a-462f-aecb-3f011ad20bdd',
  '21dcb977-ff98-4e0b-b8a8-5ecad3b43eec',
  '95f83696-ccfa-4dc6-a139-38eec034645b',
  'b15ec5db-7ff4-4f91-a24f-ea46cc5e1b7c',
  '403fee7b-8b1f-47c8-9e27-8afaca8a4458',
  '72191ae8-46b0-4278-95dd-10ab6fd9e400',
  'b0c4e79c-f9aa-4b9b-b972-38d97d6c85f2'
);