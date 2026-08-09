import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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

import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminProducts from './pages/admin/AdminProducts';
import AdminAgents from './pages/admin/AdminAgents';
import AdminUsers from './pages/admin/AdminUsers';
import AdminContent from './pages/admin/AdminContent';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCoupons from './pages/admin/AdminCoupons';

const Shell = ({ children }) => {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');
  if (isAdmin) return <>{children}</>;
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

                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="agents" element={<AdminAgents />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="coupons" element={<AdminCoupons />} />
                      <Route path="content" element={<AdminContent />} />
                    </Route>
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
