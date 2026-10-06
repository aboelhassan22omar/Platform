import { z } from 'zod';
import type { StoreOrder, StoreProduct, StoreRate, CartItem } from './store.types';
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().int().min(1).max(10);
const text = z.string().max(2000);
export const productSchema: z.ZodType<StoreProduct> = z.object({
  id: text,
  title: text,
  description: text,
  kind: z.enum(['BOOK', 'NOTES', 'BUNDLE']),
  grade: z.enum(['SEC_1', 'SEC_2', 'SEC_3', 'BACC_1', 'BACC_2']),
  priceMinor: money,
  compareAtMinor: money.nullable(),
  stock: z.number().int().nonnegative(),
  allowCod: z.boolean(),
  active: z.boolean(),
  featured: z.boolean(),
  pages: z.number().int().nonnegative(),
  image: text.nullable(),
  highlights: z.array(text).max(100),
});
const rateSchema: z.ZodType<StoreRate> = z.object({
  code: text,
  name: text,
  region: text,
  priceMinor: money,
});
const cartSchema: z.ZodType<CartItem> = z.object({ productId: text, quantity });
const deliverySchema = z.object({
  customerName: text,
  phone: text,
  alternatePhone: text,
  governorate: text,
  city: text,
  address: text,
  landmark: text,
  building: text,
  floor: text,
  apartment: text,
  notes: text,
});
const orderSchema: z.ZodType<StoreOrder> = z.object({
  reference: text,
  createdAt: text,
  delivery: deliverySchema,
  items: z.array(z.object({ product: productSchema, quantity })),
  subtotalMinor: money,
  shippingMinor: money,
  totalMinor: money,
  method: z.enum(['COD', 'VODAFONE_CASH', 'INSTAPAY']),
  status: z.enum([
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
  ]),
  paymentStatus: z.enum(['UNPAID', 'SUBMITTED', 'PAID', 'REJECTED']),
  transferReference: text.optional(),
  note: text.optional(),
  trackingNumber: text.optional(),
});
export const catalogSnapshotSchema = z.object({
  products: z.array(productSchema).max(1000),
  rates: z.array(rateSchema).max(100),
  cart: z.array(cartSchema).max(1000),
});
export const orderSnapshotSchema = z.array(orderSchema).max(1000);
