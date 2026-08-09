import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { Plus, Trash2, Pencil, Truck } from 'lucide-react';

const AdminAgents = () => {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({ name: '', phone: '', active: true });

  const load = () => api.get('/admin/agents').then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api.patch(`/admin/agents/${editing.id}`, f);
      else await api.post('/admin/agents', f);
      toast({ title: editing ? 'Agent updated' : 'Agent added' });
      setOpen(false); load();
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
  };

  const openNew = () => { setEditing(null); setF({ name: '', phone: '', active: true }); setOpen(true); };
  const openEdit = (a) => { setEditing(a); setF({ name: a.name, phone: a.phone, active: a.active }); setOpen(true); };

  const del = async (id) => { if (!confirm('Delete agent?')) return; await api.delete(`/admin/agents/${id}`); load(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Delivery Agents</h1>
        <Button onClick={openNew} className="bg-[#6b3410] hover:bg-[#4d260b] gap-2"><Plus className="w-4 h-4" /> Add Agent</Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((a) => (
          <div key={a.id} className="bg-white border rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6b3410] text-white flex items-center justify-center"><Truck className="w-5 h-5" /></div>
            <div className="flex-1">
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-gray-500">{a.phone}</div>
              <div className={`text-[10px] font-bold uppercase mt-0.5 ${a.active ? 'text-green-600' : 'text-gray-400'}`}>{a.active ? 'Active' : 'Inactive'}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => del(a.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Agent' : 'Add Agent'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
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

export default AdminAgents;
