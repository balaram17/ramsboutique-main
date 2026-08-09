import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { ShoppingBag, Package, Users, IndianRupee, Truck, Clock, CheckCircle2 } from 'lucide-react';
import { inr } from '../../lib/utils';

const Card = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-lg p-5 border">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-5 h-5 text-white" /></div>
    <div className="text-2xl font-bold mt-3">{value}</div>
    <div className="text-xs text-gray-500 mt-1">{label}</div>
  </div>
);

const AdminDashboard = () => {
  const [s, setS] = useState(null);
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    api.get('/admin/stats').then((r) => setS(r.data));
    api.get('/admin/orders').then((r) => setRecent(r.data.slice(0, 8)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {!s ? <div>Loading...</div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card icon={IndianRupee} label="Total Revenue" value={inr(s.revenue)} color="bg-[#6b3410]" />
          <Card icon={ShoppingBag} label="Total Orders" value={s.total_orders} color="bg-[#f7941d]" />
          <Card icon={Clock} label="Pending Orders" value={s.pending_orders} color="bg-blue-500" />
          <Card icon={CheckCircle2} label="Delivered" value={s.delivered_orders} color="bg-emerald-500" />
          <Card icon={Package} label="Products" value={s.total_products} color="bg-purple-500" />
          <Card icon={Users} label="Users" value={s.total_users} color="bg-pink-500" />
          <Card icon={Truck} label="Agents" value={s.total_agents} color="bg-teal-500" />
        </div>
      )}

      <div className="mt-8 bg-white rounded-lg border">
        <div className="px-5 py-3 border-b font-semibold">Recent Orders</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr><th className="px-5 py-2">Order</th><th className="px-5 py-2">Items</th><th className="px-5 py-2">Total</th><th className="px-5 py-2">Payment</th><th className="px-5 py-2">Status</th></tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-5 py-3 font-medium">{o.order_no}</td>
                <td className="px-5 py-3">{o.items.length}</td>
                <td className="px-5 py-3">{inr(o.total)}</td>
                <td className="px-5 py-3">{o.payment_method}</td>
                <td className="px-5 py-3"><span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
