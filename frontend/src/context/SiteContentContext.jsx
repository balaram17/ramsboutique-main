import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api from '../lib/api';

const SiteContentContext = createContext(null);

const DEFAULTS = {
  top_strip: 'Free delivery on orders above ₹499 • Serving Visakhapatnam within 5 km of Dwaraka Nagar',
  hero: {
    pill: 'Rams Boutique Vizag',
    title: 'Everyday Low Prices, delivered to your doorstep',
    subtitle: 'Groceries, staples, dairy, personal care and more – fresh in Visakhapatnam within 60 minutes.',
    cta1_text: 'Shop Groceries', cta1_link: '/c/grocery',
    cta2_text: 'Fresh Produce', cta2_link: '/c/fruits-vegetables',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
  },
  login: {
    welcome: 'Welcome',
    subheading: 'Login or sign up to continue',
    footer: 'By continuing you agree to Rams Boutique Terms of Service and Privacy Policy.',
  },
  footer: {
    description: 'Everyday low prices delivered fresh across Visakhapatnam within 5 km of our Dwaraka Nagar store.',
    tagline: 'Authentic. Aromatic. Indulgent.',
    address: 'Dwaraka Nagar, Visakhapatnam, AP 530016',
    phone: '1800-123-4567',
    email: 'support@ramsboutique.com',
    facebook: '', instagram: '', twitter: '', youtube: '',
    copyright: '© 2025 Rams Boutique. All rights reserved.',
  },
};

export const SiteContentProvider = ({ children }) => {
  const [content, setContent] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/site-content');
      setContent({
        top_strip: data.top_strip || DEFAULTS.top_strip,
        hero: { ...DEFAULTS.hero, ...(data.hero || {}) },
        login: { ...DEFAULTS.login, ...(data.login || {}) },
        footer: { ...DEFAULTS.footer, ...(data.footer || {}) },
      });
    } catch (_) {
      /* keep defaults */
    } finally { setLoaded(true); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ content, loaded, refresh }), [content, loaded, refresh]);
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
};

export const useSiteContent = () => {
  const ctx = useContext(SiteContentContext);
  return ctx || { content: DEFAULTS, loaded: false, refresh: () => {} };
};