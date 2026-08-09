import api from './api';

const urlB64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const currentPushStatus = async () => {
  if (!pushSupported()) return { supported: false };
  const permission = Notification.permission;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return { supported: true, permission, subscribed: !!sub };
};

export const enablePush = async () => {
  if (!pushSupported()) throw new Error('Push notifications not supported in this browser');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied');

  const reg = await navigator.serviceWorker.ready;
  const { data } = await api.get('/push/public-key');
  if (!data.public_key) throw new Error('Push not configured on server');

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(data.public_key),
    });
  }
  const json = sub.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return true;
};

export const disablePush = async () => {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON();
  try { await api.post('/push/unsubscribe', { endpoint: json.endpoint, keys: json.keys }); } catch (_) {}
  await sub.unsubscribe();
};
