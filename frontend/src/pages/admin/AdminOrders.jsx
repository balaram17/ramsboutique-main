import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { inr } from '../../lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { MapPin, Package, Eye } from 'lucide-react';

const STATUSES = ['placed', 'assigned', 'accepted', 'packed', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'];
const ADMIN_STATUSES = ['placed', 'packed', 'cancelled'];

const AdminOrders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState(null);

  const load = useCallback(() => {
    const url = '/admin/orders' + (filter !== 'all' ? `?status=${filter}` : '');
    api.get(url).then((r) => setOrders(r.data));
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/admin/agents').then((r) => setAgents(r.data)); }, []);

  const update = useCallback(async (id, patch) => {
    try {
      const { data } = await api.patch(`/admin/orders/${id}`, patch);
      setOrders((prev) => prev.map((o) => o.id === id ? data : o));
      setView((v) => (v?.id === id ? data : v));
      toast({ title: 'Order updated' });
    } catch (err) {
      toast({ title: 'Update failed', description: err.response?.data?.detail, variant: 'destructive' });
    }
  }, [toast]);

  const agentsById = useMemo(() => {
    const map = new Map();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);
  const activeAgents = useMemo(() => agents.filter((a) => a.active), [agents]);
  const agentName = useCallback((id) => agentsById.get(id)?.name || '-', [agentsById]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Order</th><th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Total</th><th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2">Status</th><th className="px-4 py-2">Agent</th><th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{o.order_no}</div>
                  <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString('en-IN')}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{o.address.full_name}</div>
                  <div className="text-xs text-gray-500">{o.address.phone}</div>
                </td>
                <td className="px-4 py-3 font-semibold">{inr(o.total)}</td>
                <td className="px-4 py-3">
                  <div>{o.payment_method}</div>
                  <div className={`text-[10px] uppercase font-bold ${o.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>{o.payment_status}</div>
                </td>
                <td className="px-4 py-3">
                  {ADMIN_STATUSES.includes(o.status) ? (
                    <Select value={o.status} onValueChange={(v) => update(o.id, { status: v })}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ADMIN_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replaceAll('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold capitalize text-blue-700">
                      {o.status?.replaceAll('_', ' ')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Select disabled={o.status === 'delivered' || o.status === 'cancelled'} value={o.agent_id || 'none'} onValueChange={(v) => update(o.id, { agent_id: v === 'none' ? null : v })}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Assign" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Unassigned</SelectItem>
                      {activeAgents.map((a) => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" onClick={() => setView(o)}><Eye className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-gray-500">No orders</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle>Order {view.order_no}</DialogTitle></DialogHeader>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery</div>
                  <div className="mt-1">{view.address.full_name}<br />{view.address.phone}<br />{view.address.line1}, {view.address.line2}<br />{view.address.city} - {view.address.pincode}</div>
                  <div className="text-xs text-gray-500 mt-2">Distance: {view.distance_km} km • Agent: {agentName(view.agent_id)}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Payment & Bill</div>
                  <div className="mt-1">Method: {view.payment_method}<br />Status: <span className="font-semibold">{view.payment_status}</span></div>
                  <div className="mt-2 text-xs">Subtotal: {inr(view.subtotal)} • Delivery: {inr(view.delivery_fee)}</div>
                  {view.discount > 0 && <div className="text-xs text-amber-800">Coupon {view.coupon_code}: -{inr(view.discount)}</div>}
                  <div className="font-bold text-base mt-1">Total: {inr(view.total)}</div>
                </div>
              </div>
              {view.note && (
                <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="font-semibold text-sm text-yellow-900">Delivery instructions from customer</div>
                  <div className="text-sm text-yellow-800 mt-1 whitespace-pre-wrap">{view.note}</div>
                </div>
              )}
              <div className="mt-3">
                <div className="font-semibold text-sm mb-2">Items</div>
                <ul className="divide-y">
                  {view.items.map((it) => (
                    <li key={`${it.product_id}-${it.qty}`} className="py-2 flex gap-3 text-sm items-center">
                      <img src={it.image} alt="" className="w-10 h-10 rounded object-cover" />
                      <div className="flex-1"><div>{it.name}</div><div className="text-xs text-gray-500">{it.unit} × {it.qty}</div></div>
                      <div className="font-semibold">{inr(it.total)}</div>
                    </li>
                  ))}
                </ul>
              </div>
              {view.delivery_audit?.length > 0 && (
                <div className="mt-4">
                  <div className="font-semibold text-sm mb-2">Delivery audit</div>
                  <div className="space-y-2 rounded border p-3 text-xs">
                    {[...view.delivery_audit].reverse().map((entry, index) => (
                      <div key={`${entry.at}-${index}`} className="flex justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                        <span className="capitalize">{entry.event?.replaceAll('_', ' ')} · {entry.actor_role}</span>
                        <span className="text-gray-500">{new Date(entry.at).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
