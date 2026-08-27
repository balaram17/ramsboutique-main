import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Download, RefreshCw, Save, Square } from 'lucide-react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';

const finished = new Set(['completed', 'completed_with_errors', 'failed']);

const AdminDmart = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [pincode, setPincode] = useState('530016');
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState(null);

  const load = async () => {
    const { data } = await api.get('/admin/dmart/categories');
    setCategories(data.categories);
    setSelected(new Set(data.categories.filter((item) => item.enabled).map((item) => item.token)));
    setPincode(data.pincode);
  };

  useEffect(() => { load().catch(() => {}); }, []);
  useEffect(() => {
    if (!job?.id || finished.has(job.status)) return undefined;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/admin/dmart/sync/${job.id}`);
        setJob({ ...data, id: data.id });
        if (finished.has(data.status)) {
          clearInterval(timer);
          await load();
          window.dispatchEvent(new Event('admin-notifications-updated'));
          toast({
            title: data.status === 'completed' ? 'DMart sync completed' : 'DMart sync needs attention',
            description: `Added ${data.added || 0}, updated ${data.updated || 0}, hidden ${data.hidden || 0}.`,
            variant: data.status === 'completed' ? undefined : 'destructive',
          });
        }
      } catch (_) { /* keep polling; transient Azure failures recover */ }
    }, 2500);
    return () => clearInterval(timer);
  }, [job?.id, job?.status, toast]);

  const activeCount = useMemo(() => categories.reduce((sum, item) => sum + (item.product_count || 0), 0), [categories]);
  const toggle = (token) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(token)) next.delete(token); else next.add(token);
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/dmart/categories', { tokens: [...selected] });
      toast({ title: 'DMart category selection saved', description: `${data.hidden} products hidden; ${data.restored} restored.` });
      await load();
    } catch (error) {
      toast({ title: 'Save failed', description: error.response?.data?.detail || error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const sync = async () => {
    if (!selected.size) return toast({ title: 'Select at least one category', variant: 'destructive' });
    try {
      await api.put('/admin/dmart/categories', { tokens: [...selected] });
      const { data } = await api.post('/admin/dmart/sync', { tokens: [...selected] });
      setJob({ id: data.job_id, status: data.status, category_done: 0, category_total: selected.size });
      toast({ title: data.already_running ? 'DMart sync already running' : 'DMart sync started', description: 'You can leave this page. Progress is stored in the database.' });
    } catch (error) {
      toast({ title: 'Sync failed to start', description: error.response?.data?.detail || error.message, variant: 'destructive' });
      window.dispatchEvent(new Event('admin-notifications-updated'));
    }
  };

  const downloadCsv = async () => {
    try {
      const response = await api.get('/admin/dmart/export.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = 'dmart-live-products.csv'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast({ title: 'CSV download failed', description: error.message, variant: 'destructive' });
    }
  };

  const busy = job && !finished.has(job.status);
  const progress = job?.category_total ? Math.round((job.category_done || 0) * 100 / job.category_total) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">DMart Catalogue</h1>
          <p className="text-sm text-gray-500 mt-1">Public DMart Ready MRP catalogue · requested area {pincode}. Sale prices are never imported.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadCsv}><Download className="w-4 h-4 mr-2" />Export Live CSV</Button>
          <Button variant="outline" onClick={save} disabled={saving || busy}><Save className="w-4 h-4 mr-2" />Save Selection</Button>
          <Button onClick={sync} disabled={busy} className="bg-[#6b3410] hover:bg-[#4d260b]"><RefreshCw className={`w-4 h-4 mr-2 ${busy ? 'animate-spin' : ''}`} />Sync Selected</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500">Selected categories</div><div className="text-2xl font-bold">{selected.size}</div></div>
        <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500">Imported products/SKUs</div><div className="text-2xl font-bold">{activeCount}</div></div>
        <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500">Price rule</div><div className="text-lg font-bold text-emerald-700">MRP only</div></div>
      </div>

      {job && (
        <div className={`border rounded-lg p-4 ${job.status === 'failed' || job.status === 'completed_with_errors' ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <div className="flex justify-between text-sm mb-2"><span className="font-semibold">Sync: {job.status.replaceAll('_', ' ')}</span><span>{progress}%</span></div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-[#f7941d] transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="text-xs text-gray-600 mt-2">Category {job.category_done || 0}/{job.category_total || 0}{job.current_category ? ` · ${job.current_category}` : ''} · Added {job.added || 0} · Updated {job.updated || 0} · Hidden {job.hidden || 0}</div>
          {!!job.errors?.length && <div className="text-xs text-red-700 mt-2">Latest error: {job.errors[job.errors.length - 1]}</div>}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        Unchecking a category hides its DMart products; it does not delete them. Recheck it and sync to restore and update them. DMart availability can vary by delivery location, while this import deliberately stores the public MRP as both website price and MRP.
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <div className="p-3 border-b flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(new Set(categories.map((item) => item.token)))}><CheckSquare className="w-4 h-4 mr-1" />Select all</Button>
          <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}><Square className="w-4 h-4 mr-1" />Clear</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3">Keep</th><th className="px-4 py-3">DMart category</th><th className="px-4 py-3">Imported</th><th className="px-4 py-3">Last sync</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody>{categories.map((item) => (
            <tr key={item.token} className="border-t hover:bg-gray-50">
              <td className="px-4 py-3"><input type="checkbox" checked={selected.has(item.token)} onChange={() => toggle(item.token)} className="w-4 h-4 accent-[#6b3410]" /></td>
              <td className="px-4 py-3"><div className="font-medium">{item.name}</div><div className="text-xs font-mono text-gray-400">{item.token}</div></td>
              <td className="px-4 py-3">{item.product_count || 0}</td>
              <td className="px-4 py-3 text-xs">{item.last_synced_at ? new Date(item.last_synced_at).toLocaleString('en-IN') : 'Never'}</td>
              <td className="px-4 py-3">{item.last_error ? <span className="text-red-600 text-xs">Error</span> : item.enabled ? <span className="text-emerald-700 text-xs">Enabled</span> : <span className="text-gray-500 text-xs">Hidden</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDmart;
