import { shippingService } from './src/services/shippingService';

async function testShippingService() {
  const destZipCode = '01001000';
  const packages = [{ weight: 0.5, height: 10, width: 10, length: 10 }];
  const carrierId = '978e1b2c-b996-47f7-b2b3-0e76e54973c2'; // CEPCERTO id from check_db_simple.ts

  console.log('📦 Testando shippingService.calculateShipping...');
  try {
    const quotes = await shippingService.calculateShipping(destZipCode, packages, carrierId);
    console.log('📦 Cotações recebidas:', JSON.stringify(quotes, null, 2));
  } catch (err) {
    console.error('❌ Erro no shippingService.calculateShipping:', err);
  }
}

testShippingService();
