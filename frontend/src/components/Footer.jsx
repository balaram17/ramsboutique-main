import React from 'react';
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';
import { Link } from 'react-router-dom';

const socialIcon = (Icon, href) => {
  if (!href) return null;

  return (
    <a
      key={href}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Social media"
    >
      <Icon className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
    </a>
  );
};

const Footer = () => {
  const { content } = useSiteContent();
  const f = content.footer;

  return (
    <footer className="bg-[#2b1608] text-gray-300 mt-16">

      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">

        {/* BRAND */}
        <div className="col-span-2 md:col-span-1">

          <div className="flex items-center gap-3 mb-4">
            <img
              src="/rb-logo.png"
              alt="Rams Boutique"
              className="h-14 w-14 object-contain rounded-full bg-white p-0.5"
            />

            <div className="leading-tight">
              <div className="font-serif font-bold text-white text-lg">
                Rams Boutique
              </div>

              <div className="text-[10px] text-[#c9a24c] font-semibold uppercase tracking-widest">
                {f.tagline}
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-400 leading-relaxed">
            {f.description}
          </p>

          <div className="flex gap-3 mt-4">
            {socialIcon(Facebook, f.facebook)}
            {socialIcon(Instagram, f.instagram)}
            {socialIcon(Twitter, f.twitter)}
            {socialIcon(Youtube, f.youtube)}
          </div>

        </div>

        {/* SHOP BY CATEGORY */}
        <div>
          <h4 className="text-white font-semibold mb-3 text-sm">
            Shop by Category
          </h4>

          <ul className="space-y-2 text-sm">

            <li>
              <Link
                to="/c/grocery"
                className="hover:text-white transition-colors"
              >
                Grocery &amp; Staples
              </Link>
            </li>

            <li>
              <Link
                to="/c/dairy-bakery"
                className="hover:text-white transition-colors"
              >
                Dairy &amp; Bakery
              </Link>
            </li>

            <li>
              <Link
                to="/c/fruits-vegetables"
                className="hover:text-white transition-colors"
              >
                Fruits &amp; Vegetables
              </Link>
            </li>

            <li>
              <Link
                to="/c/beverages"
                className="hover:text-white transition-colors"
              >
                Beverages
              </Link>
            </li>

            <li>
              <Link
                to="/c/personal-care"
                className="hover:text-white transition-colors"
              >
                Personal Care
              </Link>
            </li>

          </ul>
        </div>

        {/* CUSTOMER SERVICE */}
        <div>
          <h4 className="text-white font-semibold mb-3 text-sm">
            Customer Service
          </h4>

          <ul className="space-y-2 text-sm">

            <li>
              <Link
                to="/contact"
                className="hover:text-white transition-colors"
              >
                Contact Us
              </Link>
            </li>

            <li>
              <Link
                to="/track-order"
                className="hover:text-white transition-colors"
              >
                Track Order
              </Link>
            </li>

            <li>
              <Link
                to="/returns-refunds"
                className="hover:text-white transition-colors"
              >
                Returns &amp; Refunds
              </Link>
            </li>

            <li>
              <Link
                to="/faq"
                className="hover:text-white transition-colors"
              >
                FAQ
              </Link>
            </li>

            <li>
              <Link
                to="/terms"
                className="hover:text-white transition-colors"
              >
                Terms &amp; Conditions
              </Link>
            </li>

          </ul>
        </div>

        {/* REACH US */}
        <div>
          <h4 className="text-white font-semibold mb-3 text-sm">
            Reach Us
          </h4>

          <ul className="space-y-2 text-sm">

            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{f.address}</span>
            </li>

            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <a
                href={`tel:${f.phone}`}
                className="hover:text-white transition-colors"
              >
                {f.phone}
              </a>
            </li>

            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <a
                href={`mailto:${f.email}`}
                className="hover:text-white transition-colors"
              >
                {f.email}
              </a>
            </li>

          </ul>
        </div>

      </div>

      {/* COPYRIGHT */}
      <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
        {f.copyright}
      </div>

    </footer>
  );
};

export default Footer;