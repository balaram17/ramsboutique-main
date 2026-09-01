import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSiteContent } from '../context/SiteContentContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast';
import { Loader2, Mail, ShieldCheck, Truck, User } from 'lucide-react';
import api from '../lib/api';
import { completeStaffMicrosoftRedirect, entraConfigured, signInCustomerWithMicrosoft, signInStaffWithMicrosoft } from '../lib/entraAuth';

const Login = () => {
  const { login, signup, verifyOtp, entraCustomerLogin, entraStaffLogin } = useAuth();
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

  const doEntraCustomerLogin = async () => {
    setBusy(true);
    try {
      const identityToken = await signInCustomerWithMicrosoft();
      const result = await entraCustomerLogin(identityToken);
      toast({ title: 'Email verified', description: 'Signed in securely with Microsoft.' });
      nav(result.profile_incomplete ? '/profile' : nextTo);
    } catch (e) {
      toast({ title: 'Microsoft sign-in failed', description: e.response?.data?.detail || e.message || 'Try again', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const doEntraStaffLogin = async () => {
    setBusy(true);
    try {
      await signInStaffWithMicrosoft();
    } catch (e) {
      toast({ title: 'Staff access denied', description: e.response?.data?.detail || e.message || 'Your account is not assigned a staff role.', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  React.useEffect(() => {
    let cancelled = false;
    const finishStaffLogin = async () => {
      try {
        const identityToken = await completeStaffMicrosoftRedirect();
        if (!identityToken || cancelled) return;
        setBusy(true);
        const result = await entraStaffLogin(identityToken);
        if (!cancelled) nav(result.role === 'admin' ? '/admin' : '/agent/dashboard', { replace: true });
      } catch (e) {
        if (!cancelled) {
          toast({ title: 'Staff access denied', description: e.response?.data?.detail || e.message || 'Your account is not assigned a staff role.', variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    finishStaffLogin();
    return () => { cancelled = true; };
  }, [entraStaffLogin, nav, toast]);

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

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg border shadow-sm p-6">
        <div className="text-center mb-5">
          <div className="inline-flex flex-col items-center mb-3">
            <img src="/rb-logo.png" alt="BTA FreshMart" className="h-28 w-auto max-w-[280px] object-contain" />
          </div>
          <h1 className="text-xl font-bold">{l.welcome}</h1>
          <p className="text-sm text-gray-500">{l.subheading}</p>
        </div>

        <Button type="button" onClick={doEntraCustomerLogin} disabled={busy || !entraConfigured.customer} variant="outline" className="w-full mb-3 border-[#6b3410] text-[#6b3410]">
          <Mail className="w-4 h-4 mr-2" /> Continue with Email OTP
        </Button>
        {!entraConfigured.customer && <p className="text-xs text-amber-700 text-center mb-3">Email OTP will be available after Azure configuration.</p>}

        <div className="relative mb-3"><div className="border-t" /><span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-gray-400">or use an existing method</span></div>

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
            <div className="space-y-4 mt-3">
              <Button type="button" onClick={doEntraStaffLogin} disabled={busy || !entraConfigured.staff} variant="outline" className="w-full">
                <ShieldCheck className="w-4 h-4 mr-2" /> Agent Login with Microsoft
              </Button>
              <div className="text-xs text-gray-500 text-center rounded-md bg-gray-50 p-3">
                First login: use the Microsoft username and temporary password provided by the Admin. Microsoft will ask you to change the password and register Authenticator.
              </div>
            </div>
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
