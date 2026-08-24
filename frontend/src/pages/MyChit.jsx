import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import './Schemes.css';

const loadRazorpay = () => new Promise(resolve => { if(window.Razorpay) return resolve(true); const s=document.createElement('script'); s.src='https://checkout.razorpay.com/v1/checkout.js'; s.onload=()=>resolve(true); document.body.appendChild(s); });
export default function MyChit() {
  const { user } = useAuth(); const [data,setData]=useState(null); const [error,setError]=useState(''); const [cancelling,setCancelling]=useState(false); const [slot,setSlot]=useState({delivery_date:'',time_slot:'09:00 AM - 12:00 PM'});
  const load=useCallback(async()=>{if(!user)return;try{setError('');const response=await api.get('/chits/my');setData(response.data)}catch(e){const detail=e.response?.data?.detail;setError(typeof detail==='string'?detail:'Unable to load chit')}},[user]);
  useEffect(()=>{load()},[load]);
  if(!user) return <div className="form-card"><h2>Please log in with your registered mobile number.</h2></div>;
  if(error) return <div className="form-card"><h2>{error}</h2></div>; if(!data) return <div className="form-card">Loading your chit card…</div>;
  const s=data.subscription, progress=Math.round(s.paid_count/s.chosen_duration*100);
  const book=async()=>{ try { const payload={subscription_id:s.id,...slot};const {data:o}=await api.post('/chits/book-slot',payload);if(o.type==='mock'){await api.post('/chits/book-slot/mock-confirm',payload);await load();return}await loadRazorpay();new window.Razorpay({key:o.key,amount:o.amount,currency:'INR',order_id:o.order_id,name:'Rams Boutique',description:'₹50 packing charge',handler:async r=>{await api.post('/chits/book-slot/confirm',{...payload,...r});load();}}).open(); } catch(e){setError(e.response?.data?.detail||'Slot booking failed');} };
  const cancelChit=async()=>{if(!window.confirm('Cancel this grocery chit? Future automatic payments will stop. Previous payments will NOT be refunded.'))return;const reason=window.prompt('Reason for cancellation (optional):','')||'Cancelled by customer';setCancelling(true);try{await api.post('/chits/cancel',{reason});await load()}catch(e){setError(e.response?.data?.detail||'Unable to cancel chit')}finally{setCancelling(false)}};
  return <div className="chit-dashboard"><div className="paper-card">
    <header><img src="/rb-logo.png" alt=""/><div><h1>Rams Boutique</h1><p>Monthly Grocery Saving Card</p></div><b>{s.card_no}</b></header>
    <div className="card-details"><span><small>Name</small>{s.name}</span><span><small>Phone</small>{s.phone}</span><span><small>Address</small>{s.address}, {s.city}</span><span><small>Plan</small>{s.chosen_duration} Months</span></div>
    <div className="progress-label"><b>{s.paid_count}/{s.chosen_duration} instalments paid</b><span>{progress}%</span></div><div className="progress"><i style={{width:`${progress}%`}}/></div>
    {s.status==='pending_admin_approval'&&<div className="approval-banner pending"><b>Awaiting admin approval</b><span>Your payment/application was received. The scheme will activate after review.</span></div>}
    {s.status==='denied'&&<div className="approval-banner denied"><b>Application denied</b><span>Captured scheme payment(s) have been submitted for refund.</span></div>}
    {s.status==='cancelled'&&<div className="approval-banner denied"><b>Subscription cancelled</b><span>Future automatic debits have been stopped.</span></div>}
    {s.status==='cancellation_requested'&&<div className="approval-banner pending"><b>Cancellation awaiting admin approval</b><span>Your chit remains in the database until an admin approves permanent deletion. Previous payments will not be refunded.</span></div>}
    <div className="payment-table"><div className="pay-row pay-head"><span>No.</span><span>Date</span><span>Amount</span><span>Status</span></div>
      {Array.from({length:s.chosen_duration},(_,i)=>{const p=data.payments[i];return <div className="pay-row" key={i}><span>{i+1}</span><span>{p?new Date(p.paid_at).toLocaleDateString('en-IN'):'—'}</span><span>₹500</span><b className={p?'paid':''}>{p?'Paid ✓':'Pending'}</b></div>})}</div>
  </div>
  <section className="entitlement"><h2>Your final 40-item kit</h2><p>Delivered once after the final payment.</p><div className="entitlement-grid">{data.kit.map(i=><span key={i.id}>{i.name}<b>{i.final_qty} {i.unit}</b></span>)}</div></section>
  {s.status==='ready_for_delivery'&&<section className="slot-box"><h2>Book Delivery Slot</h2><p>All instalments complete! Pay ₹50 packing charge to confirm.</p><input type="date" value={slot.delivery_date} min={new Date().toISOString().slice(0,10)} onChange={e=>setSlot({...slot,delivery_date:e.target.value})}/><select value={slot.time_slot} onChange={e=>setSlot({...slot,time_slot:e.target.value})}><option>09:00 AM - 12:00 PM</option><option>12:00 PM - 03:00 PM</option><option>03:00 PM - 06:00 PM</option><option>06:00 PM - 09:00 PM</option></select><button className="join-cta" onClick={book} disabled={!slot.delivery_date}>Pay ₹50 & Confirm Slot</button></section>}
  {data.slot&&<section className="slot-box success"><h2>Delivery booked ✓</h2><p>{data.slot.delivery_date} • {data.slot.time_slot}</p></section>}
  {!['cancellation_requested','cancelled','denied','delivered','delivery_booked'].includes(s.status)&&<section className="chit-cancel-box"><h2>Request Chit Cancellation</h2><p>Admin approval is required. When approved, the chit is permanently deleted and instalments already paid are not refunded.</p><button onClick={cancelChit} disabled={cancelling}>{cancelling?'Submitting…':'Request Cancellation'}</button></section>}
  </div>;
}
