import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { pushSupported, currentPushStatus, enablePush, disablePush } from '../lib/push';
import { useToast } from '../hooks/use-toast';

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pushState, setPushState] = useState({ supported: false, permission: 'default', subscribed: false });
  const [busy, setBusy] = useState(false);

  const refresh = () => currentPushStatus().then((s) => setPushState(s));
  useEffect(() => { refresh(); }, []);

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#6b3410] text-white flex items-center justify-center font-black text-2xl">{user.name[0]}</div>
          <div>
            <h1 className="text-xl font-bold">{user.name}</h1>
            <p className="text-sm text-gray-500">Member since 2025</p>
          </div>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <div className="flex items-center gap-3 border-b py-3"><Mail className="w-4 h-4 text-gray-500" /><span>{user.email}</span></div>
          <div className="flex items-center gap-3 border-b py-3"><Phone className="w-4 h-4 text-gray-500" /><span>{user.phone}</span></div>
          <div className="flex items-center gap-3 py-3"><User className="w-4 h-4 text-gray-500" /><span className="capitalize">{user.role}</span></div>
        </div>
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
