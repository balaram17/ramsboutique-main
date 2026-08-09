import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { inr } from '../../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const empty = { name: '', brand: '', category: 'grocery', sub: '', price: 0, mrp: 0, unit: '', image: '', desc: '', stock: 100 };

const AdminProducts = () => {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(empty);

  const load = useCallback(() => api.get('/products?limit=500').then((r) => setList(r.data)), []);
  useEffect(() => { load(); api.get('/categories').then((r) => setCats(r.data)); }, [load]);

  const openNew = () => { setEditing(null); setF(empty); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setF({ ...p }); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...f, price: +f.price, mrp: +f.mrp, stock: +f.stock };
      if (editing) await api.patch(`/admin/products/${editing.id}`, payload);
      else await api.post('/admin/products', payload);
      toast({ title: editing ? 'Product updated' : 'Product added' });
      setOpen(false); load();
    } catch (e) { toast({ title: 'Save failed', description: e.response?.data?.detail || '', variant: 'destructive' }); }
  };
  const del = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/admin/products/${id}`);
    toast({ title: 'Deleted' }); load();
  };

  const filtered = useMemo(
    () => list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [list, q],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={openNew} className="bg-[#6b3410] hover:bg-[#4d260b] gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
      </div>
      <Input placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 bg-white max-w-sm" />

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Price</th><th className="px-4 py-2">Stock</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <img src={p.image} alt="" className="w-10 h-10 object-cover rounded" />
                    <div><div className="font-medium">{p.name}</div><div className="text-xs text-gray-500">{p.brand} • {p.unit}</div></div>
                  </div>
                </td>
                <td className="px-4 py-2 capitalize">{p.category.replace('-', ' ')}</td>
                <td className="px-4 py-2">{inr(p.price)} <span className="text-xs text-gray-400 line-through ml-1">{inr(p.mrp)}</span></td>
                <td className="px-4 py-2">{p.stock}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Brand</Label><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></div>
            <div>
              <Label>Category</Label>
              <select className="w-full h-10 border rounded-md px-3 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div><Label>Sub-category</Label><Input value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} /></div>
            <div><Label>Unit</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="1 kg" /></div>
            <div><Label>Price (₹)</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div><Label>MRP (₹)</Label><Input type="number" value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} /></div>
            <div><Label>Stock</Label><Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Image URL</Label><Input value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Description</Label><Textarea value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={2} /></div>
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

export default AdminProducts;
