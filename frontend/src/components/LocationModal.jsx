import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { MapPin, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useLocationCtx } from '../context/LocationContext';
import { useToast } from '../hooks/use-toast';

const VIZAG_AREAS = [
  { name: 'Dwaraka Nagar', lat: 17.7231, lng: 83.3012 },
  { name: 'MVP Colony', lat: 17.7411, lng: 83.3388 },
  { name: 'Siripuram', lat: 17.7196, lng: 83.3235 },
  { name: 'Asilmetta', lat: 17.7168, lng: 83.3096 },
  { name: 'Seethammadhara', lat: 17.7322, lng: 83.3183 },
  { name: 'Rushikonda', lat: 17.7825, lng: 83.3862 },
  { name: 'Madhurawada', lat: 17.8228, lng: 83.3435 },
  { name: 'Gajuwaka', lat: 17.6867, lng: 83.2093 },
];

const LocationModal = ({ open, onClose }) => {
  const { location, detect, setManual, checking } = useLocationCtx();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDetect = async () => {
    setBusy(true);
    try {
      const loc = await detect();
      if (loc.deliverable) toast({ title: 'Great! We deliver to your area.', description: `${loc.distance_km} km from our store.` });
      else toast({ title: 'Sorry, out of range', description: `You are ${loc.distance_km} km away. We deliver within 5 km.`, variant: 'destructive' });
      onClose();
    } catch (e) {
      toast({ title: 'Location error', description: e.message || 'Please allow location or pick manually.', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const pickArea = async (a) => {
    setBusy(true);
    try {
      const loc = await setManual(a.lat, a.lng);
      toast({ title: loc.deliverable ? `Delivering to ${a.name}` : 'Out of range', description: `${loc.distance_km} km from our store.` });
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-[#6b3410]" /> Choose Delivery Location</DialogTitle>
          <DialogDescription>We deliver within 5 km of our Dwaraka Nagar, Visakhapatnam store.</DialogDescription>
        </DialogHeader>

        {location && (
          <div className={`p-3 rounded-md text-sm flex items-start gap-2 ${location.deliverable ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'}`}>
            {location.deliverable ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <div>
              <div className="font-semibold">{location.deliverable ? 'You are in delivery range' : 'Out of delivery range'}</div>
              <div className="text-xs opacity-80">{location.distance_km} km from store</div>
            </div>
          </div>
        )}

        <Button onClick={handleDetect} disabled={busy || checking} className="w-full bg-[#6b3410] hover:bg-[#4d260b]">
          {busy || checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
          Detect my location
        </Button>

        <div className="text-xs text-gray-500 text-center">or pick your area in Vizag</div>

        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
          {VIZAG_AREAS.map((a) => (
            <button key={a.name} onClick={() => pickArea(a)} disabled={busy} className="text-left px-3 py-2 border border-gray-200 rounded-md hover:border-[#6b3410] hover:bg-amber-50 text-sm transition">
              <div className="font-medium">{a.name}</div>
              <div className="text-[11px] text-gray-500">Visakhapatnam</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationModal;
