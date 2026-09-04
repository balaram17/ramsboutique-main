import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Download, Layers, RefreshCw, Save, Square, Trash2, Upload } from 'lucide-react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';

const AdminDmart = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [pincode, setPincode] = useState('530016');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [job, setJob] = useState(null);
  const csvInputRef = useRef(null);

  const load = async () => {
    const { data } = await api.get('/admin/dmart/categories');
    setCategories(data.categories);
    setSelected(new Set(data.categories.filter((item) => item.enabled).map((item) => item.token)));
    setPincode(data.pincode);
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const activeCount = useMemo(() => categories.reduce((sum, item) => sum + (item.product_count || 0), 0), [categories]);
  const busy = saving || importing || merging || replacing;
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

  const downloadBrowserScript = async () => {
    if (!selected.size) return toast({ title: 'Select at least one category', variant: 'destructive' });
    try {
      await api.put('/admin/dmart/categories', { tokens: [...selected] });
      const response = await api.get('/admin/dmart/export-script.js', {
        params: { tokens: [...selected].join(',') }, responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = 'dmart-browser-export.js'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: 'Browser export script downloaded', description: 'Open the file, copy all code, and run it in the Console on dmart.in.' });
      await load();
    } catch (error) {
      toast({ title: 'Script download failed', description: error.response?.data?.detail || error.message, variant: 'destructive' });
    }
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const { data } = await api.post('/admin/dmart/import-csv', { csv_text: await file.text() });
      toast({
        title: data.failed ? 'DMart CSV imported with errors' : 'DMart CSV imported',
        description: `Added ${data.added}, updated ${data.updated}, hidden ${data.hidden}, failed ${data.failed}.`,
        variant: data.failed ? 'destructive' : undefined,
      });
      await load();
      window.dispatchEvent(new Event('admin-notifications-updated'));
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast({ title: 'DMart CSV import failed', description: typeof detail === 'string' ? detail : detail?.message || error.message, variant: 'destructive' });
      window.dispatchEvent(new Event('admin-notifications-updated'));
    } finally { setImporting(false); }
  };

  const mergeVariants = async () => {
    if (!confirm('Merge existing DMart pack sizes into one product with variants? Old individual SKU listings will be hidden.')) return;
    setMerging(true);
    try {
      const { data } = await api.post('/admin/dmart/merge-variants');
      toast({
        title: 'Pack sizes merged into variants',
        description: `Created ${data.added}, updated ${data.updated}, hid ${data.hidden} old SKU listings.`,
      });
      await load();
      window.dispatchEvent(new Event('admin-notifications-updated'));
    } catch (error) {
      toast({ title: 'Merge failed', description: error.response?.data?.detail || error.message, variant: 'destructive' });
    } finally { setMerging(false); }
  };

  const replaceCatalogue = async () => {
    if (!selected.size) return toast({ title: 'Select at least one category to re-import', variant: 'destructive' });
    if (!confirm('Permanently delete ALL existing DMart products AND all Seethammadhara / Digi Rythu Bazaar products, then import a fresh DMart catalogue? This cannot be undone.')) return;
    setReplacing(true);
    setJob({ status: 'queued', category_done: 0, category_total: selected.size, added: 0, sku_count: 0, deleted: 0 });
    try {
      await api.put('/admin/dmart/categories', { tokens: [...selected] });
      const { data } = await api.post('/admin/dmart/replace', { tokens: [...selected], confirm: true });
      setJob((current) => ({ ...current, ...data }));
      toast({ title: 'Fresh DMart import started', description: 'Old DMart and Seethammadhara products are being deleted, then a new DMart catalogue will be imported. Keep this page open.' });
      window.dispatchEvent(new Event('admin-notifications-updated'));
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const status = await api.get(`/admin/dmart/sync/${data.job_id}`);
        setJob(status.data);
        if (['completed', 'completed_with_errors', 'failed'].includes(status.data.status)) {
          await load();
          window.dispatchEvent(new Event('admin-notifications-updated'));
          if (status.data.status === 'failed') {
            toast({ title: 'Fresh import failed', description: (status.data.errors || []).join(' ') || 'Try again', variant: 'destructive' });
          } else {
            toast({
              title: status.data.status === 'completed_with_errors' ? 'Imported with some errors' : 'Fresh DMart catalogue imported',
              description: `Added ${status.data.added || 0} products from ${status.data.sku_count || 0} pack sizes.`,
              variant: status.data.status === 'completed_with_errors' ? 'destructive' : undefined,
            });
          }
          break;
        }
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast({ title: 'Replace failed', description: typeof detail === 'string' ? detail : error.message, variant: 'destructive' });
    } finally { setReplacing(false); }
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">DMart Catalogue</h1>
          <p className="text-sm text-gray-500 mt-1">Public DMart Ready MRP catalogue · requested area {pincode}. Sale prices are never imported.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={mergeVariants} disabled={busy}>
            <Layers className="w-4 h-4 mr-2" />{merging ? 'Merging…' : 'Merge Pack Sizes'}
          </Button>
          <Button variant="outline" onClick={downloadCsv} disabled={busy}><Download className="w-4 h-4 mr-2" />Export Live CSV</Button>
          <Button variant="outline" onClick={save} disabled={busy}><Save className="w-4 h-4 mr-2" />Save Selection</Button>
          <Button variant="outline" onClick={downloadBrowserScript} disabled={busy}><Download className="w-4 h-4 mr-2" />Download Export Script</Button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          <Button onClick={() => csvInputRef.current?.click()} disabled={busy} className="bg-[#6b3410] hover:bg-[#4d260b]"><Upload className="w-4 h-4 mr-2" />{importing ? 'Importing…' : 'Upload DMart CSV'}</Button>
          <Button onClick={replaceCatalogue} disabled={busy} className="bg-red-700 hover:bg-red-800">
            {replacing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {replacing ? 'Replacing…' : 'Delete all & import fresh'}
          </Button>
        </div>
      </div>

      {job && (
        <div className="bg-white border rounded-lg p-4 text-sm">
          <div className="font-semibold text-slate-800">Fresh import: {job.status}</div>
          <div className="text-slate-500 mt-1">
            Categories {job.category_done || 0}/{job.category_total || 0}
            {job.current_category ? ` · ${job.current_category}` : ''}
            {' · '}Deleted {job.deleted || 0}
            {' · '}Products {job.added || 0}
            {' · '}Pack sizes {job.sku_count || 0}
          </div>
          {job.errors?.length > 0 && (
            <div className="text-red-600 text-xs mt-2">{job.errors.slice(0, 5).join(' · ')}</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500">Selected categories</div><div className="text-2xl font-bold">{selected.size}</div></div>
        <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500">Imported products</div><div className="text-2xl font-bold">{activeCount}</div></div>
        <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500">Price rule</div><div className="text-lg font-bold text-emerald-700">MRP only</div></div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        To wipe old listings and pull a clean DMart catalogue: select the categories to keep, then click <strong>Delete all & import fresh</strong>. That also deletes Seethammadhara / Digi Rythu Bazaar products. Pack sizes of the same DMart item are stored as variants.
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
