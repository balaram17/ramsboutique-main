import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { inr } from '../lib/utils';
import { Loader2, ArrowLeft, Printer, FileText } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const Invoice = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // DEFAULT LOGO PATH: Points onto your local public asset folder directory
  const DEFAULT_LOGO_PATH = '/rb-logo.png';

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await api.get(`/orders/${id}`);
        setOrder(response.data);
      } catch (error) {
        console.error("Invoice Data Fetch Error:", error);
        toast({
          title: "Error loading invoice",
          description: "Could not retrieve transaction metadata.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchOrderDetails();
  }, [id, toast]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-[#6b3410] mx-auto" />
          <p className="text-sm text-gray-500 font-medium">Assembling invoice records...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
        <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h2 className="text-lg font-semibold text-gray-900">Invoice Not Found</h2>
        <p className="text-sm text-gray-500 mt-1">We couldn't locate data records linked with this tracking parameter.</p>
        <Link to="/orders" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:underline mt-4">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to My Orders
        </Link>
      </div>
    );
  }

  // FIXED CALCULATION LOGIC WITH FIXATION VARIABLES
  // Grand total reflects the absolute payment amount stored directly in the database order history payload
  const grandTotal = order.total || 0;
  
  // FIX: Declared strictly as a fallback constant value to avoid scope reference leaks
  const fixedDeliveryCharge = 40;
  
  // Products subtotal calculation boundary 
  const itemsSubtotal = grandTotal - fixedDeliveryCharge;

  // INCLUSIVE TAX FORMULAS: Extracts the 5% tax parameters out of the existing base price framework lines
  // Taxable Value = Items Subtotal / 1.05
  const taxableItemsValue = itemsSubtotal / 1.05;
  const totalTaxAmount = itemsSubtotal - taxableItemsValue;
  const cgst = totalTaxAmount / 2; // 2.5% Inclusive CGST
  const sgst = totalTaxAmount / 2; // 2.5% Inclusive SGST

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:py-0 print:px-0">
      
      {/* ACTION TOPBAR BUTTON CONTROLS: Automatically drops out of scope during printing windows */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Link to="/orders" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Orders List
        </Link>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 bg-[#6b3410] hover:bg-[#54290c] text-white text-sm font-semibold px-4 py-2 rounded-md shadow-sm transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" /> Print Invoice
        </button>
      </div>

      {/* CORE INVOICE FRAME CANVAS CONTAINER */}
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl p-8 sm:p-12 shadow-sm print:border-0 print:shadow-none print:p-0">
        
        {/* HEADER BRANDING LAYER BLOCK */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-gray-100 pb-8">
          <div className="flex items-center gap-3">
            <img 
              src={DEFAULT_LOGO_PATH} 
              alt="Rams Boutique Logo" 
              className="h-12 w-auto object-contain error-fallback"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="font-serif font-bold text-[#6b3410] text-lg">Rams Boutique</div>
          </div>
          <div className="text-left sm:text-right space-y-1">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight uppercase">Invoice</h2>
            <p className="text-sm font-mono text-gray-500">#INV-{order.order_no || order.id?.substring(0,8).toUpperCase()}</p>
            <p className="text-xs text-gray-500">Date: {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : new Date().toLocaleDateString('en-IN')}</p>
            <span className="inline-block bg-green-50 text-green-700 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border border-green-200">
              Status: Paid
            </span>
          </div>
        </div>

        {/* METADATA ADDRESS INFORMATION SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-8 text-sm">
          <div>
            <h3 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-2">From:</h3>
            <p className="font-semibold text-gray-900">Rams Boutique</p>
            <p className="text-gray-600 mt-0.5">48-18-64, Tulasipeta Street</p>
            <p className="text-gray-600">Dwaraka Nagar, Visakhapatnam, AP 530016</p>
            <p className="text-blue-600 hover:underline text-xs mt-1">info@ramsboutique.com</p>
          </div>
          <div className="sm:text-right">
            <h3 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-2 sm:text-right">Billed To:</h3>
            <p className="font-semibold text-gray-900">{order.address?.full_name || 'Valued Customer'}</p>
            <p className="text-gray-600 mt-0.5">{order.address?.line1}</p>
            {order.address?.line2 && <p className="text-gray-600">{order.address.line2}</p>}
            <p className="text-gray-600">{order.address?.city || 'Visakhapatnam'} - {order.address?.pincode}</p>
            <p className="text-gray-700 font-medium text-xs mt-1">Phone: {order.address?.phone || 'N/A'}</p>
          </div>
        </div>

        {/* ITEMIZED TABLE DISPLAY DATA STRUCTUREGRID */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wider">
                <th className="py-3 px-4">Item Details</th>
                <th className="py-3 px-4 text-center">Quantity</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-800">
              {order.items && order.items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-gray-900">{item.name || 'Boutique Product Line'}</td>
                  <td className="py-3.5 px-4 text-center text-gray-600">{item.qty || 1}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-gray-600">{inr(item.price || 0)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-gray-900">{inr((item.price || 0) * (item.qty || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FINANCIAL SUMMARY BALANCES LAYOUT (INCLUSIVE TAXATION MODELS) */}
        <div className="flex justify-end text-sm">
          <div className="w-full sm:w-64 space-y-2.5 font-medium border-t border-gray-100 pt-4">
            <div className="flex justify-between text-gray-600">
              <span>Items Subtotal:</span>
              <span className="font-mono">{inr(itemsSubtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs italic pl-2">
              <span>Includes CGST (2.5%):</span>
              <span className="font-mono">{inr(cgst)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs italic pl-2">
              <span>Includes SGST (2.5%):</span>
              <span className="font-mono">{inr(sgst)}</span>
            </div>
            <div className="flex justify-between text-gray-600 border-b border-gray-100 pb-2">
              <span>Delivery Charges:</span>
              <span className="font-mono">{inr(fixedDeliveryCharge)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
              <span>Total Paid:</span>
              <span className="font-mono text-[#6b3410]">{inr(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* INVOICE REGULATORY LEGAL COMPLIANCE FOOTER SIGNATURE NOTE */}
        <div className="mt-12 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 italic">
            Thank you for shopping at Rams Boutique! This is a computer-generated invoice for a paid transaction. Taxes shown are inclusive of items values.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Invoice;
