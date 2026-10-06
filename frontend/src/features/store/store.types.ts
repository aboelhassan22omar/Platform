export type StoreKind = 'BOOK' | 'NOTES' | 'BUNDLE';
export type StoreGrade = 'SEC_1' | 'SEC_2' | 'SEC_3' | 'BACC_1' | 'BACC_2';
export type StoreMethod = 'COD' | 'VODAFONE_CASH' | 'INSTAPAY';
export type StoreStatus =
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';
export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  kind: StoreKind;
  grade: StoreGrade;
  priceMinor: number;
  compareAtMinor: number | null;
  stock: number;
  allowCod: boolean;
  active: boolean;
  featured: boolean;
  pages: number;
  image: string | null;
  highlights: string[];
}
export interface StoreRate {
  code: string;
  name: string;
  region: string;
  priceMinor: number;
}
export interface CartItem {
  productId: string;
  quantity: number;
}
export interface DeliveryDetails {
  customerName: string;
  phone: string;
  alternatePhone: string;
  governorate: string;
  city: string;
  address: string;
  landmark: string;
  building: string;
  floor: string;
  apartment: string;
  notes: string;
}
export interface StoreOrder {
  reference: string;
  createdAt: string;
  delivery: DeliveryDetails;
  items: { product: StoreProduct; quantity: number }[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  method: StoreMethod;
  status: StoreStatus;
  paymentStatus: 'UNPAID' | 'SUBMITTED' | 'PAID' | 'REJECTED';
  transferReference?: string;
  note?: string;
  trackingNumber?: string;
}
