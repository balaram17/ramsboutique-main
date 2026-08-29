import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/use-toast';
import { ShieldCheck, Loader2 } from 'lucide-react';

const AdminLogin = () => {
  const { adminLogin } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: '', password: '' });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await adminLogin(f.email, f.password); nav('/admin'); }
    catch (e) { toast({ title: 'Admin login failed', description: e.response?.data?.detail || 'Invalid credentials', variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2b1608] to-[#6b3410] px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-8">
        <div className="text-center mb-6">
          <img src="/rb-logo.png" alt="BTA FreshMart" className="h-32 w-auto max-w-[300px] mx-auto object-contain" />
          <h1 className="text-2xl font-bold mt-2 font-serif text-[#6b3410]">BTA FreshMart Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Vizag Store Management Portal</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Email</Label><Input type="email" required autoComplete="username" placeholder="Enter Admin Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Password</Label><Input type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <Button type="submit" disabled={busy} className="w-full bg-[#6b3410] hover:bg-[#4d260b]">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Sign in as Admin</Button>
        </form>
        <div className="mt-4 text-xs text-center text-gray-500">
          <Link to="/" className="hover:underline">← Back to shop</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
