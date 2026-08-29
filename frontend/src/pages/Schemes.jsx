import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, Package } from 'lucide-react';
import api from '../lib/api';
import './Schemes.css';

const teluguMonths = { 1: '1 నెల', 3: '3 నెలలు', 6: '6 నెలలు', 12: '12 నెలలు' };
const inr = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function Schemes() {
  const [duration, setDuration] = useState(12);
  const [plans, setPlans] = useState([]);
  const [kit, setKit] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { api.get('/chits/plans').then(r => setPlans(r.data)); }, []);
  useEffect(() => { api.post('/chits/calculate-kit', { duration }).then(r => setKit(r.data.items)); }, [duration]);
  const selectedPlan = plans.find(p => p.duration === duration);
  const monthlyRupees = (selectedPlan?.monthly_amount_paise || 0) / 100;
  const totalRupees = (selectedPlan?.total_paise || 0) / 100;
  return <div className="scheme-page">
    <section className="scheme-hero">
      <span className="scheme-pill">BTA FreshMart Grocery Savings</span>
      <h1>Save monthly. Receive your complete grocery kit once.</h1>
      <p>మీ ప్లాన్ మొత్తాన్ని నెలవారీగా చెల్లించండి • చివరి వాయిదా తర్వాత కిరాణా కిట్ పొందండి</p>
    </section>
    <section className="scheme-wrap">
      <div className="plan-grid">{plans.map(p => <button key={p.duration} onClick={() => setDuration(p.duration)} className={`plan-card ${duration === p.duration ? 'selected' : ''}`}>
        {p.duration === 12 && <span className="popular">BEST VALUE</span>}
        <span className="months">{p.duration}</span><span>MONTH{p.duration > 1 ? 'S' : ''}</span>
        <h2>{p.title}</h2><small>{teluguMonths[p.duration]}</small>
        <strong>₹{inr(p.monthly_amount_paise / 100)} <em>/ month</em></strong><p>Total ₹{inr(p.total_paise / 100)}</p>
        <span className="select-line">{duration === p.duration && <Check size={16}/>} Select plan</span>
      </button>)}</div>
      <div className="kit-preview">
        <div><Package/><div><h2>Your {duration}-month entitlement</h2><p>Full 12-month quantity ÷ 12 × {duration}</p></div></div>
        <button onClick={() => setOpen(!open)}>View Items List {open ? <ChevronUp/> : <ChevronDown/>}</button>
        {open && <div className="kit-table"><div className="kit-row kit-head"><span>Item</span><span>Full kit</span><span>Your quantity</span></div>
          {kit.map(i => <div className="kit-row" key={i.id}><span>{i.name}<small>{i.name_te}</small></span><span>{i.full_qty} {i.unit}</span><b>{i.final_qty} {i.unit}</b></div>)}</div>}
      </div>
      {selectedPlan && <Link className="join-cta" to={`/schemes/join/${duration}`}>Join {duration}-Month Plan • ₹{inr(monthlyRupees)} / month • Total ₹{inr(totalRupees)}</Link>}
      <p className="fine-print">All items are delivered together only after every instalment is successfully paid. ₹50 packing charge applies at slot booking.</p>
    </section>
  </div>;
}
