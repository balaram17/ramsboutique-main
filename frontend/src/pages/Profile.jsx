import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Bell, BellOff, Loader2, Pencil, Save, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { pushSupported, currentPushStatus, enablePush, disablePush } from '../lib/push';
import { useToast } from '../hooks/use-toast';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [pushState, setPushState] = useState({ supported: false, permission: 'default', subscribed: false });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: String(user?.phone || '').replace(/\D/g, '').slice(-10) });

  const refresh = () => currentPushStatus().then((s) => setPushState(s));
  useEffect(() => {
    let active = true;
    currentPushStatus()
      .then((status) => { if (active) setPushState(status); })
      .catch(() => { if (active) setPushState({ supported: false, permission: 'default', subscribed: false }); });
    return () => { active = false; };
  }, []);

  if (!user) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (pushState.subscribed) {
        await disablePush();
        toast({ title: 'Push notifications disabled' });
      } else {
        await enablePush();
        toast({ title: 'Push notifications enabled', description: "We'll notify you about order updates." });
      }
      await refresh();
    } catch (e) {
      toast({ title: 'Could not update notifications', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    if (!/^\d{10}$/.test(form.phone)) {
      setProfileError('Enter a valid 10-digit mobile number. Your legacy test number may be shorter and must be corrected before saving.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ ...form, phone: form.phone.replace(/\D/g, '') });
      setEditing(false);
      toast({ title: 'Profile updated successfully' });
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = Array.isArray(detail) ? detail.map(x => x.msg).join(', ') : detail;
      setProfileError(message || 'Check the entered information');
      toast({ title: 'Could not update profile', description: message || 'Check the entered information', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="bg-white rounded-lg border p-6">
        <div className="flex justify-end mb-2">
          {!editing && <Button variant="outline" size="sm" onClick={() => { setProfileError(''); setForm({ name: user.name || '', email: user.email || '', phone: String(user.phone || '').replace(/\D/g, '').slice(-10) }); setEditing(true); }}><Pencil className="w-4 h-4 mr-2"/>Edit Profile</Button>}
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#6b3410] text-white flex items-center justify-center font-black text-2xl">{(user.name || 'U')[0]}</div>
          <div>
            <h1 className="text-xl font-bold">{user.name || 'Customer'}</h1>
            <p className="text-sm text-gray-500">Member since 2026</p>
          </div>
        </div>
        {!editing ? <div className="mt-6 space-y-3 text-sm">
          <div className="flex items-center gap-3 border-b py-3"><Mail className="w-4 h-4 text-gray-500" /><span>{user.email || 'Not provided'}</span></div>
          <div className="flex items-center gap-3 border-b py-3"><Phone className="w-4 h-4 text-gray-500" /><span>{user.phone || 'Not provided'}</span></div>
          <div className="flex items-center gap-3 py-3"><User className="w-4 h-4 text-gray-500" /><span className="capitalize">{user.role}</span></div>
        </div> : <form className="mt-6 space-y-4" onSubmit={saveProfile}>
          {profileError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{profileError}</div>}
          <label className="block text-sm font-semibold">Full name<input className="mt-1 w-full border rounded-md px-3 py-2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} minLength="2" required/></label>
          <label className="block text-sm font-semibold">Email address<input type="email" className="mt-1 w-full border rounded-md px-3 py-2" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label>
          <label className="block text-sm font-semibold">Mobile number<input inputMode="numeric" pattern="[0-9]{10}" maxLength="10" className="mt-1 w-full border rounded-md px-3 py-2" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value.replace(/\D/g,'')})} required/></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setEditing(false)}><X className="w-4 h-4 mr-2"/>Cancel</Button><Button type="submit" disabled={busy} className="bg-[#6b3410] hover:bg-[#4d260b]"><Save className="w-4 h-4 mr-2"/>{busy?'Saving…':'Save Changes'}</Button></div>
        </form>}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-2">
          {pushState.subscribed ? <Bell className="w-5 h-5 text-[#6b3410]" /> : <BellOff className="w-5 h-5 text-gray-400" />}
          <h2 className="font-semibold">Order Notifications</h2>
        </div>
        {!pushSupported() ? (
          <p className="text-xs text-gray-500">Push notifications are not supported in this browser. Try installing the app for the best experience.</p>
        ) : pushState.permission === 'denied' ? (
          <p className="text-xs text-red-600">Notifications are blocked in your browser settings. Enable them from site settings to receive order updates.</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">Get instant updates when your order is packed, out for delivery, or arrives.</p>
            <Button onClick={toggle} disabled={busy} className={pushState.subscribed ? 'bg-gray-700 hover:bg-gray-800' : 'bg-[#6b3410] hover:bg-[#4d260b]'}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {pushState.subscribed ? 'Turn Off Notifications' : 'Turn On Notifications'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
