import React from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Package, ShoppingBag, Users, Truck, LogOut, Store, FileText, Tag, Ticket } from 'lucide-react';

const AdminLayout = () => {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  if (loading) return <div className="p-10 text-center text-gray-500">Loading...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/admin/login" replace />;

  const items = [
    { to: '/admin', end: true, icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
    { to: '/admin/products', icon: Package, label: 'Products' },
    { to: '/admin/categories', icon: Tag, label: 'Categories' },
    { to: '/admin/coupons', icon: Ticket, label: 'Coupons' },
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
      <main className="flex-1 overflow-x-hidden">
        <div className="px-6 py-6"><Outlet /></div>
      </main>
    </div>
  );
};

export default AdminLayout;
