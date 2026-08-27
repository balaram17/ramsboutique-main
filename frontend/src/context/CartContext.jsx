import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const CART_KEY = 'rb_cart';

export const isKgUnit = (unit = '') => /^(?:1\s*)?kg$/i.test(String(unit).trim());
export const quantityStep = (product) => isKgUnit(product?.unit) ? 0.25 : 1;
export const formatQuantity = (qty, unit) => isKgUnit(unit)
  ? `${Number(qty).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} kg`
  : String(qty);

const readCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (_) { return []; }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (_) { /* storage disabled */ }
  }, [items]);

  // Updated to track split compound keys (e.g. "product123-500g")
  const add = useCallback((product, qty) => {
    const amount = qty ?? quantityStep(product);
    setItems((prev) => {
      const ex = prev.find((i) => i.product.id === product.id);
      if (ex) return prev.map((i) => i.product.id === product.id ? { ...i, qty: Number((i.qty + amount).toFixed(2)) } : i);
      return [...prev, { product, qty: amount }];
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.product.id !== id));
  }, []);

  const update = useCallback((id, qty) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.product.id !== id);
      return prev.map((i) => i.product.id === id ? { ...i, qty: Number(qty.toFixed(2)) } : i);
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const { subtotal, totalMrp, count } = useMemo(() => {
    let s = 0, m = 0, c = 0;
    for (const i of items) {
      s += (Number(i.product.price) || 0) * i.qty;
      m += (Number(i.product.mrp) || 0) * i.qty;
      c += i.qty;
    }
    return { subtotal: s, totalMrp: m, count: c };
  }, [items]);
  const savings = Math.max(0, totalMrp - subtotal);

  const value = useMemo(
    () => ({ items, add, remove, update, clear, subtotal, savings, count }),
    [items, add, remove, update, clear, subtotal, savings, count],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
