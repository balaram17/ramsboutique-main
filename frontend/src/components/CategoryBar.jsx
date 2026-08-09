import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Wheat, Milk, Apple, Coffee, Cookie, Sparkles, SprayCan, Baby, Utensils, Shirt } from 'lucide-react';

const ICONS = { wheat: Wheat, milk: Milk, apple: Apple, coffee: Coffee, cookie: Cookie, sparkles: Sparkles, 'spray-can': SprayCan, baby: Baby, utensils: Utensils, shirt: Shirt };

const CategoryBar = () => {
  const [cats, setCats] = useState([]);
  useEffect(() => { api.get('/categories').then((r) => setCats(r.data)); }, []);
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
        <div className="flex gap-1 py-2 min-w-max">
          {cats.map((c) => {
            const Icon = ICONS[c.icon] || Cookie;
            return (
              <Link key={c.slug} to={`/c/${c.slug}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-[#6b3410] hover:bg-amber-50 rounded-md transition font-medium whitespace-nowrap">
                <Icon className="w-4 h-4" />
                {c.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategoryBar;
