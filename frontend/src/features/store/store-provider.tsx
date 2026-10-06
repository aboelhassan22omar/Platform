'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_RATES,
  cartTotals,
  demoOrders,
  type CartItem,
  type DeliveryDetails,
  type StoreMethod,
  type StoreOrder,
  type StoreProduct,
  type StoreRate,
  type StoreStatus,
} from './store-data';

interface StoreContext {
  ready: boolean;
  products: StoreProduct[];
  cart: CartItem[];
  rates: StoreRate[];
  orders: StoreOrder[];
  cartCount: number;
  addToCart: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  saveProduct: (product: StoreProduct) => void;
  updateRates: (region: string, priceMinor: number) => void;
  placeOrder: (delivery: DeliveryDetails, method: StoreMethod) => StoreOrder;
  submitPayment: (reference: string, transferReference: string) => void;
  updateOrder: (
    reference: string,
    status: StoreStatus,
    paymentStatus?: StoreOrder['paymentStatus'],
    note?: string,
    trackingNumber?: string,
  ) => void;
}
const Context = createContext<StoreContext | null>(null);
const STORAGE = 'amr-store-demo-v1';
const ORDER_STORAGE = 'amr-store-demo-orders-v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<StoreProduct[]>(INITIAL_PRODUCTS);
  const [rates, setRates] = useState<StoreRate[]>(INITIAL_RATES);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          Array.isArray(saved.products) &&
          Array.isArray(saved.rates) &&
          Array.isArray(saved.cart)
        ) {
          setProducts(saved.products);
          setRates(saved.rates);
          setCart(saved.cart);
        }
      }
      const savedOrders = sessionStorage.getItem(ORDER_STORAGE);
      setOrders(savedOrders ? JSON.parse(savedOrders) : demoOrders());
    } catch {
      /* A disabled or full browser store must not break the preview. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ products, rates, cart }));
    } catch {
      /* In-memory preview remains usable. */
    }
  }, [ready, products, rates, cart]);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(ORDER_STORAGE, JSON.stringify(orders));
      } catch {
        /* Keep the active preview. */
      }
  }, [ready, orders]);

  const value = useMemo<StoreContext>(
    () => ({
      ready,
      products,
      rates,
      cart,
      orders,
      cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      addToCart(id) {
        const product = products.find(
          (product) => product.id === id && product.active,
        );
        if (!product || product.stock <= 0) return;
        setCart((current) => {
          const existing = current.find((item) => item.productId === id);
          return existing
            ? current.map((item) =>
                item.productId === id
                  ? {
                      ...item,
                      quantity: Math.min(item.quantity + 1, product.stock, 10),
                    }
                  : item,
              )
            : [...current, { productId: id, quantity: 1 }];
        });
      },
      setQuantity(id, quantity) {
        const stock = products.find((product) => product.id === id)?.stock ?? 0;
        setCart((current) =>
          current.map((item) =>
            item.productId === id
              ? {
                  ...item,
                  quantity: Math.max(1, Math.min(10, quantity, stock)),
                }
              : item,
          ),
        );
      },
      removeFromCart(id) {
        setCart((current) => current.filter((item) => item.productId !== id));
      },
      saveProduct(product) {
        setProducts((current) =>
          current.some((item) => item.id === product.id)
            ? current.map((item) => (item.id === product.id ? product : item))
            : [...current, product],
        );
      },
      updateRates(region, priceMinor) {
        setRates((current) =>
          current.map((rate) =>
            rate.region === region ? { ...rate, priceMinor } : rate,
          ),
        );
      },
      placeOrder(delivery, method) {
        const items = cart.map((item) => ({
          product: products.find((product) => product.id === item.productId)!,
          quantity: item.quantity,
        }));
        if (
          !items.length ||
          items.some(
            (item) =>
              !item.product?.active || item.product.stock < item.quantity,
          )
        )
          throw new Error('في منتج غير متاح بالكمية المطلوبة. راجع العربة.');
        const rate = rates.find((rate) => rate.code === delivery.governorate);
        if (!rate) throw new Error('اختار المحافظة عشان نحسب الشحن.');
        const totals = cartTotals(items, rate.priceMinor);
        if (method === 'COD' && !totals.codAllowed)
          throw new Error('بعض المنتجات متاحة بالدفع الإلكتروني فقط.');
        const order: StoreOrder = {
          reference: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          createdAt: new Date().toISOString(),
          delivery: { ...delivery },
          items: items.map((item) => ({
            ...item,
            product: { ...item.product },
          })),
          subtotalMinor: totals.subtotalMinor,
          shippingMinor: totals.shippingMinor,
          totalMinor: totals.totalMinor,
          method,
          status: method === 'COD' ? 'CONFIRMED' : 'AWAITING_PAYMENT',
          paymentStatus: 'UNPAID',
        };
        setOrders((current) => [order, ...current]);
        setProducts((current) =>
          current.map((product) => ({
            ...product,
            stock:
              product.stock -
              (items.find((item) => item.product.id === product.id)?.quantity ??
                0),
          })),
        );
        setCart([]);
        return order;
      },
      submitPayment(reference, transferReference) {
        setOrders((current) =>
          current.map((order) =>
            order.reference === reference &&
            order.method !== 'COD' &&
            order.status === 'AWAITING_PAYMENT' &&
            order.paymentStatus !== 'PAID'
              ? {
                  ...order,
                  transferReference,
                  paymentStatus: 'SUBMITTED',
                  note: undefined,
                }
              : order,
          ),
        );
      },
      updateOrder(reference, status, paymentStatus, note, trackingNumber) {
        const previous = orders.find((order) => order.reference === reference);
        if (
          !previous ||
          previous.status === 'CANCELLED' ||
          previous.status === 'DELIVERED'
        )
          return;
        if (status === 'CANCELLED') {
          setProducts((current) =>
            current.map((product) => ({
              ...product,
              stock:
                product.stock +
                (previous.items.find((item) => item.product.id === product.id)
                  ?.quantity ?? 0),
            })),
          );
        }
        setOrders((current) =>
          current.map((order) =>
            order.reference === reference
              ? {
                  ...order,
                  status,
                  paymentStatus: paymentStatus ?? order.paymentStatus,
                  note: note ?? order.note,
                  trackingNumber: trackingNumber ?? order.trackingNumber,
                }
              : order,
          ),
        );
      },
    }),
    [ready, products, rates, cart, orders],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStore() {
  const context = useContext(Context);
  if (!context) throw new Error('StoreProvider is required');
  return context;
}
