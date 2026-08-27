import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { formatQuantity, isKgUnit, quantityStep, useCart } from '../context/CartContext';
import { Minus, Plus, ShoppingCart, Zap, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { inr } from '../lib/utils';
import { Button } from '../components/ui/button';

const ProductDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  
  // Track the currently selected variant object (null if product has no variants)
  const [selectedVariant, setSelectedVariant] = useState(null);
  
  const { items, add, update } = useCart();

  useEffect(() => { 
    api.get(`/products/${id}`).then((r) => {
      setP(r.data);
      // Automatically default to the first variant if available
      if (r.data.variants && r.data.variants.length > 0) {
        setSelectedVariant(r.data.variants[0]);
      }
    }); 
  }, [id]);

  if (!p) return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>;

  // Compute active product details based on variant or base fallback parameters
  const currentUnit = selectedVariant ? selectedVariant.unit : p.unit;
  const currentPrice = selectedVariant ? selectedVariant.price : p.price;
  const currentMrp = selectedVariant ? selectedVariant.mrp : p.mrp;
  const step = quantityStep({ unit: currentUnit });
  const shownPrice = currentPrice * step;
  const shownMrp = currentMrp * step;
  
  // Unique identification string key for the cart items (matches base or variant combination)
  const cartItemKey = selectedVariant ? `${p.id}-${selectedVariant.unit}` : p.id;
  const inCart = items.find((i) => i.cartItemId === cartItemKey || i.product.id === cartItemKey);

  const discount = Math.round(((currentMrp - currentPrice) / currentMrp) * 100);

  // Helper routine to format standard structure item payload safely over to the context state
  const handleAddToCart = () => {
    const customProductPayload = {
      ...p,
      // Map custom unique identification details to keep items cleanly separated
      id: cartItemKey, 
      baseProductId: p.id,
      unit: currentUnit,
      price: currentPrice,
      mrp: currentMrp,
      isVariant: !!selectedVariant
    };
    add(customProductPayload);
  };

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
          <div className="text-sm text-gray-500 mt-1">{isKgUnit(currentUnit) ? '0.25 kg (price per kg divided by 4)' : currentUnit}</div>

          <div className="flex items-baseline gap-3 mt-4">
            <div className="text-3xl font-black text-gray-900">{inr(shownPrice)}</div>
            {currentMrp > currentPrice && <div className="text-lg text-gray-400 line-through">{inr(shownMrp)}</div>}
            {discount > 0 && <div className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-1 rounded">{discount}% OFF</div>}
          </div>
          <div className="text-xs text-gray-500 mt-1">Inclusive of all taxes</div>

          {/* Dynamic Interactive Variants Selector Buttons */}
          {p.variants && p.variants.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Select Variant Option:</h3>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v, i) => {
                  const isSelected = selectedVariant?.unit === v.unit;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`px-4 py-2 text-sm rounded-md font-medium border transition-all ${
                        isSelected
                          ? 'border-[#6b3410] bg-[#6b3410]/5 text-[#6b3410] ring-1 ring-[#6b3410]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold">{v.unit}</div>
                      <div className="text-xs opacity-80">{inr(v.price)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-b border-gray-200 py-4">
            <h3 className="font-semibold text-sm mb-2">Product Description</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
          </div>

          <div className="flex gap-3 mt-6">
            {inCart ? (
              <div className="flex items-center gap-3 border-2 border-[#6b3410] rounded-md">
                <button onClick={() => update(cartItemKey, inCart.qty - step)} className="px-3 py-2"><Minus className="w-4 h-4" /></button>
                <span className="font-semibold min-w-[48px] text-center">{formatQuantity(inCart.qty, currentUnit)}</span>
                <button onClick={() => update(cartItemKey, inCart.qty + step)} className="px-3 py-2"><Plus className="w-4 h-4" /></button>
              </div>
            ) : (
              <Button onClick={handleAddToCart} className="bg-[#6b3410] hover:bg-[#4d260b] gap-2"><ShoppingCart className="w-4 h-4" /> Add to Cart</Button>
            )}
            <Button 
              onClick={() => { 
                if (!inCart) handleAddToCart(); 
                nav('/cart'); 
              }} 
              className="bg-[#f7941d] hover:bg-[#e58500] gap-2"
            >
              <Zap className="w-4 h-4" /> Buy Now
            </Button>
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
