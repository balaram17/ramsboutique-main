import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const CART_KEY = 'rb_cart';

const readCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (_) { return []; }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (_) { /* storage disabled */ }
  }, [items]);

  const add = useCallback((product, qty = 1) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.product.id === product.id);
      if (ex) return prev.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { product, qty }];
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.product.id !== id));
  }, []);

  const update = useCallback((id, qty) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.product.id !== id);
      return prev.map((i) => i.product.id === id ? { ...i, qty } : i);
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const { subtotal, totalMrp, count } = useMemo(() => {
    let s = 0, m = 0, c = 0;
    for (const i of items) {
      s += i.product.price * i.qty;
      m += i.product.mrp * i.qty;
      c += i.qty;
    }
    return { subtotal: s, totalMrp: m, count: c };
  }, [items]);
  const savings = totalMrp - subtotal;

  const value = useMemo(
    () => ({ items, add, remove, update, clear, subtotal, savings, count }),
    [items, add, remove, update, clear, subtotal, savings, count],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
