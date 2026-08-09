import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { Minus, Plus, ShoppingCart, Zap, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { inr } from '../lib/utils';
import { Button } from '../components/ui/button';

const ProductDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const { items, add, update } = useCart();
  const inCart = items.find((i) => i.product.id === id);

  useEffect(() => { api.get(`/products/${id}`).then((r) => setP(r.data)); }, [id]);

  if (!p) return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>;
  const discount = Math.round(((p.mrp - p.price) / p.mrp) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="text-xs text-gray-500 mb-4">
        <Link to="/" className="hover:underline">Home</Link> / <Link to={`/c/${p.category}`} className="hover:underline capitalize">{p.category.replace('-', ' ')}</Link> / <span className="text-gray-800">{p.name}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
          <img src={p.image} alt={p.name} className="w-full aspect-square object-cover" />
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{p.brand}</div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{p.name}</h1>
          <div className="text-sm text-gray-500 mt-1">{p.unit}</div>

          <div className="flex items-baseline gap-3 mt-4">
            <div className="text-3xl font-black text-gray-900">{inr(p.price)}</div>
            {p.mrp > p.price && <div className="text-lg text-gray-400 line-through">{inr(p.mrp)}</div>}
            {discount > 0 && <div className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-1 rounded">{discount}% OFF</div>}
          </div>
          <div className="text-xs text-gray-500 mt-1">Inclusive of all taxes</div>

          <div className="mt-6 border-t border-b border-gray-200 py-4">
            <h3 className="font-semibold text-sm mb-2">Product Description</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
          </div>

          <div className="flex gap-3 mt-6">
            {inCart ? (
              <div className="flex items-center gap-3 border-2 border-[#6b3410] rounded-md">
                <button onClick={() => update(p.id, inCart.qty - 1)} className="px-3 py-2"><Minus className="w-4 h-4" /></button>
                <span className="font-semibold min-w-[24px] text-center">{inCart.qty}</span>
                <button onClick={() => update(p.id, inCart.qty + 1)} className="px-3 py-2"><Plus className="w-4 h-4" /></button>
              </div>
            ) : (
              <Button onClick={() => add(p)} className="bg-[#6b3410] hover:bg-[#4d260b] gap-2"><ShoppingCart className="w-4 h-4" /> Add to Cart</Button>
            )}
            <Button onClick={() => { if (!inCart) add(p); nav('/cart'); }} className="bg-[#f7941d] hover:bg-[#e58500] gap-2"><Zap className="w-4 h-4" /> Buy Now</Button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
            <div className="flex flex-col items-center text-center gap-1 p-2 bg-gray-50 rounded-md">
              <Truck className="w-5 h-5 text-[#6b3410]" /><span>Fast delivery</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1 p-2 bg-gray-50 rounded-md">
              <ShieldCheck className="w-5 h-5 text-[#6b3410]" /><span>Authentic</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1 p-2 bg-gray-50 rounded-md">
              <RotateCcw className="w-5 h-5 text-[#6b3410]" /><span>Easy returns</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
