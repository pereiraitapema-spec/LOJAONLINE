export interface PaymentProvider {
  processPayment(orderData: any, config: any): Promise<{ success: boolean; payment_id?: string; error?: string }>;
  refundPayment(paymentId: string, config: any): Promise<{ success: boolean; error?: string }>;
}
