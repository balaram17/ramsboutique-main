import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { inr } from '../../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { Plus, Pencil, Trash2, Percent, TrendingUp, TrendingDown } from 'lucide-react';

const empty = { 
  name: '', 
  brand: '', 
  category: 'grocery', 
  sub: '', 
  price: 0, 
  mrp: 0, 
  unit: '', 
  image: '', 
  desc: '', 
  stock: 100,
  variants: [] 
};

const emptyVariant = { unit: '', price: '', mrp: '', stock: '' };

const AdminProducts = () => {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(empty);
  const [newVar, setNewVar] = useState(emptyVariant);

  const [percentage, setPercentage] = useState('');
  const [globalBusy, setGlobalBusy] = useState(false);

  const load = useCallback(() => api.get('/products?limit=500').then((r) => setList(r.data)), []);
  useEffect(() => { load(); api.get('/categories').then((r) => setCats(r.data)); }, [load]);

  const openNew = () => { setEditing(null); setF(empty); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setF({ ...empty, ...p, variants: p.variants || [] }); setOpen(true); };

  const handleVariantChange = (index, field, value) => {
    setF(prev => {
      const updatedVariants = [...prev.variants];
      updatedVariants[index] = { ...updatedVariants[index], [field]: value };
      return { ...prev, variants: updatedVariants };
    });
  };

  const save = async () => {
    try {
      const payload = { 
        ...f, 
        price: Number(f.price) || 0, 
        mrp: Number(f.mrp) || 0, 
        stock: Number(f.stock) || 0,
        variants: f.variants.map(v => ({
          unit: String(v.unit).trim(),
          price: Number(v.price) || 0,
          mrp: Number(v.mrp) || 0,
          stock: Number(v.stock) || 0
        }))
      };
      
      if (editing) await api.patch(`/admin/products/${editing.id}`, payload);
      else await api.post('/admin/products', payload);
      
      toast({ title: editing ? 'Product updated' : 'Product added' });
      setOpen(false); 
      load();
    } catch (e) { 
      toast({ title: 'Save failed', description: e.response?.data?.detail || '', variant: 'destructive' }); 
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/admin/products/${id}`);
    toast({ title: 'Deleted' }); 
    load();
  };

  const addVariant = () => {
    if (!newVar.unit || !newVar.price) {
      toast({ title: 'Error', description: 'Unit and Price are required for a variant.', variant: 'destructive' });
      return;
    }
    setF(prev => ({ ...prev, variants: [...prev.variants, newVar] }));
    setNewVar(emptyVariant);
  };

  const removeVariant = (index) => {
    setF(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const handleGlobalPriceAdjust = async (direction) => {
    const rate = parseFloat(percentage);
    if (isNaN(rate) || rate <= 0) {
      toast({ title: 'Invalid Value', description: 'Please enter a valid positive percentage change.', variant: 'destructive' });
      return;
    }

    const confirmMsg = `Are you sure you want to ${direction === 'up' ? 'INCREASE' : 'DECREASE'} all product prices across your entire catalog by ${rate}%? This updates base prices and all variant options.`;
    if (!confirm(confirmMsg)) return;

    setGlobalBusy(true);
    try {
      for (const prod of list) {
        const factor = direction === 'up' ? (1 + rate / 100) : (1 - rate / 100);
        
        const payload = {
          ...prod,
          price: Math.round(prod.price * factor),
          mrp: Math.round(prod.mrp * factor),
          variants: (prod.variants || []).map(v => ({
            ...v,
            price: Math.round(v.price * factor),
            mrp: Math.round(v.mrp * factor)
          }))
        };

        await api.patch(`/admin/products/${prod.id}`, payload);
      }

      toast({ title: 'Success', description: `All product and variant prices modified successfully by ${rate}%.` });
      setPercentage('');
      load();
    } catch (e) {
      toast({ title: 'Global Adjustment Failed', description: 'Something went wrong during bulk edits.', variant: 'destructive' });
    } finally {
      setGlobalBusy(false);
    }
  };

  const filteredList = useMemo(() => {
    return list.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.brand.toLowerCase().includes(q.toLowerCase()));
  }, [list, q]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Manage Products</h1>
        <Button onClick={openNew} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="bg-slate-50 border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-semibold text-sm flex items-center gap-2 text-slate-800">
            <Percent className="w-4 h-4 text-[#6b3410]" /> Bulk Price Adjustment
          </div>
          <p className="text-xs text-slate-500">Increase or decrease every product base price and sub-variant globally by a set percentage matrix.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="number" 
            placeholder="e.g. 5" 
            value={percentage} 
            onChange={(e) => setPercentage(e.target.value)}
            className="w-28 h-9 bg-white"
            disabled={globalBusy}
          />
          <span className="text-sm font-bold text-slate-500">%</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleGlobalPriceAdjust('up')}
            disabled={globalBusy} 
            className="h-9 gap-1 border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-50"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Hike
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleGlobalPriceAdjust('down')}
            disabled={globalBusy} 
            className="h-9 gap-1 border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50"
          >
            <TrendingDown className="w-3.5 h-3.5" /> Slash
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Input 
          placeholder="Search products..." 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          className="max-w-md shadow-sm bg-white"
        />
      </div>

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b text-slate-600 font-medium text-sm">
              <th className="p-4">Product Info</th>
              <th className="p-4">Category</th>
              <th className="p-4">Base Pricing</th>
              <th className="p-4">Variants</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {filteredList.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4">
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.brand || 'No Brand'}</div>
                </td>
                <td className="p-4 capitalize">{p.category} <span className="text-xs text-slate-400">({p.sub})</span></td>
                <td className="p-4 font-mono">
                  {inr(p.price)} <span className="text-xs text-slate-400 line-through">{inr(p.mrp)}</span>
                  <div className="text-xs text-slate-500">Stock: {p.stock}</div>
                </td>
                <td className="p-4">
                  {p.variants && p.variants.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {p.variants.map((v, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {v.unit}: {inr(v.price)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">None</span>
                  )}
                </td>
                <td className="p-4 text-right space-x-2 whitespace-nowrap">
                  <Button variant="outline" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4 text-slate-600" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => del(p.id)} className="border-red-200 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select 
                value={f.category} 
                onChange={(e) => setF({ ...f, category: e.target.value })}
                className="w-full h-10 px-3 border rounded-md bg-white text-sm focus:outline-none"
              >
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sub-category</Label>
              <Input value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Base Unit (e.g. 1 Unit, Packet)</Label>
              <Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Base Price (₹)</Label>
              <Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Base MRP (₹)</Label>
              <Input type="number" value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Base Stock</Label>
              <Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Description</Label>
              <Textarea value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
            </div>

            <div className="col-span-2 border-t pt-4 mt-2 space-y-4">
              <h3 className="font-semibold text-sm text-slate-900">Product Options / Variants (Editable Mode Grid)</h3>
              
              {f.variants.length > 0 && (
                <div className="border rounded-md overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b font-medium text-slate-700">
                        <th className="p-2.5">Unit Size</th>
                        <th className="p-2.5">Price (₹)</th>
                        <th className="p-2.5">MRP (₹)</th>
                        <th className="p-2.5">Stock</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {f.variants.map((v, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2">
                            <Input 
                              className="h-8 text-xs bg-white" 
                              value={v.unit} 
                              onChange={(e) => handleVariantChange(idx, 'unit', e.target.value)} 
                            />
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" 
                              className="h-8 text-xs bg-white w-24" 
                              value={v.price} 
                              onChange={(e) => handleVariantChange(idx, 'price', e.target.value)} 
                            />
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" 
                              className="h-8 text-xs bg-white w-24" 
                              value={v.mrp} 
                              onChange={(e) => handleVariantChange(idx, 'mrp', e.target.value)} 
                            />
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" 
                              className="h-8 text-xs bg-white w-20" 
                              value={v.stock} 
                              onChange={(e) => handleVariantChange(idx, 'stock', e.target.value)} 
                            />
                          </td>
                          <td className="p-2 text-center">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-red-500 hover:text-red-700" 
                              onClick={() => removeVariant(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2 items-end bg-slate-50 p-3 border border-dashed rounded-md">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Unit (e.g. 500g)</Label>
                  <Input className="h-8 text-xs bg-white" value={newVar.unit} onChange={(e) => setNewVar({ ...newVar, unit: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Price (₹)</Label>
                  <Input type="number" className="h-8 text-xs bg-white" value={newVar.price} onChange={(e) => setNewVar({ ...newVar, price: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">MRP (₹)</Label>
                  <Input type="number" className="h-8 text-xs bg-white" value={newVar.mrp} onChange={(e) => setNewVar({ ...newVar, mrp: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Stock</Label>
                  <Input type="number" className="h-8 text-xs bg-white" value={newVar.stock} onChange={(e) => setNewVar({ ...newVar, stock: e.target.value })} />
                </div>
                <Button type="button" variant="secondary" size="sm" className="col-span-4 mt-1 h-8 w-full gap-1 text-xs" onClick={addVariant}>
                  <Plus className="h-3 w-3" /> Insert Option Row Into Grid
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-[#6b3410] hover:bg-[#4d260b] text-white" onClick={save}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;
