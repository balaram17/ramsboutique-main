import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { Plus, Trash2, Pencil, Truck, Copy, ShieldCheck } from 'lucide-react';

const AdminAgents = () => {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const [f, setF] = useState({ name: '', phone: '', active: true });
  const load = () => api.get('/admin/agents').then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!f.name.trim() || !/^\d{10}$/.test(f.phone)) {
      toast({ title: 'Enter a name and valid 10-digit mobile number', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      if (editing) await api.patch(`/admin/agents/${editing.id}`, f);
      else { const response = await api.post('/admin/agents', f); setOnboarding(response.data.onboarding); }
      toast({ title: editing ? 'Agent updated' : 'Agent created in Microsoft Entra' });
      setOpen(false); load();
    } catch (error) {
      toast({ title: 'Save failed', description: error.response?.data?.detail || 'The Agent could not be synchronized with Microsoft Entra.', variant: 'destructive' });
    } finally { setSaving(false); }
  };
  const openNew = () => { setEditing(null); setF({ name: '', phone: '', active: true }); setOpen(true); };
  const openEdit = (a) => { setEditing(a); setF({ name: a.name, phone: a.phone, active: a.active }); setOpen(true); };
  const del = async (id) => {
    if (!confirm('Delete this agent and revoke Microsoft access?')) return;
    try { await api.delete(`/admin/agents/${id}`); load(); }
    catch (error) { toast({ title: 'Delete failed', description: error.response?.data?.detail, variant: 'destructive' }); }
  };
  const copy = async (value) => { await navigator.clipboard.writeText(value || ''); toast({ title: 'Copied' }); };

  return <div>
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-2xl font-bold">Delivery Agents</h1>
      <Button onClick={openNew} className="bg-[#6b3410] hover:bg-[#4d260b] gap-2"><Plus className="w-4 h-4" /> Add Agent</Button>
    </div>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{list.map((a) => <div key={a.id} className="bg-white border rounded-lg p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#6b3410] text-white flex items-center justify-center"><Truck className="w-5 h-5" /></div>
      <div className="flex-1"><div className="font-semibold">{a.name}</div><div className="text-xs text-gray-500">{a.phone}</div>
        <div className={`text-[10px] font-bold uppercase mt-0.5 ${a.active ? 'text-green-600' : 'text-gray-400'}`}>{a.active ? 'Active' : 'Inactive'}</div>
        <div className={`text-[10px] mt-0.5 ${a.entra_object_id ? 'text-blue-600' : 'text-amber-600'}`}>{a.entra_object_id ? 'Microsoft Entra linked' : 'Legacy agent — not linked'}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
      <Button size="sm" variant="ghost" onClick={() => del(a.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
    </div>)}</div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit Agent' : 'Add Agent'}</DialogTitle></DialogHeader>
      <div className="space-y-3"><div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input maxLength={10} inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
        <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></div>
      </div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={saving} onClick={save} className="bg-[#6b3410] hover:bg-[#4d260b]">{saving ? 'Creating in Microsoft…' : 'Save'}</Button></div>
    </DialogContent></Dialog>

    <Dialog open={Boolean(onboarding)} onOpenChange={(value) => { if (!value) setOnboarding(null); }}><DialogContent>
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Agent onboarding details</DialogTitle></DialogHeader>
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Copy these details now. The temporary password is shown only once and must be changed during first sign-in.</div>
      <div className="space-y-3"><div><Label>Microsoft username</Label><div className="flex gap-2"><Input readOnly value={onboarding?.username || ''} /><Button variant="outline" onClick={() => copy(onboarding?.username)}><Copy className="w-4 h-4" /></Button></div></div>
        <div><Label>Temporary password</Label><div className="flex gap-2"><Input readOnly value={onboarding?.temporary_password || ''} /><Button variant="outline" onClick={() => copy(onboarding?.temporary_password)}><Copy className="w-4 h-4" /></Button></div></div></div>
      <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1"><li>Open Agent Login and choose Staff Login with Microsoft.</li><li>Enter the username and temporary password above.</li><li>Create a new private password when Microsoft asks.</li><li>Install and register Microsoft Authenticator when prompted.</li></ol>
      <div className="flex justify-end"><Button onClick={() => setOnboarding(null)}>I have saved these details</Button></div>
    </DialogContent></Dialog>
  </div>;
};

export default AdminAgents;
