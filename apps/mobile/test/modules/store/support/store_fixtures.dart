import 'package:mobile/modules/store/model/store_entity.dart';

// Nome, slug, endereço, ponto e raio de
// `apps/backend/prisma/seed/data/stores.json`; o seed não fixa o id.
const paulista = Store(
  id: '0d4e5a52-7a4f-4c1b-9f43-2d1c0b6a1001',
  name: 'Loja Paulista',
  slug: 'loja-paulista',
  address:
      'Avenida Paulista, 2073 – Conjunto Nacional, Bela Vista, São Paulo/SP',
  latitude: -23.558131,
  longitude: -46.660232,
  deliveryRadiusMeters: 2500,
);

const rioBranco = Store(
  id: '0d4e5a52-7a4f-4c1b-9f43-2d1c0b6a1002',
  name: 'Loja Rio Branco',
  slug: 'loja-rio-branco',
  address: 'Avenida Rio Branco, 156 – Centro, Rio de Janeiro/RJ',
  latitude: -22.906847,
  longitude: -43.177256,
  deliveryRadiusMeters: 2500,
);
