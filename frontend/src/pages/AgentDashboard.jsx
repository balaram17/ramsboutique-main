import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
import React, { useEffect, useState, useCallback} from 'react';
import api from '../lib/api';
import axios from 'axios';
import { Package, User, Phone, MapPin, Clock } from 'lucide-react';


const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL

const AgentDashboard = () => {
  const [profile, setProfile] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const token = localStorage.getItem('agentToken')

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })


// move this ABOVE useEffect
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

useEffect(() => {
  loadData();
}, [loadData]);

  const updateStatus = async (orderId, status) => {
    try {
      await api.patch(`/api/agent/orders/${orderId}`, { status })

      setOrders(prev =>
        prev.map(o =>
          o.id === orderId ? { ...o, status } : o
        )
      )
    } catch (err) {
      alert(err.response?.data?.detail || 'Status update failed')
    }
  }

  const saveProfile = async () => {
    try {
      await api.patch('/api/agent/me', profile)
      alert('Profile updated')
    } catch {
      alert('Profile update failed')
    }
  }

  const logout = () => {
  localStorage.removeItem('agentToken');
  localStorage.removeItem('agentId');
  localStorage.removeItem('agentName');
  nav('/login');
};

  if (loading) return <div className="p-6">Loading...</div>

  return (
  <div className="min-h-screen bg-gray-100">
    {/* Agent Header */}
    <div className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/rb-logo.png"
            alt="Rams Boutique"
            className="h-10 w-10 object-contain"
          />

          <div>
            <div className="font-bold text-[#6b3410]">Rams Boutique</div>
            <div className="text-xs text-gray-500">Delivery Partner Portal</div>
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

          <button onClick={() => { logout(); }} className="p-5 border-t border-white/10 text-left text-sm flex items-center gap-3 hover:bg-white/5">
                <LogOut className="w-4 h-4" /> Logout
          </button>

            </div>
          )}
        </div>
      </div>
    </div>

    <div className="p-6 max-w-6xl mx-auto space-y-6"></div>

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
              value={profile?.phone || ''}
              onChange={e => setProfile({ ...profile, phone: e.target.value })}
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
                      {order.status.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">Customer</div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="w-4 h-4" />
                      {order.address.full_name}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4" />
                      {order.address.phone}
                    </div>
                    <div className="flex items-start gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      <span>
                        {order.address.line1}, {order.address.line2}<br />
                        {order.address.city} - {order.address.pincode}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="font-medium mb-2 text-sm">Update Status</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => updateStatus(order.id, 'packed')}
                        className="px-3 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600 text-sm"
                      >
                        Packed
                      </button>

                      <button
                        onClick={() => updateStatus(order.id, 'out_for_delivery')}
                        className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                      >
                        Out for Delivery
                      </button>

                      <button
                        onClick={() => updateStatus(order.id, 'delivered')}
                        className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 text-sm"
                      >
                        Delivered
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t pt-3">
                  <div className="font-medium text-sm mb-2">Items</div>
                  <div className="space-y-1 text-sm text-gray-700">
                    {order.items.map(item => (
                      <div key={item.product_id} className="flex justify-between">
                        <span>{item.name} × {item.qty}</span>
                        <span>₹{item.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentDashboard