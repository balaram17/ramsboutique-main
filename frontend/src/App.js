import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import { SiteContentProvider } from './context/SiteContentContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CategoryBar from './components/CategoryBar';
import PWAInstallPrompt from './components/PWAInstallPrompt';

import Home from './pages/Home';
import Category from './pages/Category';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Orders from './pages/Orders';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AgentDashboard from './pages/AgentDashboard';
import Invoice from './pages/Invoice';

import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminProducts from './pages/admin/AdminProducts';
import AdminAgents from './pages/admin/AdminAgents';
import AdminUsers from './pages/admin/AdminUsers';
import AdminContent from './pages/admin/AdminContent';
import AdminCategories from './pages/admin/AdminCategories';
import AdminDmart from './pages/admin/AdminDmart';
import AdminCoupons from './pages/admin/AdminCoupons';

import Terms from "./pages/Terms";
import ReturnsRefunds from "./pages/ReturnsRefunds";
import ContactUs from "./pages/ContactUs";
import TrackOrder from "./pages/TrackOrder";
import FAQ from "./pages/FAQ";
import Schemes from './pages/Schemes';
import SchemeJoin from './pages/SchemeJoin';
import MyChit from './pages/MyChit';
import AdminChits from './pages/admin/AdminChits';

const Shell = ({ children }) => {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');
  const isAgent = loc.pathname.startsWith('/agent');

  // Admin Pages - no customer layout
  if (isAdmin) return <>{children}</>;

  // Agent Pages - standalone layout
  if (isAgent) {
    return (
      <div className="min-h-screen bg-gray-100">
        {children}
      </div>
    );
  }

  // Customer Pages
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      <CategoryBar />
      <main className="flex-1">{children}</main>
      <Footer />
      <PWAInstallPrompt />
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <LocationProvider>
            <SiteContentProvider>
              <CartProvider>
                <Shell>
                  <Routes>
                    {/* Customer Core Storefront Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/c/:slug" element={<Category />} />
                    <Route path="/search" element={<Category mode="search" />} />
                    <Route path="/p/:id" element={<ProductDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/order-success/:id" element={<OrderSuccess />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/profile" element={<Profile />} />
                    
                    {/* Customer Informational Routes (Moved out of admin context) */}
                    <Route path="/terms" element={<Terms />} /> 
                    <Route path="/returns-refunds" element={<ReturnsRefunds />} />
                    <Route path="/contact" element={<ContactUs />} />
                    <Route path="/track-order" element={<TrackOrder />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/schemes" element={<Schemes />} />
                    <Route path="/schemes/join/:duration" element={<SchemeJoin />} />
                    <Route path="/my-chit" element={<MyChit />} />

                    {/* Agent Routings */}
                    <Route path="/agent/dashboard" element={<AgentDashboard />} />
                    <Route path="/orders/:id/invoice" element={<Invoice />} />

                    {/* Admin Routings */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="agents" element={<AdminAgents />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="dmart" element={<AdminDmart />} />
                      <Route path="coupons" element={<AdminCoupons />} />
                      <Route path="content" element={<AdminContent />} />
                      <Route path="chits" element={<AdminChits />} />
                    </Route>

                    {/* Global Wildcard Fallback: Redirects broken paths back to homepage */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Shell>
                <Toaster />
              </CartProvider>
            </SiteContentProvider>
          </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
