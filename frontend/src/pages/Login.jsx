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
  
  const [agentPhone, setAgentPhone] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [activeTab, setActiveTab] = useState(sp.get('tab') || 'login');

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

  React.useEffect(() => {
  if (cooldown > 0) {
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }
}, [cooldown]);

  // 1. Direct Backend Endpoint Call: Sends the OTP without reCAPTCHA checks
  const sendOtp = async () => {
    if (otpF.phone.length !== 10) return toast({ title: 'Enter 10-digit phone', variant: 'destructive' });
    
    setBusy(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/send-otp`, {
        phone: otpF.phone
      });

      setOtpF({ ...otpF, sent: true });
      setCooldown(60);
      toast({ title: 'OTP Sent!', description: 'Please check your mobile text messages.' });
    } catch (err) {
      const message = err.response?.data?.detail || 'Something went wrong.';

      // FastAPI returns HTTP 404 when the mobile number is not registered.
      // Check the status first rather than relying only on the exact error text.
      if (
        err.response?.status === 404 ||
        message === 'The Mobile number is not registered. Kindly, Signup'
      ) {
        const phone = otpF.phone;

        // Reset OTP state.
        setOtpF({ phone, otp: '', sent: false });

        // Carry the entered mobile number into the Signup form.
        setSignF((prev) => ({ ...prev, phone }));

        // Switch the controlled Tabs component to Signup.
        setActiveTab('signup');

        toast({
          title: 'Mobile number not registered',
          description: 'The Mobile number is not registered. Kindly, Signup',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Delivery Failed',
          description: message,
          variant: 'destructive'
        });
      }
    } finally {
      setBusy(false);
    }
  };

  // 2. Submits User Token String Directly to Your FastAPI Instance
  const doVerify = async (e) => {
    e.preventDefault();
    if (otpF.otp.length < 4) return toast({ title: 'Enter validation code', variant: 'destructive' });

    setBusy(true);
    try {
      await verifyOtp(otpF.phone, otpF.otp);
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      nav(nextTo);
    } catch (err) {
      toast({
        title: 'Verification Failed',
        description: err.response?.data?.detail || 'Invalid code entered.',
        variant: 'destructive'
      });
    } finally {
      setBusy(false);
    }
  };

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
      const res = await axios.post(`${API_BASE_URL}/api/auth/agent`, {
        phone: agentPhone,
      });
      localStorage.setItem('agentToken', res.data.token);
      localStorage.setItem('agentId', res.data.agent_id);
      localStorage.setItem('agentName', res.data.name);
      toast({
        title: 'Login Successful',
        description: `Welcome back, ${res.data.name}!`,
      });
      nav('/agent/dashboard');
    } catch (err) {
      toast({
        title: 'Access Denied',
        description: err.response?.data?.detail || 'Mobile number not found in Agent collection.',
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
            <TabsTrigger value="otp"><User className="w-3 h-3" />&nbsp;OTP</TabsTrigger>
            <TabsTrigger value="agent"><Truck className="w-3 h-3" />&nbsp;Agent</TabsTrigger>
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
              <div>
                <Label>Phone Number</Label>
                <Input required disabled={busy || otpF.sent} value={otpF.phone} maxLength={10} placeholder="Enter 10-digit mobile number" onChange={(e) => setOtpF({ ...otpF, phone: e.target.value.replace(/\D/g, '') })} />
              </div>

              {!otpF.sent ? (
                <Button type="button" onClick={sendOtp} disabled={busy} className="w-full bg-[#6b3410] hover:bg-[#4d260b]">
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send OTP Code
                </Button>
              ) : (
                <>
                  <div>
                    <Label>Enter Secure 4-Digit OTP</Label>
                    {/* Ensure maxLength matches your backend string generation */}
                    <Input required disabled={busy} maxLength={4} placeholder="Enter 4-digit code" value={otpF.otp} onChange={(e) => setOtpF({ ...otpF, otp: e.target.value.replace(/\D/g, '') })} />
                  </div>

                  <Button type="submit" disabled={busy} className="w-full bg-[#f7941d] hover:bg-[#e58500]">
                    {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirm & Sign In
                  </Button>

                  <div className="text-center mt-2">
                    {cooldown > 0 ? (
                      <p className="text-xs text-gray-400">Resend code available in: <span className="font-bold">{cooldown}s</span></p>
                    ) : (
                      <button type="button" onClick={sendOtp} disabled={busy} className="text-xs text-[#6b3410] hover:underline font-medium">Resend OTP</button>
                    )}
                  </div>

                  <button type="button" onClick={() => setOtpF({ ...otpF, sent: false, otp: '' })} className="text-xs text-gray-400 block mx-auto underline mt-2">Change Phone Number</button>
                </>
              )}
            </form>
          </TabsContent>

          <TabsContent value="agent">
            <form onSubmit={doAgentLogin} className="space-y-4 mt-3">
              <div>
                <Label>Registered Phone Number</Label>
                <div className="relative flex rounded-md mt-1">
                  <Input required disabled={busy} placeholder="Enter 10-digit number" value={agentPhone} maxLength={10} 
                    onChange={(e) => setAgentPhone(e.target.value.replace(/\D/g, ''))} 
                  />
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-[#6b3410] hover:bg-[#4d260b]">
                {busy && <Loader2 className="w-full bg-[#6b3410] hover:bg-[#4d260b]" />} Verify & Sign In
              </Button>
              <div className="text-xs text-gray-400 text-center mt-1">The portal will instantly cross-reference our delivery worker network and log you in.
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