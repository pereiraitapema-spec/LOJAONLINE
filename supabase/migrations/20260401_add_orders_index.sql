-- Add index to orders table for customer_email to speed up queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
