import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';
import { formatQuantity, isKgUnit, quantityStep, useCart } from '../context/CartContext';
import { inr } from '../lib/utils';

const ProductCard = ({ product }) => {
  const { items, add, update } = useCart();
  const variants = useMemo(() => product.variants || [], [product.variants]);
  const [selected, setSelected] = useState(() => variants.find((v) => v.default) || variants[0] || null);

  useEffect(() => {
    setSelected(variants.find((v) => v.default) || variants[0] || null);
  }, [product.id, variants]);

  const currentUnit = selected?.unit || product.unit;
  const currentPrice = selected?.price ?? product.price;
  const currentMrp = selected?.mrp ?? product.mrp;
  const currentImage = selected?.image || product.image;
  const cartItemKey = selected ? `${product.id}-${selected.unit}` : product.id;
  const inCart = items.find((i) => i.product.id === cartItemKey);
  const discount = Math.round(((currentMrp - currentPrice) / currentMrp) * 100);
  const step = quantityStep({ unit: currentUnit });
  const shownPrice = currentPrice * step;
  const shownMrp = currentMrp * step;
  const shownUnit = isKgUnit(currentUnit) ? '0.25 kg' : currentUnit;

  const handleAdd = () => {
    add({
      ...product,
      id: cartItemKey,
      baseProductId: product.id,
      unit: currentUnit,
      price: currentPrice,
      mrp: currentMrp,
      image: currentImage,
      isVariant: !!selected,
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition group flex flex-col">
      <Link to={`/p/${product.id}`} className="relative aspect-square bg-gray-50 overflow-hidden">
        <img src={currentImage} alt={product.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-[#f7941d] text-white text-[10px] font-bold px-2 py-0.5 rounded">{discount}% OFF</span>
        )}
        {variants.length > 1 && (
          <span className="absolute bottom-2 left-2 bg-white/90 text-[#6b3410] text-[10px] font-bold px-2 py-0.5 rounded border border-[#6b3410]/20">
            {variants.length} sizes
          </span>
        )}
      </Link>
      <div className="p-3 flex flex-col flex-1">
        <Link to={`/p/${product.id}`}>
          <div className="text-[11px] text-gray-500 uppercase tracking-wide">{product.brand}</div>
          <div className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px] group-hover:text-[#6b3410]">{product.name}</div>
        </Link>
        {variants.length > 1 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {variants.map((variant) => {
              const isSelected = selected?.unit === variant.unit;
              return (
                <button
                  key={variant.sku_id || variant.unit}
                  type="button"
                  onClick={() => setSelected(variant)}
                  className={`px-2 py-0.5 text-[11px] rounded border font-medium ${
                    isSelected
                      ? 'border-[#6b3410] bg-[#6b3410]/10 text-[#6b3410]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {variant.unit}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-gray-500 mt-1">{shownUnit}</div>
        )}
        <div className="mt-auto pt-2 flex items-end justify-between">
          <div>
            <div className="text-base font-bold text-gray-900">{inr(shownPrice)}</div>
            {currentMrp > currentPrice && (
              <div className="text-xs text-gray-400 line-through leading-tight">{inr(shownMrp)}</div>
            )}
          </div>
          {inCart ? (
            <div className="flex items-center gap-2 bg-[#6b3410] text-white rounded-md">
              <button onClick={() => update(cartItemKey, inCart.qty - step)} className="px-2 py-1.5"><Minus className="w-3.5 h-3.5" /></button>
              <span className="text-sm font-semibold min-w-[42px] text-center">{formatQuantity(inCart.qty, currentUnit)}</span>
              <button onClick={() => update(cartItemKey, inCart.qty + step)} className="px-2 py-1.5"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={handleAdd} className="flex items-center gap-1 border-2 border-[#6b3410] text-[#6b3410] hover:bg-[#6b3410] hover:text-white px-3 py-1.5 rounded-md text-xs font-bold transition">
              <Plus className="w-3.5 h-3.5" /> ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
