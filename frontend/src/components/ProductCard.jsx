import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { inr } from '../lib/utils';

const ProductCard = ({ product }) => {
  const { items, add, update } = useCart();
  const inCart = items.find((i) => i.product.id === product.id);
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition group flex flex-col">
      <Link to={`/p/${product.id}`} className="relative aspect-square bg-gray-50 overflow-hidden">
        <img src={product.image} alt={product.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-[#f7941d] text-white text-[10px] font-bold px-2 py-0.5 rounded">{discount}% OFF</span>
        )}
      </Link>
      <div className="p-3 flex flex-col flex-1">
        <Link to={`/p/${product.id}`}>
          <div className="text-[11px] text-gray-500 uppercase tracking-wide">{product.brand}</div>
          <div className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px] group-hover:text-[#6b3410]">{product.name}</div>
          <div className="text-xs text-gray-500 mt-1">{product.unit}</div>
        </Link>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-base font-bold text-gray-900">{inr(product.price)}</div>
            {product.mrp > product.price && (
              <div className="text-xs text-gray-400 line-through leading-tight">{inr(product.mrp)}</div>
            )}
          </div>
          {inCart ? (
            <div className="flex items-center gap-2 bg-[#6b3410] text-white rounded-md">
              <button onClick={() => update(product.id, inCart.qty - 1)} className="px-2 py-1.5"><Minus className="w-3.5 h-3.5" /></button>
              <span className="text-sm font-semibold min-w-[16px] text-center">{inCart.qty}</span>
              <button onClick={() => update(product.id, inCart.qty + 1)} className="px-2 py-1.5"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => add(product)} className="flex items-center gap-1 border-2 border-[#6b3410] text-[#6b3410] hover:bg-[#6b3410] hover:text-white px-3 py-1.5 rounded-md text-xs font-bold transition">
              <Plus className="w-3.5 h-3.5" /> ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
