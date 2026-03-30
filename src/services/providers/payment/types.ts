export interface PaymentProvider {
  processPayment(orderData: any, config: any, gatewayId?: string): Promise<{ success: boolean; payment_id?: string; error?: string }>;
  refundPayment(paymentId: string, config: any): Promise<{ success: boolean; error?: string }>;
}
