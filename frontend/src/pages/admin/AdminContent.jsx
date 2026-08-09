import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { useSiteContent } from '../../context/SiteContentContext';
import { Loader2, Save, RefreshCw } from 'lucide-react';

const emptyContent = {
  top_strip: '',
  hero: { pill: '', title: '', subtitle: '', cta1_text: '', cta1_link: '', cta2_text: '', cta2_link: '', image: '' },
  login: { welcome: '', subheading: '', footer: '' },
  footer: { description: '', tagline: '', address: '', phone: '', email: '', facebook: '', instagram: '', twitter: '', youtube: '', copyright: '' },
  store_hours: { enabled: true, timezone_offset_minutes: 330, open: '07:00', close: '22:00', closed_days: [], closed_message: '' },
};

const Field = ({ label, value, onChange, placeholder, textarea = false }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {textarea ? (
      <Textarea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} />
    ) : (
      <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    )}
  </div>
);

const AdminContent = () => {
  const { toast } = useToast();
  const { content, refresh } = useSiteContent();
  const [form, setForm] = useState(emptyContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      top_strip: content.top_strip || '',
      hero: { ...emptyContent.hero, ...(content.hero || {}) },
      login: { ...emptyContent.login, ...(content.login || {}) },
      footer: { ...emptyContent.footer, ...(content.footer || {}) },
      store_hours: { ...emptyContent.store_hours, ...(content.store_hours || {}) },
    });
  }, [content]);

  const setSection = (section, key, value) => {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/site-content', form);
      await refresh();
      toast({ title: 'Site content updated', description: 'Changes are live on the site.' });
    } catch (e) {
      toast({ title: 'Failed to save', description: e.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Site Content</h1>
          <p className="text-xs text-gray-500 mt-0.5">Edit the top strip, homepage hero, login page and footer. Changes appear immediately.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} className="gap-2"><RefreshCw className="w-4 h-4" /> Reload</Button>
          <Button onClick={save} disabled={saving} className="bg-[#6b3410] hover:bg-[#4d260b] gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-5 mb-4">
        <Field label="Top strip (announcement bar at very top)"
          value={form.top_strip}
          onChange={(v) => setForm((p) => ({ ...p, top_strip: v }))}
          placeholder="Free delivery on orders above ₹499..." />
      </div>

      <Tabs defaultValue="hero">
        <TabsList className="grid grid-cols-4 max-w-2xl">
          <TabsTrigger value="hero">Homepage Hero</TabsTrigger>
          <TabsTrigger value="login">Login Page</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
          <TabsTrigger value="hours">Store Hours</TabsTrigger>
        </TabsList>

        <TabsContent value="hero">
          <div className="bg-white border rounded-lg p-5 grid md:grid-cols-2 gap-4">
            <Field label="Pill badge text" value={form.hero.pill} onChange={(v) => setSection('hero', 'pill', v)} />
            <Field label="Hero image URL" value={form.hero.image} onChange={(v) => setSection('hero', 'image', v)} />
            <div className="md:col-span-2">
              <Field label="Title" value={form.hero.title} onChange={(v) => setSection('hero', 'title', v)} />
            </div>
            <div className="md:col-span-2">
              <Field label="Subtitle" value={form.hero.subtitle} onChange={(v) => setSection('hero', 'subtitle', v)} textarea />
            </div>
            <Field label="CTA 1 – Text" value={form.hero.cta1_text} onChange={(v) => setSection('hero', 'cta1_text', v)} />
            <Field label="CTA 1 – Link (e.g. /c/grocery)" value={form.hero.cta1_link} onChange={(v) => setSection('hero', 'cta1_link', v)} />
            <Field label="CTA 2 – Text" value={form.hero.cta2_text} onChange={(v) => setSection('hero', 'cta2_text', v)} />
            <Field label="CTA 2 – Link" value={form.hero.cta2_link} onChange={(v) => setSection('hero', 'cta2_link', v)} />
          </div>
        </TabsContent>

        <TabsContent value="login">
          <div className="bg-white border rounded-lg p-5 space-y-4">
            <Field label="Welcome heading" value={form.login.welcome} onChange={(v) => setSection('login', 'welcome', v)} placeholder="Welcome" />
            <Field label="Subheading" value={form.login.subheading} onChange={(v) => setSection('login', 'subheading', v)} placeholder="Login or sign up to continue" />
            <Field label="Footer note" value={form.login.footer} onChange={(v) => setSection('login', 'footer', v)} textarea placeholder="By continuing you agree to..." />
          </div>
        </TabsContent>

        <TabsContent value="footer">
          <div className="bg-white border rounded-lg p-5 grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Description" value={form.footer.description} onChange={(v) => setSection('footer', 'description', v)} textarea />
            </div>
            <Field label="Tagline (under brand)" value={form.footer.tagline} onChange={(v) => setSection('footer', 'tagline', v)} />
            <Field label="Copyright line" value={form.footer.copyright} onChange={(v) => setSection('footer', 'copyright', v)} />
            <Field label="Address" value={form.footer.address} onChange={(v) => setSection('footer', 'address', v)} />
            <Field label="Phone" value={form.footer.phone} onChange={(v) => setSection('footer', 'phone', v)} />
            <Field label="Email" value={form.footer.email} onChange={(v) => setSection('footer', 'email', v)} />
            <div />
            <Field label="Facebook URL" value={form.footer.facebook} onChange={(v) => setSection('footer', 'facebook', v)} placeholder="https://facebook.com/..." />
            <Field label="Instagram URL" value={form.footer.instagram} onChange={(v) => setSection('footer', 'instagram', v)} placeholder="https://instagram.com/..." />
            <Field label="Twitter URL" value={form.footer.twitter} onChange={(v) => setSection('footer', 'twitter', v)} placeholder="https://twitter.com/..." />
            <Field label="YouTube URL" value={form.footer.youtube} onChange={(v) => setSection('footer', 'youtube', v)} placeholder="https://youtube.com/..." />
          </div>
        </TabsContent>

        <TabsContent value="hours">
          <div className="bg-white border rounded-lg p-5 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={!!form.store_hours.enabled}
                onChange={(e) => setSection('store_hours', 'enabled', e.target.checked)} />
              <span className="text-sm font-medium">Enforce store hours (block orders outside these times)</span>
            </label>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Opening time (24h HH:MM, local)</Label>
                <Input type="time" value={form.store_hours.open || '07:00'} onChange={(e) => setSection('store_hours', 'open', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Closing time</Label>
                <Input type="time" value={form.store_hours.close || '22:00'} onChange={(e) => setSection('store_hours', 'close', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Weekly closed days</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => {
                  const active = (form.store_hours.closed_days || []).includes(i);
                  return (
                    <button key={d} type="button"
                      onClick={() => {
                        const cur = form.store_hours.closed_days || [];
                        const next = active ? cur.filter((x) => x !== i) : [...cur, i];
                        setSection('store_hours', 'closed_days', next);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${active ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300 hover:border-[#6b3410]'}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1">Days marked will be treated as store-closed all day.</p>
            </div>
            <Field label="Message shown when store is closed" value={form.store_hours.closed_message}
              onChange={(v) => setSection('store_hours', 'closed_message', v)} textarea
              placeholder="We are closed right now. Delivery hours: 7:00 AM – 10:00 PM." />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminContent;
