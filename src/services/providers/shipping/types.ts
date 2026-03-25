export interface ShippingPackage {
  weight: number;
  height: number;
  width: number;
  length: number;
}

export interface ShippingQuote {
  id: string;
  name: string;
  price: number;
  deadline: string;
  provider: string;
  carrierName: string;
}

export interface ShippingProvider {
  calculateShipping(destZipCode: string, packages: ShippingPackage[], config: any): Promise<ShippingQuote[]>;
  generateLabel(orderId: string, config: any): Promise<{ success: boolean; tracking_code?: string; error?: string }>;
  cancelLabel(orderId: string, config: any): Promise<{ success: boolean; error?: string }>;
}
