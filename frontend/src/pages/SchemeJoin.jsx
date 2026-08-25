import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Schemes.css';

export default function SchemeJoin() {
  const duration = Number(useParams().duration); const nav = useNavigate();
  const { user } = useAuth();
  const initialPhone = String(user?.phone || '').replace(/\D/g, '').slice(-10);
  const [form, setForm] = useState({ name: user?.name || '', phone: initialPhone, address: '', terms_accepted: false });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    api.get('/chits/plans').then(({data}) => setPlan(data.find(x => x.duration === duration) || null));
  }, [duration]);
  if (![1,3,6,12].includes(duration)) return <div className="form-card">Invalid plan.</div>;
  const monthlyRupees = (plan?.monthly_amount_paise || 0) / 100;
  const totalRupees = (plan?.total_paise || 0) / 100;
  const money = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
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
      await api.post('/chits/subscribe', { ...form, duration });
      nav('/my-chit');
    } catch(e2) { setError(errorMessage(e2, e2.message || 'Could not start payment')); }
    finally { setBusy(false); }
  };
  return <div className="join-page"><form className="form-card" onSubmit={pay}>
    <span className="scheme-pill">{duration}-Month Plan</span><h1>Join Grocery Saving Scheme</h1><p>Monthly instalment after admin approval: <b>₹{money(monthlyRupees)}</b> • Total: <b>₹{money(totalRupees)}</b></p>
    {error && <div className="form-error">{error}</div>}
    <label>Full name<input name="name" value={form.name} onChange={change} required/></label>
    <label>Mobile number<input name="phone" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" value={form.phone} onChange={change} placeholder="10-digit mobile number" required/></label>
    <label>Delivery address (Vizag)<textarea name="address" value={form.address} onChange={change} rows="4" required/></label>
    <label className="terms"><input type="checkbox" name="terms_accepted" checked={form.terms_accepted} onChange={change}/> I agree that the kit is delivered only after all {duration} payment(s), quantities are proportional to the selected duration, and ₹50 packing charge applies.</label>
    <button className="join-cta" disabled={busy || !plan}>{busy ? 'Please wait…' : 'Submit for Admin Approval'}</button>
  </form></div>;
}
