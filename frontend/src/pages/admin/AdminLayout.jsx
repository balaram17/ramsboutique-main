import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Package, ShoppingBag, Users, Truck, LogOut, FileText, Tag, Ticket, PiggyBank, Bell, X, Store } from 'lucide-react';
import api from '../../lib/api';

const AdminLayout = () => {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const loadNotifications = useCallback(() => {
    api.get('/admin/notifications').then(({ data }) => setNotifications(data)).catch(() => {});
  }, []);
  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    window.addEventListener('admin-notifications-updated', loadNotifications);
    return () => {
      clearInterval(timer);
      window.removeEventListener('admin-notifications-updated', loadNotifications);
    };
  }, [loadNotifications]);
  const openNotifications = async () => {
    setShowNotifications((value) => !value);
    if (notifications.some((item) => !item.read)) {
      await api.post('/admin/notifications/read-all').catch(() => {});
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    }
  };
  if (loading) return <div className="p-10 text-center text-gray-500">Loading...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/admin/login" replace />;

  const items = [
    { to: '/admin', end: true, icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
    { to: '/admin/products', icon: Package, label: 'Products' },
    { to: '/admin/categories', icon: Tag, label: 'Categories' },
    { to: '/admin/dmart', icon: Store, label: 'DMart Catalogue' },
    { to: '/admin/coupons', icon: Ticket, label: 'Coupons' },
    { to: '/admin/chits', icon: PiggyBank, label: 'Grocery Chits' },
    { to: '/admin/agents', icon: Truck, label: 'Delivery Agents' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/content', icon: FileText, label: 'Site Content' },
  ];

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-60 bg-[#2b1608] text-white flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/rb-logo.png" alt="Rams Boutique" className="w-10 h-10 object-contain rounded-full bg-white" />
            <div>
              <div className="font-bold font-serif">Rams Boutique</div>
              <div className="text-[10px] text-gray-400">Vizag Admin</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-white/5 transition ${isActive ? 'bg-white/10 border-l-4 border-[#f7941d] font-semibold' : 'border-l-4 border-transparent'}`}>
              <it.icon className="w-4 h-4" />{it.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => { logout(); nav('/admin/login'); }} className="p-5 border-t border-white/10 text-left text-sm flex items-center gap-3 hover:bg-white/5">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </aside>
      <main className="flex-1 overflow-x-hidden relative">
        <div className="h-14 bg-white border-b flex items-center justify-end px-6 sticky top-0 z-30">
          <button onClick={openNotifications} className="relative p-2 rounded-full hover:bg-gray-100" title="Admin notifications">
            <Bell className="w-5 h-5 text-gray-700" />
            {notifications.some((item) => !item.read) && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />}
          </button>
        </div>
        {showNotifications && (
          <div className="fixed right-6 top-16 z-50 w-[min(420px,calc(100vw-3rem))] max-h-[70vh] overflow-y-auto bg-white border rounded-xl shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <div className="font-bold">Admin Notifications</div>
              <button onClick={() => setShowNotifications(false)}><X className="w-4 h-4" /></button>
            </div>
            {!notifications.length && <div className="p-6 text-sm text-gray-500 text-center">No notifications</div>}
            {notifications.map((item) => (
              <div key={item.id} className={`p-4 border-b last:border-0 ${item.level === 'error' ? 'bg-red-50/60' : 'bg-white'}`}>
                <div className="font-semibold text-sm text-gray-900">{item.title}</div>
                <div className="text-xs text-gray-600 mt-1">{item.message}</div>
                {!!item.details?.length && (
                  <details className="mt-2 text-xs text-red-700">
                    <summary className="cursor-pointer font-medium">View error details</summary>
                    <ul className="list-disc pl-5 mt-1 space-y-1">{item.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
                  </details>
                )}
                <div className="text-[10px] text-gray-400 mt-2">{new Date(item.created_at).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        )}
        <div className="px-6 py-6"><Outlet /></div>
      </main>
    </div>
  );
};

export default AdminLayout;
