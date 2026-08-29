import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import ProductCard from '../components/ProductCard';
import { useSiteContent } from '../context/SiteContentContext';
import { ChevronRight, Truck, ShieldCheck, Percent, Clock } from 'lucide-react';

const Home = () => {
  const [banners, setBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const { content } = useSiteContent();
  const hero = content.hero;

  useEffect(() => {
    api.get('/banners').then((r) => setBanners(r.data));
    api.get('/products?limit=500').then((r) => setProducts(r.data));
    api.get('/categories').then((r) => setCats(r.data));
  }, []);

  const grouped = cats.map((c) => ({ cat: c, list: products.filter((p) => p.category === c.slug).slice(0, 6) })).filter((g) => g.list.length > 0);

  return (
    <div className="bg-gray-50">
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-[#6b3410] to-[#8b4513] text-white">
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 grid md:grid-cols-2 gap-6 items-center">
          <div>
            <div className="inline-block bg-[#c9a24c] text-[#2b1608] text-xs font-bold px-3 py-1 rounded-full mb-3">{hero.pill}</div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-3">{hero.title}</h1>
            <p className="text-base md:text-lg opacity-90 mb-5">{hero.subtitle}</p>
            <div className="flex gap-3 flex-wrap">
              <Link to={hero.cta1_link || '/'} className="bg-[#c9a24c] hover:bg-[#b8912f] text-[#2b1608] px-5 py-3 rounded-md font-semibold text-sm transition">{hero.cta1_text}</Link>
              <Link to={hero.cta2_link || '/'} className="bg-white/10 hover:bg-white/20 border border-white/30 px-5 py-3 rounded-md font-semibold text-sm transition">{hero.cta2_text}</Link>
            </div>
          </div>
          <div className="hidden md:block">
            <img src={hero.image} alt="Fresh groceries" className="w-full h-72 object-cover rounded-xl shadow-2xl" />
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { Icon: Truck, t: 'Free delivery', s: 'On orders ₹499+' },
            { Icon: Clock, t: '60-min delivery', s: 'Within 5 km' },
            { Icon: Percent, t: 'Everyday low prices', s: 'BTA FreshMart guarantee' },
            { Icon: ShieldCheck, t: '100% authentic', s: 'Genuine brands' },
          ].map((f) => (
            <div key={f.t} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <f.Icon className="w-5 h-5 text-[#6b3410]" />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-900">{f.t}</div>
                <div className="text-xs text-gray-500">{f.s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories tiles */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Shop by Category</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {cats.map((c) => (
            <Link key={c.slug} to={`/c/${c.slug}`} className="bg-white rounded-lg p-3 text-center hover:shadow-md transition border border-gray-100 group">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 group-hover:bg-[#6b3410] group-hover:text-white transition flex items-center justify-center text-[#6b3410] font-bold text-lg">
                {c.name[0]}
              </div>
              <div className="text-xs font-medium text-gray-700 mt-2 leading-tight">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Product rows per category */}
      {grouped.map(({ cat, list }) => (
        <section key={cat.slug} className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{cat.name}</h2>
            <Link to={`/c/${cat.slug}`} className="text-sm font-semibold text-[#6b3410] flex items-center gap-1 hover:underline">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {list.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      ))}
    </div>
  );
};

export default Home;
