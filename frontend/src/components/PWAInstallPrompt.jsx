import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const already = localStorage.getItem('rb_pwa_dismissed') === '1';
    if (already) return;

    const onBip = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (_) { /* noop */ }
    setDeferredPrompt(null);
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem('rb_pwa_dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-white border border-[#6b3410]/20 shadow-2xl rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
        <Smartphone className="w-5 h-5 text-[#6b3410]" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm text-gray-900">Install Rams Boutique</div>
        <div className="text-xs text-gray-500">Faster access, offline browsing, home-screen app.</div>
      </div>
      <button onClick={install} className="bg-[#6b3410] hover:bg-[#4d260b] text-white text-xs font-semibold px-3 py-2 rounded-md flex items-center gap-1">
        <Download className="w-3.5 h-3.5" /> Install
      </button>
      <button onClick={dismiss} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default PWAInstallPrompt;
