export interface ShippingPackage {
  weight: number;
  height: number;
  width: number;
  length: number;
  price?: number;
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
  generateLabel(orderId: string, config: any): Promise<{ success: boolean; tracking_code?: string; shipping_label_url?: string; error?: string }>;
  cancelLabel(orderId: string, config: any): Promise<{ success: boolean; error?: string }>;
  getTrackingStatus(trackingCode: string, config: any): Promise<{ status: string; history: { date: string; location: string; description: string }[] }>;
  getBalance?(config: any): Promise<any>;
  generatePix?(amount: number, email: string, phone: string, config: any): Promise<any>;
  consultPostage?(trackingCode: string, config: any): Promise<any>;
  getFinancialStatement?(config: any): Promise<any>;
  getTrackingInfo?(trackingCode: string, config: any): Promise<any>;
}
