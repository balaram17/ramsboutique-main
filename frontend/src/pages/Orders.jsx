import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpay';
import { Package, RefreshCcw, Loader2, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { inr } from '../lib/utils';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';

const STATUS_STYLE = {
  placed: 'bg-blue-100 text-blue-800',
  packed: 'bg-yellow-100 text-yellow-800',
  out_for_delivery: 'bg-purple-100 text-purple-800',
  delivered: 'bg-amber-100 text-amber-900',
  cancelled: 'bg-red-100 text-red-800',
};

const PAY_STATUS_STYLE = {
  paid: { cls: 'text-green-700', Icon: CheckCircle2, label: 'Paid' },
  pending: { cls: 'text-orange-700', Icon: Clock, label: 'Pending' },
  cancelled: { cls: 'text-red-700', Icon: XCircle, label: 'Cancelled' },
  failed: { cls: 'text-red-700', Icon: XCircle, label: 'Failed' },
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const load = () => api.get('/orders/my').then((r) => setOrders(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const retry = async (o) => {
    setPayingId(o.id);
    try {
      await openRazorpayCheckout({
        orderId: o.id,
        name: o.address?.full_name || user?.name,
        phone: o.address?.phone || user?.phone,
        email: user?.email,
      });
      toast({ title: 'Payment successful' });
      load();
    } catch (e) {
      toast({ title: 'Payment not completed', description: e.message || 'Try again shortly', variant: 'destructive' });
    } finally { setPayingId(null); }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>
      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <Package className="w-12 h-12 mx-auto text-gray-300" />
          <p className="mt-3 text-gray-500">No orders yet. Start shopping!</p>
          <Link to="/" className="inline-block mt-4 bg-[#6b3410] hover:bg-[#4d260b] text-white px-5 py-2 rounded-md text-sm font-semibold">Shop Now</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const ps = PAY_STATUS_STYLE[o.payment_status] || PAY_STATUS_STYLE.pending;
            const canRetry = (o.payment_method === 'UPI' || o.payment_method === 'CARD') && ['pending', 'cancelled', 'failed'].includes(o.payment_status) && o.status !== 'cancelled';
            const isPaid = o.payment_status === 'paid';

            return (
              <div key={o.id} className="bg-white border rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Order #{o.order_no}</div>
                    <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString('en-IN')}</div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${STATUS_STYLE[o.status] || 'bg-gray-100'}`}>{o.status.replace('_', ' ')}</span>
                </div>
                
                <div className="mt-3 flex flex-wrap gap-3 items-center">
                  <div className="flex -space-x-2">
                    {o.items.slice(0, 4).map((it) => (
                      // 👇 UPDATED: Appended unit parameters onto your tracking key index to prevent duplicate key warning loops
                      <img 
                        key={`${o.id}-${it.product_id}-${it.unit || 'base'}`} 
                        src={it.image} 
                        alt="" 
                        className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 object-cover" 
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-600">{o.items.length} items • {o.payment_method}</div>
                  <div className={`text-xs font-semibold flex items-center gap-1 ${ps.cls}`}><ps.Icon className="w-3.5 h-3.5" /> {ps.label}</div>
                  <div className="ml-auto font-bold">{inr(o.total)}</div>
                </div>

                {(canRetry || isPaid) && (
                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end items-center gap-2">
                    
                    {isPaid && (
                      <Link
                        to={`/orders/${o.id}/invoice`}
                        className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md px-3 py-1.5 transition-all shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                        View Invoice
                      </Link>
                    )}

                    {canRetry && (
                      <Button size="sm" onClick={() => retry(o)} disabled={payingId === o.id} className="bg-[#f7941d] hover:bg-[#e58500] gap-2">
                        {payingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                        Pay Now
                      </Button>
                    )}

                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Orders;
