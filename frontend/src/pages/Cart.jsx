import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Tag, X, CheckCircle2 } from 'lucide-react';
import { inr } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import api from '../lib/api';
import { useToast } from '../hooks/use-toast';

const COUPON_KEY = 'rb_coupon';

const Cart = () => {
  const { items, update, remove, subtotal, savings } = useCart();
  const nav = useNavigate();
  const { toast } = useToast();
  const [couponInput, setCouponInput] = useState('');
  const [applied, setApplied] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COUPON_KEY) || 'null'); } catch { return null; }
  });
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (applied) localStorage.setItem(COUPON_KEY, JSON.stringify(applied));
    else localStorage.removeItem(COUPON_KEY);
  }, [applied]);

  React.useEffect(() => {
    if (!applied) return;
    api.post('/coupons/validate', { code: applied.code, subtotal })
      .then((r) => setApplied({ code: r.data.code, discount: r.data.discount }))
      .catch(() => setApplied(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/coupons/validate', { code: couponInput.trim(), subtotal });
      setApplied({ code: data.code, discount: data.discount });
      setCouponInput('');
      toast({ title: 'Coupon applied', description: `You saved ${inr(data.discount)}` });
    } catch (e) {
      toast({ title: 'Invalid coupon', description: e.response?.data?.detail || 'Try another', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const removeCoupon = () => { setApplied(null); toast({ title: 'Coupon removed' }); };

  const discount = applied?.discount || 0;
  const delivery = subtotal >= 499 || subtotal === 0 ? 0 : 40;
  const total = Math.max(0, subtotal + delivery - discount);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300" />
        <h2 className="text-2xl font-bold mt-4">Your cart is empty</h2>
        <p className="text-gray-500 mt-2">Add fresh groceries and daily essentials to get started.</p>
        <Link to="/" className="inline-block mt-6 bg-[#6b3410] hover:bg-[#4d260b] text-white px-6 py-3 rounded-md font-semibold transition">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="font-bold text-lg">Your Cart ({items.length} items)</h1>
        </div>
        <ul className="divide-y divide-gray-100">
          {items.map(({ product, qty }) => (
            <li key={product.id} className="p-4 flex gap-4">
              <img src={product.image} alt={product.name} className="w-20 h-20 object-cover rounded-md bg-gray-100" />
              <div className="flex-1">
                <Link to={`/p/${product.id}`} className="font-medium text-gray-900 hover:text-[#6b3410] line-clamp-2">{product.name}</Link>
                <div className="text-xs text-gray-500 mt-0.5">{product.brand} • {product.unit}</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-bold">{inr(product.price)}</span>
                  {product.mrp > product.price && <span className="text-xs text-gray-400 line-through">{inr(product.mrp)}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button onClick={() => remove(product.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                <div className="flex items-center border-2 border-[#6b3410] rounded-md">
                  <button onClick={() => update(product.id, qty - 1)} className="px-2 py-1"><Minus className="w-3 h-3" /></button>
                  <span className="font-semibold px-3 text-sm">{qty}</span>
                  <button onClick={() => update(product.id, qty + 1)} className="px-2 py-1"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="bg-white rounded-lg border border-gray-200 p-5 h-fit sticky top-24">
        <h2 className="font-bold mb-4">Bill Summary</h2>

        <div className="mb-4 pb-4 border-b">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2"><Tag className="w-4 h-4 text-[#6b3410]" /> Coupon</div>
          {applied ? (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-amber-800" />
                <span className="font-mono font-semibold text-amber-900">{applied.code}</span>
                <span className="text-xs text-amber-800">−{inr(discount)}</span>
              </div>
              <button onClick={removeCoupon} className="text-gray-500 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Enter code" className="uppercase" />
              <Button type="button" onClick={applyCoupon} disabled={busy} className="bg-[#6b3410] hover:bg-[#4d260b] shrink-0">Apply</Button>
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
          <div className="flex justify-between text-amber-800"><span>Product savings</span><span>-{inr(savings)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-amber-800"><span>Coupon ({applied.code})</span><span>-{inr(discount)}</span></div>
          )}
          <div className="flex justify-between"><span>Delivery fee</span><span>{delivery === 0 ? <span className="text-amber-800 font-semibold">FREE</span> : inr(delivery)}</span></div>
          {delivery > 0 && <div className="text-xs text-orange-600">Add {inr(499 - subtotal)} more for free delivery</div>}
          <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base"><span>Total</span><span>{inr(total)}</span></div>
        </div>
        <Button onClick={() => nav('/checkout')} className="w-full mt-4 bg-[#6b3410] hover:bg-[#4d260b] gap-2">Proceed to Checkout <ArrowRight className="w-4 h-4" /></Button>
      </aside>
    </div>
  );
};

export default Cart;
