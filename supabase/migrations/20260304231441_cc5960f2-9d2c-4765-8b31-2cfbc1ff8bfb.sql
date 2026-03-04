
-- Tabla de puertos configurable
CREATE TABLE public.puertos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  country text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.puertos ENABLE ROW LEVEL SECURITY;

-- Lectura para todos los autenticados
CREATE POLICY "Autenticados pueden leer puertos"
  ON public.puertos FOR SELECT TO authenticated
  USING (true);

-- CRUD solo para admins
CREATE POLICY "Admins CRUD puertos"
  ON public.puertos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed data
INSERT INTO public.puertos (code, name, country) VALUES
('CNSHA','Shanghai','China'),('CNNGB','Ningbo','China'),('CNSHE','Shenzhen','China'),('CNQIN','Qingdao','China'),('CNTIA','Tianjin','China'),('CNGUA','Guangzhou','China'),('CNXIA','Xiamen','China'),('CNDAL','Dalian','China'),('HKHKG','Hong Kong','Hong Kong'),('SGSIN','Singapore','Singapur'),('KRPUS','Busan','Corea del Sur'),('KRINC','Incheon','Corea del Sur'),('JPYOK','Yokohama','Japón'),('JPTYO','Tokyo','Japón'),('JPKOB','Kobe','Japón'),('JPNGO','Nagoya','Japón'),('JPOSA','Osaka','Japón'),('TWTPE','Taipei','Taiwán'),('TWKHH','Kaohsiung','Taiwán'),('VNSGN','Ho Chi Minh','Vietnam'),('VNHPH','Hai Phong','Vietnam'),('THBKK','Bangkok','Tailandia'),('THLCH','Laem Chabang','Tailandia'),('MYKLG','Port Klang','Malasia'),('MYTPP','Tanjung Pelepas','Malasia'),('IDJKT','Jakarta','Indonesia'),('IDSUB','Surabaya','Indonesia'),('PHMNL','Manila','Filipinas'),('INMUN','Mumbai (Nhava Sheva)','India'),('INMAA','Chennai','India'),('INCCU','Kolkata','India'),('INDEL','Delhi (ICD)','India'),('INBLR','Bangalore (ICD)','India'),('BDCGP','Chittagong','Bangladesh'),('LKCMB','Colombo','Sri Lanka'),('PKKHI','Karachi','Pakistán'),
('AEJEA','Jebel Ali','EAU'),('AEDXB','Dubai','EAU'),('AEAUH','Abu Dhabi','EAU'),('SAJED','Jeddah','Arabia Saudita'),('SADMM','Dammam','Arabia Saudita'),('OMMUS','Muscat','Omán'),('OMSLL','Salalah','Omán'),('BHRUH','Khalifa Bin Salman','Baréin'),('QADOH','Doha','Catar'),('KWKWI','Kuwait','Kuwait'),('IRBND','Bandar Abbas','Irán'),('TRMER','Mersin','Turquía'),('TRIST','Estambul (Ambarli)','Turquía'),('ILHFA','Haifa','Israel'),
('NLRTM','Rotterdam','Países Bajos'),('NLAMS','Ámsterdam','Países Bajos'),('BEANR','Amberes','Bélgica'),('DEHAM','Hamburgo','Alemania'),('DEBRV','Bremerhaven','Alemania'),('GBFXT','Felixstowe','Reino Unido'),('GBLGP','London Gateway','Reino Unido'),('GBSOU','Southampton','Reino Unido'),('FRLEH','Le Havre','Francia'),('FRMRS','Marsella','Francia'),('ESALG','Algeciras','España'),('ESVLC','Valencia','España'),('ESBCN','Barcelona','España'),('ITGOA','Génova','Italia'),('ITGIT','Gioia Tauro','Italia'),('ITLIV','Livorno','Italia'),('GRPIR','El Pireo','Grecia'),('PTLIS','Lisboa','Portugal'),('PTSIE','Sines','Portugal'),('SEGOT','Gotemburgo','Suecia'),('DKAAR','Aarhus','Dinamarca'),('FIHEL','Helsinki','Finlandia'),('NOOSL','Oslo','Noruega'),('PLGDN','Gdansk','Polonia'),('RULED','San Petersburgo','Rusia'),('RUVVO','Vladivostok','Rusia'),('MTMAR','Marsaxlokk','Malta'),
('USLAX','Los Ángeles','EE.UU.'),('USLGB','Long Beach','EE.UU.'),('USNYC','New York / New Jersey','EE.UU.'),('USSAV','Savannah','EE.UU.'),('USHOU','Houston','EE.UU.'),('USCHA','Charleston','EE.UU.'),('USSEA','Seattle / Tacoma','EE.UU.'),('USOAK','Oakland','EE.UU.'),('USMIA','Miami','EE.UU.'),('USNOR','Norfolk','EE.UU.'),('USBOS','Boston','EE.UU.'),('USBAL','Baltimore','EE.UU.'),('CAMTR','Montreal','Canadá'),('CAVAN','Vancouver','Canadá'),('CAHAL','Halifax','Canadá'),('CATOR','Toronto','Canadá'),
('MXZLO','Manzanillo','México'),('MXLZC','Lázaro Cárdenas','México'),('MXVER','Veracruz','México'),('MXATM','Altamira','México'),('MXESE','Ensenada','México'),('MXPRO','Progreso','México'),('MXSAL','Salina Cruz','México'),('MXTAM','Tampico','México'),
('PAPCN','Colón (Panamá)','Panamá'),('PAPBL','Balboa (Panamá)','Panamá'),('CRLIO','Puerto Limón','Costa Rica'),('GTPRQ','Puerto Quetzal','Guatemala'),('GTSTO','Santo Tomás de Castilla','Guatemala'),('HNPCR','Puerto Cortés','Honduras'),('JMKIN','Kingston','Jamaica'),('DOHAI','Haina','Rep. Dominicana'),('DOCAU','Caucedo','Rep. Dominicana'),('BSFPO','Freeport','Bahamas'),
('BRSSZ','Santos','Brasil'),('BRITA','Itajaí','Brasil'),('BRPNG','Paranaguá','Brasil'),('BRRIG','Rio Grande','Brasil'),('ARBUE','Buenos Aires','Argentina'),('CLSAI','San Antonio','Chile'),('CLVAP','Valparaíso','Chile'),('COBUN','Buenaventura','Colombia'),('COCTG','Cartagena','Colombia'),('PECLL','Callao','Perú'),('ECGYE','Guayaquil','Ecuador'),('UYMVD','Montevideo','Uruguay'),('VEGUA','La Guaira','Venezuela'),
('ZADUR','Durban','Sudáfrica'),('ZACPT','Ciudad del Cabo','Sudáfrica'),('EGPSD','Port Said','Egipto'),('EGALX','Alejandría','Egipto'),('MATNG','Tánger Med','Marruecos'),('MACAS','Casablanca','Marruecos'),('NGAPP','Apapa (Lagos)','Nigeria'),('KEMBA','Mombasa','Kenia'),('TZDAR','Dar es Salaam','Tanzania'),('DJJIB','Djibouti','Yibuti'),('MUPLU','Port Louis','Mauricio'),
('AUMEL','Melbourne','Australia'),('AUSYD','Sídney','Australia'),('AUBNE','Brisbane','Australia'),('AUFRE','Fremantle','Australia'),('NZAKL','Auckland','Nueva Zelanda'),('NZTRG','Tauranga','Nueva Zelanda');
