import { cartTotals } from './cart-totals';
import type {
  CartItem,
  DeliveryDetails,
  StoreMethod,
  StoreOrder,
  StoreProduct,
  StoreRate,
  StoreStatus,
} from './store.types';

export interface StoreState {
  ready: boolean;
  products: StoreProduct[];
  rates: StoreRate[];
  cart: CartItem[];
  orders: StoreOrder[];
}

export type StoreAction =
  | { type: 'hydrate'; state: StoreState }
  | { type: 'cart.add'; id: string }
  | { type: 'cart.quantity'; id: string; quantity: number }
  | { type: 'cart.remove'; id: string }
  | { type: 'product.save'; product: StoreProduct }
  | { type: 'shipping.update'; region: string; priceMinor: number }
  | { type: 'order.place'; order: StoreOrder }
  | { type: 'payment.submit'; reference: string; transferReference: string }
  | {
      type: 'order.update';
      reference: string;
      status: StoreStatus;
      paymentStatus?: StoreOrder['paymentStatus'];
      note?: string;
      trackingNumber?: string;
    };

export function selectCartItems(state: Pick<StoreState, 'cart' | 'products'>) {
  return state.cart.flatMap((item) => {
    const product = state.products.find((product) => product.id === item.productId);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
}

/** Called before checkout dispatch so the caller receives the exact saved snapshot. */
export function createOrderSnapshot(
  state: StoreState,
  delivery: DeliveryDetails,
  method: StoreMethod,
  reference: string,
  createdAt: string,
): StoreOrder {
  const items = selectCartItems(state);
  if (
    !items.length ||
    items.length !== state.cart.length ||
    items.some((item) => !item.product.active || item.product.stock < item.quantity)
  )
    throw new Error('في منتج غير متاح بالكمية المطلوبة. راجع العربة.');
  const rate = state.rates.find((rate) => rate.code === delivery.governorate);
  if (!rate) throw new Error('اختار المحافظة عشان نحسب الشحن.');
  const totals = cartTotals(items, rate.priceMinor);
  if (method === 'COD' && !totals.codAllowed)
    throw new Error('بعض المنتجات متاحة بالدفع الإلكتروني فقط.');
  return {
    reference,
    createdAt,
    delivery: { ...delivery },
    items: items.map((item) => ({
      ...item,
      product: { ...item.product, highlights: [...item.product.highlights] },
    })),
    subtotalMinor: totals.subtotalMinor,
    shippingMinor: totals.shippingMinor,
    totalMinor: totals.totalMinor,
    method,
    status: method === 'COD' ? 'CONFIRMED' : 'AWAITING_PAYMENT',
    paymentStatus: 'UNPAID',
  };
}

const NEXT_STATUSES: Record<StoreStatus, readonly StoreStatus[]> = {
  AWAITING_PAYMENT: ['AWAITING_PAYMENT', 'CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Pure, atomic transitions: order status, inventory and cart always change together. */
export function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'hydrate':
      return { ...action.state, ready: true };
    case 'cart.add': {
      const product = state.products.find((product) => product.id === action.id && product.active);
      if (!product || product.stock < 1) return state;
      const existing = state.cart.find((item) => item.productId === action.id);
      const cart = existing
        ? state.cart.map((item) =>
            item.productId === action.id
              ? { ...item, quantity: Math.min(item.quantity + 1, product.stock, 10) }
              : item,
          )
        : [...state.cart, { productId: action.id, quantity: 1 }];
      return { ...state, cart };
    }
    case 'cart.quantity': {
      const product = state.products.find((product) => product.id === action.id);
      if (!product || product.stock < 1 || !Number.isFinite(action.quantity)) return state;
      return {
        ...state,
        cart: state.cart.map((item) =>
          item.productId === action.id
            ? {
                ...item,
                quantity: Math.max(1, Math.min(10, Math.trunc(action.quantity), product.stock)),
              }
            : item,
        ),
      };
    }
    case 'cart.remove':
      return { ...state, cart: state.cart.filter((item) => item.productId !== action.id) };
    case 'product.save':
      return {
        ...state,
        products: state.products.some((product) => product.id === action.product.id)
          ? state.products.map((product) =>
              product.id === action.product.id ? action.product : product,
            )
          : [...state.products, action.product],
      };
    case 'shipping.update': {
      if (!Number.isSafeInteger(action.priceMinor) || action.priceMinor < 0) return state;
      return {
        ...state,
        rates: state.rates.map((rate) =>
          rate.region === action.region ? { ...rate, priceMinor: action.priceMinor } : rate,
        ),
      };
    }
    case 'order.place': {
      if (state.orders.some((order) => order.reference === action.order.reference)) return state;
      // Revalidate against the current inventory, not a render's stale closure.
      const order = createOrderSnapshot(
        state,
        action.order.delivery,
        action.order.method,
        action.order.reference,
        action.order.createdAt,
      );
      return {
        ...state,
        cart: [],
        orders: [order, ...state.orders],
        products: state.products.map((product) => ({
          ...product,
          stock:
            product.stock -
            (order.items.find((item) => item.product.id === product.id)?.quantity ?? 0),
        })),
      };
    }
    case 'payment.submit': {
      if (!action.transferReference.trim()) return state;
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.reference === action.reference &&
          order.method !== 'COD' &&
          order.status === 'AWAITING_PAYMENT' &&
          order.paymentStatus !== 'PAID'
            ? {
                ...order,
                transferReference: action.transferReference.trim(),
                paymentStatus: 'SUBMITTED',
                note: undefined,
              }
            : order,
        ),
      };
    }
    case 'order.update': {
      const previous = state.orders.find((order) => order.reference === action.reference);
      if (!previous || !NEXT_STATUSES[previous.status].includes(action.status)) return state;
      const paymentStatus = action.paymentStatus ?? previous.paymentStatus;
      if (
        action.status !== 'CANCELLED' &&
        action.status !== 'AWAITING_PAYMENT' &&
        previous.method !== 'COD' &&
        paymentStatus !== 'PAID'
      )
        return state;
      if (
        previous.method !== 'COD' &&
        action.paymentStatus === 'PAID' &&
        previous.paymentStatus !== 'SUBMITTED' &&
        previous.paymentStatus !== 'PAID'
      )
        return state;
      const products =
        action.status === 'CANCELLED'
          ? state.products.map((product) => ({
              ...product,
              stock:
                product.stock +
                (previous.items.find((item) => item.product.id === product.id)?.quantity ?? 0),
            }))
          : state.products;
      return {
        ...state,
        products,
        orders: state.orders.map((order) =>
          order.reference === action.reference
            ? {
                ...order,
                status: action.status,
                paymentStatus,
                note: action.note ?? order.note,
                trackingNumber: action.trackingNumber ?? order.trackingNumber,
              }
            : order,
        ),
      };
    }
  }
}
