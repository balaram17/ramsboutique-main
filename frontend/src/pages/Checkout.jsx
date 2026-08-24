import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLocationCtx } from '../context/LocationContext';
import { useStoreStatus } from '../hooks/use-store-status';
import api from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpay';
import { inr } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { MapPin, CreditCard, Banknote, Smartphone, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const Checkout = () => {
  const nav = useNavigate();
  const { toast } = useToast();
  const { items, subtotal, savings, clear } = useCart();
  const { user } = useAuth();
  const { location } = useLocationCtx();
  const store = useStoreStatus();
  const [deliveryCharge, setDeliveryCharge] = useState(40);
  const delivery = subtotal >= 499 ? 0 : deliveryCharge;
  const total = subtotal + delivery;
  const [payment, setPayment] = useState('COD');
  const [placing, setPlacing] = useState(false);
  const [note, setNote] = useState('');
  const [addr, setAddr] = useState({
    full_name: user?.name || '', phone: user?.phone || '',
    line1: '', line2: '', pincode: '530016',
  });

  const appliedCoupon = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('rb_coupon') || 'null'); } catch { return null; }
  }, []);
  const discount = appliedCoupon?.discount || 0;

  React.useEffect(() => {
    if (!user) { nav('/login?next=/checkout'); return; }
    if (items.length === 0) nav('/cart');
  }, [user, items.length, nav]);

  React.useEffect(() => {
    api.get('/chits/settings').then(({ data }) => {
      if (Number.isFinite(Number(data.delivery_charge_rupees))) setDeliveryCharge(Number(data.delivery_charge_rupees));
    }).catch(() => {});
  }, []);

  const setF = (k, v) => setAddr((p) => ({ ...p, [k]: v }));

  const place = async () => {
    if (!location?.deliverable) return toast({ title: 'Set a valid delivery location first', variant: 'destructive' });
    if (!addr.full_name || !addr.phone || !addr.line1 || !addr.pincode) return toast({ title: 'Please fill address', variant: 'destructive' });
    setPlacing(true);
    try {
      const payload = {
        // 👇 UPDATED: Extracts the true base product UUID and appends the specific variant unit string
        items: items.map((i) => ({ 
          product_id: i.product.baseProductId || i.product.id, 
          qty: i.qty,
          unit: i.product.unit,
          price: Number(i.product.price) || 0,
          mrp: Number(i.product.mrp) || 0
        })),
        address: { ...addr, city: 'Visakhapatnam', lat: location.lat, lng: location.lng },
        payment_method: payment,
        note,
        coupon_code: appliedCoupon?.code || null,
      };
      const { data } = await api.post('/orders', payload);
      
      if (payment === 'UPI' || payment === 'CARD') {
        try {
          await openRazorpayCheckout({
            orderId: data.id,
            name: addr.full_name,
            phone: addr.phone,
            email: user?.email,
          });
        } catch (payErr) {
          const msg = payErr?.message || 'Payment failed';
          toast({ title: 'Payment not completed', description: `${msg}. Your order is saved as pending — you can retry from "My Orders".`, variant: 'destructive' });
          clear();
          try { localStorage.removeItem('rb_coupon'); } catch (_) {}
          nav('/orders');
          return;
        }
      }
      clear();
      try { localStorage.removeItem('rb_coupon'); } catch (_) {}
      nav(`/order-success/${data.id}`);
    } catch (e) {
      toast({ title: 'Order failed', description: e.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setPlacing(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <section className="bg-white rounded-lg border p-5">
          <h2 className="font-bold text-lg mb-1 flex items-center gap-2"><MapPin className="w-5 h-5 text-[#6b3410]" /> Delivery Address</h2>
          <div className="text-xs text-gray-500 mb-4">Delivering to Visakhapatnam • {location?.distance_km} km from store</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Full Name</Label><Input value={addr.full_name} onChange={(e) => setF('full_name', e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={addr.phone} onChange={(e) => setF('phone', e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Address Line 1</Label><Input value={addr.line1} onChange={(e) => setF('line1', e.target.value)} placeholder="House no, Street" /></div>
            <div className="md:col-span-2"><Label>Landmark (optional)</Label><Input value={addr.line2} onChange={(e) => setF('line2', e.target.value)} /></div>
            <div><Label>City</Label><Input value="Visakhapatnam" disabled /></div>
            <div><Label>Pincode</Label><Input value={addr.pincode} onChange={(e) => setF('pincode', e.target.value)} /></div>
            <div className="md:col-span-2">
              <Label>Delivery instructions (optional)</Label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
                placeholder="e.g. Ring the bell twice, leave at door, call before arriving..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b3410]/30" />
              <div className="text-[10px] text-gray-400 text-right mt-0.5">{note.length}/500</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border p-5">
          <h2 className="font-bold text-lg mb-3">Payment Method</h2>
          <RadioGroup value={payment} onValueChange={setPayment}>
            {[
              { v: 'COD', l: 'Cash on Delivery', s: 'Pay when your order arrives', Icon: Banknote },
              { v: 'UPI', l: 'UPI', s: 'PhonePe, GPay, Paytm etc.', Icon: Smartphone },
              { v: 'CARD', l: 'Credit / Debit Card', s: 'Visa, Mastercard, RuPay', Icon: CreditCard },
            ].map((m) => (
              <label key={m.v} className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition ${payment === m.v ? 'border-[#6b3410] bg-amber-50' : 'border-gray-200'}`}>
                <RadioGroupItem value={m.v} />
                <m.Icon className="w-5 h-5 text-[#6b3410]" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{m.l}</div>
                  <div className="text-xs text-gray-500">{m.s}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
          {payment !== 'COD' && (
            <div className="mt-3 text-xs bg-amber-50 text-amber-900 p-2 rounded border border-amber-200">
              🔒 Secure payment via Razorpay. You'll be redirected to complete your UPI / Card / Netbanking payment.
            </div>
          )}
        </section>
      </div>

      <aside className="bg-white rounded-lg border p-5 h-fit sticky top-24">
        <h2 className="font-bold mb-3">Order Summary</h2>
        <ul className="space-y-2 text-sm mb-3 max-h-52 overflow-y-auto">
          {items.map(({ product, qty }) => (
            // 👇 UPDATED: Display variant units next to name strings for clearer scannability
            <li key={product.id} className="flex justify-between border-b border-dashed pb-1.5 last:border-0">
              <span className="line-clamp-1 pr-2 flex flex-col">
                <span className="font-medium text-gray-800">{product.name}</span>
                <span className="text-[11px] text-gray-400">Option: {product.unit} × {qty}</span>
              </span>
              <span className="font-mono text-gray-700">{inr(product.price * qty)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t pt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
          <div className="flex justify-between text-amber-800"><span>Savings</span><span>-{inr(savings)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-amber-800"><span>Coupon ({appliedCoupon.code})</span><span>-{inr(discount)}</span></div>
          )}
          <div className="flex justify-between"><span>Delivery</span><span>{delivery === 0 ? 'FREE' : inr(delivery)}</span></div>
          <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{inr(Math.max(0, subtotal + delivery - discount))}</span></div>
        </div>
        <Button onClick={place} disabled={placing || !store.open} className="w-full mt-4 bg-[#f7941d] hover:bg-[#e58500] gap-2">
          {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {store.open ? 'Place Order' : 'Store Closed'}
        </Button>
        {!store.open && (
          <div className="mt-2 text-xs text-red-600 text-center">{store.message}</div>
        )}
      </aside>
    </div>
  );
};

export default Checkout;
