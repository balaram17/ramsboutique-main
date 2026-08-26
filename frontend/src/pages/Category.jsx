import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import ProductCard from '../components/ProductCard';

const Category = ({ mode = 'category' }) => {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const q = sp.get('q');
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('featured');

  useEffect(() => {
    setLoading(true);
    const params = mode === 'search' ? { q, limit: 500 } : { category: slug, limit: 500 };
    api.get('/products', { params }).then((r) => setProducts(r.data)).finally(() => setLoading(false));
    if (mode === 'category') api.get('/categories').then((r) => setCat(r.data.find((c) => c.slug === slug)));
  }, [slug, q, mode]);

  const sorted = [...products].sort((a, b) => {
    if (sort === 'price_low') return a.price - b.price;
    if (sort === 'price_high') return b.price - a.price;
    if (sort === 'discount') return (b.mrp - b.price) / b.mrp - (a.mrp - a.price) / a.mrp;
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{mode === 'search' ? `Results for "${q}"` : (cat?.name || 'Category')}</h1>
          <p className="text-sm text-gray-500">{sorted.length} products</p>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
          <option value="featured">Featured</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
          <option value="discount">Discount</option>
        </select>
      </div>
      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading products...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No products found.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sorted.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
};

export default Category;
