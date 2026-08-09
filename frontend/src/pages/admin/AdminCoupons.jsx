import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { Plus, Pencil, Trash2, Ticket, Copy } from 'lucide-react';
import { inr } from '../../lib/utils';

const empty = { code: '', discount_type: 'flat', value: 0, min_order: 0, max_discount: 0, active: true, expires_at: '' };

const AdminCoupons = () => {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(empty);

  const load = () => api.get('/admin/coupons').then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setF(empty); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setF({
      code: c.code, discount_type: c.discount_type, value: c.value,
      min_order: c.min_order || 0, max_discount: c.max_discount || 0,
      active: c.active !== false,
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '',
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = {
        ...f,
        code: f.code.trim().toUpperCase(),
        value: +f.value, min_order: +f.min_order, max_discount: +f.max_discount,
        expires_at: f.expires_at ? new Date(f.expires_at + 'T23:59:59Z').toISOString() : null,
      };
      if (editing) await api.patch(`/admin/coupons/${editing.id}`, payload);
      else await api.post('/admin/coupons', payload);
      toast({ title: editing ? 'Coupon updated' : 'Coupon created' });
      setOpen(false); load();
    } catch (e) {
      toast({ title: 'Save failed', description: e.response?.data?.detail || 'Try again', variant: 'destructive' });
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    await api.delete(`/admin/coupons/${id}`);
    toast({ title: 'Deleted' }); load();
  };

  const copy = (code) => { navigator.clipboard.writeText(code); toast({ title: `${code} copied` }); };

  const formatDiscount = (c) =>
    c.discount_type === 'percent'
      ? `${c.value}%${c.max_discount ? ` (max ${inr(c.max_discount)})` : ''}`
      : inr(c.value);

  const isExpired = (c) => c.expires_at && new Date(c.expires_at) < new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-xs text-gray-500 mt-0.5">Create discount codes shoppers can apply at checkout.</p>
        </div>
        <Button onClick={openNew} className="bg-[#6b3410] hover:bg-[#4d260b] gap-2"><Plus className="w-4 h-4" /> New Coupon</Button>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Discount</th>
              <th className="px-4 py-2">Min order</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <button onClick={() => copy(c.code)} className="inline-flex items-center gap-2 font-mono font-bold text-[#6b3410] hover:underline">
                    <Ticket className="w-4 h-4" /> {c.code} <Copy className="w-3 h-3 opacity-50" />
                  </button>
                </td>
                <td className="px-4 py-2">{formatDiscount(c)}</td>
                <td className="px-4 py-2">{c.min_order ? inr(c.min_order) : '—'}</td>
                <td className="px-4 py-2 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-IN') : 'Never'}</td>
                <td className="px-4 py-2">
                  {isExpired(c) ? (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">Expired</span>
                  ) : c.active ? (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">Active</span>
                  ) : (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">Paused</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="6" className="text-center py-10 text-gray-500">No coupons yet. Create your first one!</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Coupon' : 'New Coupon'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code (uppercase, no spaces)</Label>
              <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                placeholder="WELCOME50" disabled={!!editing} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount type</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm" value={f.discount_type}
                  onChange={(e) => setF({ ...f, discount_type: e.target.value })}>
                  <option value="flat">Flat ₹</option>
                  <option value="percent">Percent %</option>
                </select>
              </div>
              <div>
                <Label>Value {f.discount_type === 'percent' ? '(%)' : '(₹)'}</Label>
                <Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Minimum order (₹)</Label>
                <Input type="number" value={f.min_order} onChange={(e) => setF({ ...f, min_order: e.target.value })} />
              </div>
              <div>
                <Label>Max discount (₹) {f.discount_type === 'flat' && <span className="text-[10px] text-gray-400">— unused</span>}</Label>
                <Input type="number" value={f.max_discount} onChange={(e) => setF({ ...f, max_discount: e.target.value })}
                  disabled={f.discount_type === 'flat'} placeholder="0 = no cap" />
              </div>
            </div>
            <div>
              <Label>Expiry date (leave empty for never)</Label>
              <Input type="date" value={f.expires_at || ''} onChange={(e) => setF({ ...f, expires_at: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-[#6b3410] hover:bg-[#4d260b]">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCoupons;
