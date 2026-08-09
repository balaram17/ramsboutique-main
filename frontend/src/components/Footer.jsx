import React from 'react';
import { Facebook, Instagram, Twitter, Youtube, MapPin, Phone, Mail } from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';

const socialIcon = (Icon, href) => {
  if (!href) return null;
  return (
    <a key={href} href={href} target="_blank" rel="noreferrer">
      <Icon className="w-5 h-5 hover:text-white cursor-pointer" />
    </a>
  );
};

const Footer = () => {
  const { content } = useSiteContent();
  const f = content.footer;
  return (
    <footer className="bg-[#2b1608] text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <img src="/rb-logo.png" alt="Rams Boutique" className="h-14 w-14 object-contain rounded-full bg-white p-0.5" />
            <div className="leading-tight">
              <div className="font-serif font-bold text-white text-lg">Rams Boutique</div>
              <div className="text-[10px] text-[#c9a24c] font-semibold uppercase tracking-widest">{f.tagline}</div>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
          <div className="flex gap-3 mt-4">
            {socialIcon(Facebook, f.facebook)}
            {socialIcon(Instagram, f.instagram)}
            {socialIcon(Twitter, f.twitter)}
            {socialIcon(Youtube, f.youtube)}
          </div>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3 text-sm">Shop by Category</h4>
          <ul className="space-y-2 text-sm">
            <li>Grocery &amp; Staples</li><li>Dairy &amp; Bakery</li><li>Fruits &amp; Vegetables</li><li>Beverages</li><li>Personal Care</li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3 text-sm">Customer Service</h4>
          <ul className="space-y-2 text-sm">
            <li>Contact Us</li><li>Track Order</li><li>Returns &amp; Refunds</li><li>FAQ</li><li>Terms &amp; Conditions</li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3 text-sm">Reach Us</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span>{f.address}</span></li>
            <li className="flex items-center gap-2"><Phone className="w-4 h-4" /><span>{f.phone}</span></li>
            <li className="flex items-center gap-2"><Mail className="w-4 h-4" /><span>{f.email}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
        {f.copyright}
      </div>
    </footer>
  );
};

export default Footer;
