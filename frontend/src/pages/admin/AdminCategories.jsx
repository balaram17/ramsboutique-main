import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

const ICON_OPTIONS = ['wheat', 'milk', 'apple', 'coffee', 'cookie', 'sparkles', 'spray-can', 'baby', 'utensils', 'shirt'];

const AdminCategories = () => {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({ slug: '', name: '', icon: 'cookie' });

  const load = () => api.get('/categories').then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setF({ slug: '', name: '', icon: 'cookie' }); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setF({ slug: c.slug, name: c.name, icon: c.icon || 'cookie' }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) {
        await api.patch(`/admin/categories/${editing.slug}`, { name: f.name, icon: f.icon });
        toast({ title: 'Category updated' });
      } else {
        await api.post('/admin/categories', f);
        toast({ title: 'Category added' });
      }
      setOpen(false); load();
    } catch (e) {
      toast({ title: 'Failed', description: e.response?.data?.detail || 'Try again', variant: 'destructive' });
    }
  };

  const del = async (slug) => {
    if (!window.confirm(`Delete category "${slug}"? Products in it must be moved first.`)) return;
    try {
      await api.delete(`/admin/categories/${slug}`);
      toast({ title: 'Category deleted' });
      load();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.response?.data?.detail || 'Try again', variant: 'destructive' });
    }
  };

  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    setList(next);
    try {
      await api.patch('/admin/categories/reorder', { slugs: next.map((c) => c.slug) });
    } catch (e) {
      toast({ title: 'Reorder failed', variant: 'destructive' });
      load();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage the product categories shown across the store.</p>
        </div>
        <Button onClick={openNew} className="bg-[#6b3410] hover:bg-[#4d260b] gap-2"><Plus className="w-4 h-4" /> Add Category</Button>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="px-4 py-2 w-24">Order</th><th className="px-4 py-2">Slug</th><th className="px-4 py-2">Display name</th><th className="px-4 py-2">Icon</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((c, idx) => (
              <tr key={c.slug} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    <span className="text-xs text-gray-500 font-mono ml-1">#{idx + 1}</span>
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2">{c.icon}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(c.slug)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-500">No categories</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Slug (URL segment, lowercase-with-dashes)</Label>
              <Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="grocery" disabled={!!editing} />
              {editing && <p className="text-xs text-gray-500 mt-1">Slug cannot be changed after creation.</p>}
            </div>
            <div><Label>Display Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Grocery & Staples" /></div>
            <div>
              <Label>Icon</Label>
              <select className="w-full h-10 border rounded-md px-3 text-sm" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })}>
                {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
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

export default AdminCategories;
