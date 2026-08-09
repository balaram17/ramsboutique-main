import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { CheckCircle2, Package, MapPin, CreditCard } from 'lucide-react';
import { inr } from '../lib/utils';

const OrderSuccess = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  useEffect(() => { api.get(`/orders/${id}`).then((r) => setOrder(r.data)); }, [id]);
  if (!order) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white rounded-lg border p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-[#6b3410]" />
        </div>
        <h1 className="text-2xl font-bold mt-4">Order Placed Successfully!</h1>
        <p className="text-gray-500 mt-1">Order #{order.order_no}</p>
        <div className="mt-6 grid md:grid-cols-3 gap-4 text-left">
          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-2 text-xs text-gray-500"><Package className="w-4 h-4" /> Items</div>
            <div className="font-semibold mt-1">{order.items.length}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-2 text-xs text-gray-500"><CreditCard className="w-4 h-4" /> Payment</div>
            <div className="font-semibold mt-1">{order.payment_method} • {inr(order.total)}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-2 text-xs text-gray-500"><MapPin className="w-4 h-4" /> Delivery</div>
            <div className="font-semibold mt-1">{order.distance_km} km • 60 mins</div>
          </div>
        </div>
        <div className="flex gap-3 justify-center mt-8">
          <Link to="/orders" className="bg-[#6b3410] hover:bg-[#4d260b] text-white px-5 py-2.5 rounded-md text-sm font-semibold">View Orders</Link>
          <Link to="/" className="border border-gray-300 hover:bg-gray-50 px-5 py-2.5 rounded-md text-sm font-semibold">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
