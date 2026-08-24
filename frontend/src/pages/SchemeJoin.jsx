import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Schemes.css';

const loadRazorpay = () => new Promise(resolve => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true); script.onerror = () => resolve(false); document.body.appendChild(script);
});

export default function SchemeJoin() {
  const duration = Number(useParams().duration); const nav = useNavigate();
  const { user } = useAuth();
  const initialPhone = String(user?.phone || '').replace(/\D/g, '').slice(-10);
  const [form, setForm] = useState({ name: user?.name || '', phone: initialPhone, address: '', terms_accepted: false });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (![1,3,6,12].includes(duration)) return <div className="form-card">Invalid plan.</div>;
  const change = e => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const errorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    if (Array.isArray(detail)) return detail.map(x => x.msg || 'Invalid value').join(', ');
    if (typeof detail === 'string') return detail;
    return fallback;
  };
  const pay = async e => {
    e.preventDefault(); if (!form.terms_accepted) return setError('Please accept the scheme terms.');
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/chits/subscribe', { ...form, duration });
      if (data.checkout.type === 'mock') {
        await api.post('/chits/mock-payment', { subscription_id: data.subscription.id });
        nav('/my-chit');
        return;
      }
      if (!(await loadRazorpay())) throw new Error('Razorpay Checkout could not load');
      const options = { key: data.checkout.key, amount: data.checkout.amount, currency: 'INR', name: 'Rams Boutique', description: `${duration}-Month Grocery Scheme`, prefill: { name: form.name, contact: form.phone }, theme: { color: '#e48718' },
        handler: async response => { await api.post('/chits/verify-checkout', { subscription_id: data.subscription.id, ...response }); nav('/my-chit'); } };
      if (data.checkout.type === 'order') options.order_id = data.checkout.order_id; else options.subscription_id = data.checkout.subscription_id;
      new window.Razorpay(options).open();
    } catch(e2) { setError(errorMessage(e2, e2.message || 'Could not start payment')); }
    finally { setBusy(false); }
  };
  return <div className="join-page"><form className="form-card" onSubmit={pay}>
    <span className="scheme-pill">{duration}-Month Plan</span><h1>Join Grocery Saving Scheme</h1><p>{duration === 1 ? <>Payment today: <b>₹500</b></> : <>Monthly debit on the 10th: <b>₹500</b></>}</p>
    {error && <div className="form-error">{error}</div>}
    <label>Full name<input name="name" value={form.name} onChange={change} required/></label>
    <label>Mobile number<input name="phone" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" value={form.phone} onChange={change} placeholder="10-digit mobile number" required/></label>
    <label>Delivery address (Vizag)<textarea name="address" value={form.address} onChange={change} rows="4" required/></label>
    <label className="terms"><input type="checkbox" name="terms_accepted" checked={form.terms_accepted} onChange={change}/> I agree that the kit is delivered only after all {duration} payment(s), quantities are proportional to the selected duration, and ₹50 packing charge applies.</label>
    <button className="join-cta" disabled={busy}>{busy ? 'Please wait…' : duration === 1 ? 'Pay ₹500 securely' : 'Authorise ₹500 Monthly Autopay'}</button>
  </form></div>;
}
