import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, Package, User, Phone, MapPin, Clock, ShieldCheck, Send } from 'lucide-react';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { signOutStaffWithMicrosoft } from '../lib/entraAuth';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const AgentDashboard = () => {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [deliveryForms, setDeliveryForms] = useState({});
  const [busyOrder, setBusyOrder] = useState(null);
  const nav = useNavigate();
  
  const token = localStorage.getItem('agentToken');

  // 1. Memoize the API client instance so it maintains reference identity across renders
  const api = useMemo(() => {
    return axios.create({
      baseURL: API_BASE_URL,
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }, [token]);

  // 2. Safe useCallback that only runs when the memoized api instance updates
  const loadData = useCallback(async () => {
    try {
      const [me, myOrders] = await Promise.all([
        api.get('/api/agent/me'),
        api.get('/api/agent/orders')
      ]);
      setProfile(me.data);
      setOrders(myOrders.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [api]);

  // 3. Trigger initial fetch safely OR kick out unauthenticated users immediately
  useEffect(() => {
    if (!token) {
      nav('/login');
      return;
    }
    loadData();
  }, [token, loadData, nav]);

  const updateStatus = async (orderId, status) => {
    try {
      setBusyOrder(orderId);
      const { data } = await api.patch(`/api/agent/orders/${orderId}`, { status });
      setOrders(prev => prev.map(o => (o.id === orderId ? data : o)));
    } catch (err) {
      alert(err.response?.data?.detail || 'Status update failed');
    } finally {
      setBusyOrder(null);
    }
  };

  const patchDeliveryForm = (orderId, patch) => {
    setDeliveryForms(prev => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  };

  const sendDeliveryOtp = async (orderId) => {
    try {
      setBusyOrder(orderId);
      await api.post(`/api/agent/orders/${orderId}/delivery-otp`);
      patchDeliveryForm(orderId, { sent: true, otp: '' });
      alert('Delivery OTP sent to the customer. It expires in 10 minutes.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Unable to send delivery OTP');
    } finally {
      setBusyOrder(null);
    }
  };

  const verifyDeliveryOtp = async (order) => {
    const form = deliveryForms[order.id] || {};
    if (!/^\d{4}$/.test(form.otp || '')) {
      alert('Enter the 4-digit OTP received by the customer');
      return;
    }
    try {
      setBusyOrder(order.id);
      const { data } = await api.post(`/api/agent/orders/${order.id}/verify-delivery-otp`, {
        otp: form.otp,
        payment_collected: Boolean(form.paymentCollected)
      });
      setOrders(prev => prev.map(o => (o.id === order.id ? data : o)));
      patchDeliveryForm(order.id, { otp: '', sent: false, paymentCollected: false });
      alert('Delivery verified and completed');
    } catch (err) {
      alert(err.response?.data?.detail || 'Delivery verification failed');
    } finally {
      setBusyOrder(null);
    }
  };

  const saveProfile = async () => {
    // 1. Validate Name input
    const cleanName = profile?.name?.trim() || '';
    if (!cleanName) {
      alert('Enter a valid name');
      return;
    }

    // 2. Validate Phone input (Strip away non-numeric characters)
    const cleanPhone = profile?.phone?.toString().replace(/\D/g, '') || '';
    if (cleanPhone.length !== 10) {
      alert('Enter correct 10-digit mobile number');
      return;
    }

    try {
      // Send the validated profile state to the backend
      await api.patch('/api/agent/me', {
        ...profile,
        name: cleanName // Sends the trimmed name
      });
      alert('Profile updated');
    } catch {
      alert('Profile update failed');
    }
  };

  const logout = async () => {
    localStorage.removeItem('agentToken');
    localStorage.removeItem('agentId');
    localStorage.removeItem('agentName');
    const redirected = await signOutStaffWithMicrosoft().catch(() => false);
    if (!redirected) nav('/login', { replace: true });
  };

  // If there is no token, don't flash the dashboard components or the loading text
  if (!token) return null;
  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Agent Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/rb-logo.png"
              alt="BTA FreshMart"
              className="h-14 w-auto max-w-[180px] object-contain"
            />
            <div>
              <div className="font-bold text-[#6b3410]">BTA FreshMart</div>
              <div className="text-xs text-gray-500">Delivery Agent Partner Portal</div>
            </div>
          </div>

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 rounded-full border px-3 py-2 hover:bg-gray-50"
            >
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium hidden sm:block">
                {profile?.name || 'Agent'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg py-2">
                <div className="px-4 py-2 border-b">
                  <div className="font-medium text-sm">{profile?.name}</div>
                  <div className="text-xs text-gray-500">{profile?.phone}</div>
                </div>
                <button 
                  onClick={logout} 
                  className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-gray-100 text-red-600"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow border p-5">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
            <User className="w-6 h-6 text-indigo-600" />
            Agent Profile
          </h1>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Name</label>
              <input
                className="w-full border rounded px-3 py-2 mt-1"
                value={profile?.name || ''}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Phone</label>
              <input
                className="w-full border rounded px-3 py-2 mt-1"
                type="tel"
                maxLength={10}
                value={profile?.phone || ''}
                onChange={e => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
          <button
            onClick={saveProfile}
            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Save Profile
          </button>
        </div>

        {/* Orders Card */}
        <div className="bg-white rounded-lg shadow border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Assigned Orders ({orders.length})
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No orders assigned yet.
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="font-bold text-lg">{order.order_no}</div>
                      <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Clock className="w-4 h-4" />
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-700">
                        ₹{order.total}
                      </div>
                      <div className="text-sm capitalize text-gray-600">
                        {order.status?.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2 text-sm">
                      <div className="font-medium">Customer</div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <User className="w-4 h-4" />
                        {order.address?.full_name}
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="w-4 h-4" />
                        {order.address?.phone}
                      </div>
                      <div className="flex items-start gap-2 text-gray-700">
                        <MapPin className="w-4 h-4 mt-0.5" />
                        <span>
                          {order.address?.line1}, {order.address?.line2}<br />
                          {order.address?.city} - {order.address?.pincode}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="font-medium mb-2 text-sm">Delivery progress</div>
                      <div className="flex flex-wrap gap-2">
                        {order.status === 'assigned' && <button disabled={busyOrder === order.id} onClick={() => updateStatus(order.id, 'accepted')} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50 text-sm">Accept delivery</button>}
                        {['accepted', 'packed'].includes(order.status) && <button disabled={busyOrder === order.id} onClick={() => updateStatus(order.id, 'picked_up')} className="px-3 py-2 rounded bg-yellow-600 text-white disabled:opacity-50 text-sm">Picked up</button>}
                        {order.status === 'picked_up' && <button disabled={busyOrder === order.id} onClick={() => updateStatus(order.id, 'out_for_delivery')} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50 text-sm">Out for delivery</button>}
                        {order.status === 'delivered' && <span className="inline-flex items-center gap-2 rounded bg-green-100 px-3 py-2 text-sm font-semibold text-green-700"><ShieldCheck className="w-4 h-4" /> Delivery verified</span>}
                      </div>
                      {order.status === 'out_for_delivery' && (
                        <div className="mt-3 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <button disabled={busyOrder === order.id} onClick={() => sendDeliveryOtp(order.id)} className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                            <Send className="h-4 w-4" /> {deliveryForms[order.id]?.sent ? 'Resend delivery OTP' : 'Send delivery OTP'}
                          </button>
                          <input
                            aria-label="Delivery OTP"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="4-digit customer OTP"
                            className="w-full rounded border px-3 py-2 text-sm"
                            value={deliveryForms[order.id]?.otp || ''}
                            onChange={e => patchDeliveryForm(order.id, { otp: e.target.value.replace(/\D/g, '') })}
                          />
                          {String(order.payment_method).toUpperCase() === 'COD' && (
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                              <input type="checkbox" checked={Boolean(deliveryForms[order.id]?.paymentCollected)} onChange={e => patchDeliveryForm(order.id, { paymentCollected: e.target.checked })} />
                              COD cash collected: ₹{order.total}
                            </label>
                          )}
                          <button disabled={busyOrder === order.id} onClick={() => verifyDeliveryOtp(order)} className="w-full rounded bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Verify OTP & complete delivery</button>
                          <p className="text-xs text-blue-800">OTP expires in 10 minutes. Maximum 5 attempts.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AgentDashboard;
