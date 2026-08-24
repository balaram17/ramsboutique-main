import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, MapPin, User, LogOut, Package, ChevronDown, Menu, X, PiggyBank } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLocationCtx } from '../context/LocationContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useStoreStatus } from '../hooks/use-store-status';
import LocationModal from './LocationModal';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/dropdown-menu';

const Navbar = () => {
  const [q, setQ] = useState('');
  const [locOpen, setLocOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { location } = useLocationCtx();
  const { content } = useSiteContent();
  const storeStatus = useStoreStatus();
  const nav = useNavigate();

  useEffect(() => {
    if (!location) setLocOpen(true);
  }, [location]);

  const submitSearch = (e) => {
    e.preventDefault();
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      {/* Top strip */}
      <div className="bg-[#6b3410] text-white text-xs py-1.5 text-center px-4">
        {content.top_strip}
      </div>

      {/* Store closed banner */}
      {storeStatus.loaded && !storeStatus.open && (
        <div className="bg-red-600 text-white text-xs py-2 text-center px-4 font-medium">
          🔴 {storeStatus.message || 'Store is currently closed. Orders can be placed during our open hours.'}
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/rb-logo.png" alt="Rams Boutique" className="h-11 w-11 object-contain rounded-full bg-white" />
            <div className="hidden sm:block leading-tight">
              <div className="font-serif font-bold text-[#6b3410] text-lg tracking-wide">Rams Boutique</div>
              <div className="text-[10px] text-[#c9a24c] font-semibold uppercase tracking-widest">Vizag</div>
            </div>
          </Link>

          {/* Location */}
          <button onClick={() => setLocOpen(true)} className="hidden md:flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 hover:border-[#6b3410] transition min-w-[190px]">
            <MapPin className="w-4 h-4 text-[#6b3410]" />
            <div className="text-left">
              <div className="text-[10px] text-gray-500 leading-tight">Deliver to</div>
              <div className="text-xs font-semibold text-gray-800 leading-tight truncate max-w-[130px]">
                {location?.deliverable ? `Vizag (${location.distance_km} km)` : location ? 'Out of range' : 'Set location'}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Search */}
          <form onSubmit={submitSearch} className="flex-1 hidden md:flex">
            <div className="flex w-full items-center border-2 border-[#6b3410] rounded-md overflow-hidden bg-white">
              <input value={q} onChange={(e) => setQ(e.target.value)} type="text" placeholder="Search for products, brands and more..." className="flex-1 px-4 py-2.5 outline-none text-sm" />
              <button type="submit" className="bg-[#6b3410] px-5 py-2.5 text-white hover:bg-[#4d260b] transition">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </form>

          {/* User + Cart */}
          <div className="flex items-center gap-2 ml-auto">
            <Link to="/schemes" className="hidden lg:flex items-center gap-1.5 bg-[#fff4df] hover:bg-[#ffe7bd] text-[#8a470d] border border-[#f4c477] px-3 py-2 rounded-md font-semibold text-sm transition">
              <PiggyBank className="w-4 h-4" /> Grocery Chit
            </Link>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 hidden md:flex">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">{(user.name || 'Customer').split(' ')[0]}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-xs text-gray-500">{user.email}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => nav('/orders')}>
                    <Package className="w-4 h-4 mr-2" /> My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/profile')}>
                    <User className="w-4 h-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/my-chit')}>
                    <PiggyBank className="w-4 h-4 mr-2" /> My Grocery Chit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { logout(); nav('/'); }}>
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" className="hidden md:flex text-sm font-semibold" onClick={() => nav('/login')}>
                <User className="w-4 h-4 mr-1" /> Login
              </Button>
            )}
            <Link to="/cart" className="relative flex items-center gap-2 bg-[#f7941d] hover:bg-[#e58500] text-white px-4 py-2 rounded-md font-semibold text-sm transition">
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-white">{count}</span>
              )}
            </Link>
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={submitSearch} className="md:hidden px-4 pb-3">
          <div className="flex w-full items-center border-2 border-[#6b3410] rounded-md overflow-hidden">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className="flex-1 px-3 py-2 outline-none text-sm" />
            <button type="submit" className="bg-[#6b3410] px-4 py-2 text-white"><Search className="w-4 h-4" /></button>
          </div>
        </form>

        {mobileMenu && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-2">
            <Link to="/schemes" onClick={() => setMobileMenu(false)} className="flex items-center gap-2 w-full py-2 text-sm font-semibold text-[#8a470d]">
              <PiggyBank className="w-4 h-4" /> Grocery Chit Saving Scheme
            </Link>
            <button onClick={() => { setLocOpen(true); setMobileMenu(false); }} className="flex items-center gap-2 w-full text-left py-2 text-sm">
              <MapPin className="w-4 h-4 text-[#6b3410]" />
              {location?.deliverable ? `Vizag (${location.distance_km} km)` : 'Set delivery location'}
            </button>
            {user ? (
              <>
                <Link to="/orders" className="block py-2 text-sm">My Orders</Link>
                <Link to="/profile" className="block py-2 text-sm">Profile</Link>
                <Link to="/my-chit" onClick={() => setMobileMenu(false)} className="block py-2 text-sm">My Grocery Chit</Link>
                <button onClick={() => { logout(); nav('/'); }} className="block py-2 text-sm text-red-600">Logout</button>
              </>
            ) : (
              <Link to="/login" className="block py-2 text-sm font-semibold text-[#6b3410]">Login / Sign up</Link>
            )}
          </div>
        )}
      </header>

      <LocationModal open={locOpen} onClose={() => setLocOpen(false)} />
    </>
  );
};

export default Navbar;
