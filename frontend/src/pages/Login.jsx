import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSiteContent } from '../context/SiteContentContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast';
import { Loader2, Truck, User } from 'lucide-react';
import api from '../lib/api';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const Login = () => {
  const { login, signup, verifyOtp } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const nextTo = sp.get('next') || '/';
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const { content } = useSiteContent();
  const l = content.login;

  const [loginF, setLoginF] = useState({ email: '', password: '' });
  const [signF, setSignF] = useState({ name: '', email: '', phone: '', password: '' });
  const [otpF, setOtpF] = useState({ phone: '', otp: '', sent: false });
  
  // Isolated state tracking for the delivery agent phone number
  const [agentPhone, setAgentPhone] = useState('');

  const doLogin = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await login(loginF.email, loginF.password); nav(nextTo); }
    catch (e) { toast({ title: 'Login failed', description: e.response?.data?.detail || 'Try again', variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const doSignup = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await signup(signF); nav(nextTo); }
    catch (e) { toast({ title: 'Signup failed', description: e.response?.data?.detail || 'Try again', variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const sendOtp = () => {
    if (otpF.phone.length !== 10) return toast({ title: 'Enter 10-digit phone', variant: 'destructive' });
    setOtpF({ ...otpF, sent: true });
    toast({ title: 'OTP Sent (Demo)', description: 'Use any 4-digit code, e.g. 1234' });
  };
  const doVerify = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await verifyOtp(otpF.phone, otpF.otp); nav(nextTo); }
    catch (e) { toast({ title: 'OTP verification failed', description: e.response?.data?.detail || 'Try again', variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  // =========================================================
  // UPDATED: INSTANT AGENT LOGIN ROUTINE (NO OTP REQUIRED)
  // =========================================================
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const doAgentLogin = async (e) => {
  e.preventDefault();

  if (agentPhone.length !== 10) {
    return toast({
      title: 'Validation Error',
      description: 'Enter a valid 10-digit mobile number.',
      variant: 'destructive',
    });
  }

  setBusy(true);

  try {
    // Call backend API
    const res = await axios.post(`${API_BASE_URL}/api/auth/agent`, {
      phone: agentPhone,
    });

    // Store session data
    localStorage.setItem('agentToken', res.data.token);
    localStorage.setItem('agentId', res.data.agent_id);
    localStorage.setItem('agentName', res.data.name);

    toast({
      title: 'Login Successful',
      description: `Welcome back, ${res.data.name}!`,
    });

    // Redirect to dashboard
    nav('/agent/dashboard');
  } catch (err) {
    toast({
      title: 'Access Denied',
      description:
        err.response?.data?.detail ||
        'Mobile number not found in Agent collection.',
      variant: 'destructive',
    });
  } finally {
    setBusy(false);
  }
};

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg border shadow-sm p-6">
        <div className="text-center mb-5">
          <div className="inline-flex flex-col items-center gap-2 mb-3">
            <img src="/rb-logo.png" alt="Rams Boutique" className="h-16 w-16 object-contain" />
            <div className="font-serif font-bold text-[#6b3410] text-lg">Rams Boutique</div>
          </div>
          <h1 className="text-xl font-bold">{l.welcome}</h1>
          <p className="text-sm text-gray-500">{l.subheading}</p>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
            <TabsTrigger value="otp">OTP</TabsTrigger>
            <TabsTrigger value="agent" className="text-indigo-600 font-semibold gap-1"><Truck className="w-3 h-3" /> Agent</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={doLogin} className="space-y-3 mt-3">
              <div><Label>Email</Label><Input type="email" required value={loginF.email} onChange={(e) => setLoginF({ ...loginF, email: e.target.value })} /></div>
              <div><Label>Password</Label><Input type="password" required value={loginF.password} onChange={(e) => setLoginF({ ...loginF, password: e.target.value })} /></div>
              <Button type="submit" disabled={busy} className="w-full bg-[#6b3410] hover:bg-[#4d260b]">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Login</Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={doSignup} className="space-y-3 mt-3">
              <div><Label>Name</Label><Input required value={signF.name} onChange={(e) => setSignF({ ...signF, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" required value={signF.email} onChange={(e) => setSignF({ ...signF, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input required value={signF.phone} onChange={(e) => setSignF({ ...signF, phone: e.target.value })} /></div>
              <div><Label>Password</Label><Input type="password" required minLength={6} value={signF.password} onChange={(e) => setSignF({ ...signF, password: e.target.value })} /></div>
              <Button type="submit" disabled={busy} className="w-full bg-[#6b3410] hover:bg-[#4d260b]">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Account</Button>
            </form>
          </TabsContent>

          <TabsContent value="otp">
            <form onSubmit={doVerify} className="space-y-3 mt-3">
              <div><Label>Phone</Label><Input required value={otpF.phone} maxLength={10} onChange={(e) => setOtpF({ ...otpF, phone: e.target.value.replace(/\D/g, '') })} /></div>
              {!otpF.sent ? (
                <Button type="button" onClick={sendOtp} className="w-full bg-[#6b3410] hover:bg-[#4d260b]">Send OTP</Button>
              ) : (
                <>
                  <div><Label>Enter 4-digit OTP</Label><Input required maxLength={4} value={otpF.otp} onChange={(e) => setOtpF({ ...otpF, otp: e.target.value.replace(/\D/g, '') })} /></div>
                  <Button type="submit" disabled={busy} className="w-full bg-[#f7941d] hover:bg-[#e58500]">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Verify & Continue</Button>
                </>
              )}
              <div className="text-xs text-gray-500 flex items-center gap-1 justify-center">🛡️ Demo: any 4-digit code works</div>
            </form>
          </TabsContent>

          {/* =========================================================
              UPDATED: ONE-CLICK AGENT INSTANT DB LOGIN FORM PANEL
              ========================================================= */}
          <TabsContent value="agent">
            <form onSubmit={doAgentLogin} className="space-y-4 mt-3">
              <div>
                <Label>Registered Phone Number</Label>
                <div className="relative flex rounded-md mt-1">
                  <Input 
                    required 
                    disabled={busy}
                    placeholder="Enter 10-digit number" 
                    value={agentPhone} 
                    maxLength={10} 
                    onChange={(e) => setAgentPhone(e.target.value.replace(/\D/g, ''))} 
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={busy} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2"
              >
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Verify & Sign In
              </Button>
              <div className="text-xs text-gray-400 text-center mt-1">
                The portal will instantly cross-reference our delivery worker network and log you in.
              </div>
            </form>
          </TabsContent>
        </Tabs>

        <div className="text-center text-xs text-gray-500 mt-4 space-y-1">
          <div>{l.footer}</div>
          <div><Link to="/admin/login" className="hover:underline">Admin Login</Link></div>
        </div>
      </div>
    </div>
  );
};

export default Login;