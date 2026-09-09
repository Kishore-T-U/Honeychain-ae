"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ConsumerDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  const [products, setProducts] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [traceData, setTraceData] = useState<any[] | null>(null);
  const [activeTrace, setActiveTrace] = useState<string | null>(null);

  // Checkout Modal State
  const [checkoutProduct, setCheckoutProduct] = useState<any | null>(null);
  const [checkoutQty, setCheckoutQty] = useState(1);
  const [shippingAddress, setShippingAddress] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [activeQr, setActiveQr] = useState<any | null>(null);

  const fetchStoreData = async () => {
    // Check user safely without forcing a redirect
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.email) {
      setUserEmail(user.email);
    } else {
      setUserEmail("guest@consumer.com"); // Safe fallback for public scanners
    }

    const { data } = await supabase.from('retail_bottles').select('*').order('rating', { ascending: false });
    if (data) setProducts(data);
  };

  useEffect(() => {
    fetchStoreData();
    
    // 1. Check if URL has the verify parameter (and save it just in case login interrupts)
    const params = new URLSearchParams(window.location.search);
    let verifyReceipt = params.get('verify');

    if (verifyReceipt) {
      localStorage.setItem('pending_verify', verifyReceipt);
    } else {
      // 2. If URL lost it during login redirect, check localStorage memory
      verifyReceipt = localStorage.getItem('pending_verify');
    }

    // 3. If we found a receipt ID from either place, open the timeline and clear memory
    if (verifyReceipt) {
      localStorage.removeItem('pending_verify');
      loadTraceability(verifyReceipt, `Verified Batch: ${verifyReceipt}`);
    }

    const channel = supabase.channel('consumer_store')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retail_bottles' }, fetchStoreData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const processPayment = async () => {
    if (!shippingAddress || !cardNumber) return alert("Please fill in shipping and payment details.");
    if (checkoutQty > checkoutProduct.stock_quantity) return alert("Not enough stock available.");

    const totalPaid = checkoutQty * checkoutProduct.price_per_bottle;

    // 1. Record purchase
    await supabase.from('consumer_transactions').insert({
      bottle_id: checkoutProduct.id,
      consumer_email: userEmail,
      quantity: checkoutQty,
      total_paid: totalPaid
    });

    // 2. Reduce stock
    await supabase.from('retail_bottles').update({ 
      stock_quantity: checkoutProduct.stock_quantity - checkoutQty 
    }).eq('id', checkoutProduct.id);

    alert(`Payment of $${totalPaid.toFixed(2)} successful! Order placed to ${shippingAddress}.`);
    setCheckoutProduct(null);
    setCheckoutQty(1);
    setShippingAddress("");
    setCardNumber("");
    fetchStoreData();
  };

  const handleRating = async (productId: string, starScore: number) => {
    const { data: purchases } = await supabase
      .from('consumer_transactions')
      .select('*')
      .eq('bottle_id', productId)
      .eq('consumer_email', userEmail);

    if (!purchases || purchases.length === 0) {
      return alert("Access Denied: You must purchase this bottle before submitting a verified rating.");
    }

    const { error } = await supabase.from('product_reviews').insert({
      bottle_id: productId,
      consumer_email: userEmail,
      rating: starScore
    });

    if (error) {
      return alert("You have already rated this product under your username.");
    }

    const { data: allReviews } = await supabase.from('product_reviews').select('rating').eq('bottle_id', productId);
    if (allReviews && allReviews.length > 0) {
      const total = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const avg = total / allReviews.length;
      await supabase.from('retail_bottles').update({ rating: avg, review_count: allReviews.length }).eq('id', productId);
    }

    alert("Verified rating submitted successfully!");
    fetchStoreData();
  };

  const loadTraceability = async (receiptId: string, productName: string) => {
    setActiveTrace(productName);
    const { data } = await supabase.from('honey_lots').select('apiary_id, ai_status, ai_confidence, created_at, status').eq('receipt_id', receiptId);
    setTraceData(data || []);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-end border-b border-slate-300 pb-4 mb-8">
          <div>
            <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-widest">Verified Marketplace</h2>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">Consumer Storefront</h1>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Logged in as:</span>
            <span className="font-bold text-sm text-slate-700">{userEmail}</span>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="ml-4 text-sm text-orange-700 hover:underline">Sign out</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="h-44 bg-slate-50 flex items-center justify-between px-6 border-b border-slate-200 relative">
                <div className="text-5xl">🍯</div>
                {/* Scannable QR Code */}
<div className="bg-white p-2 rounded-lg border shadow-sm text-center">
  <img 
  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/verify?receipt=${product.parent_receipt_id}`)}`} 
  alt="QR Code" 
  className="w-16 h-16 object-contain cursor-pointer hover:scale-105 transition-transform"
  onClick={() => setActiveQr(product)}
  title="Click to enlarge & scan"
/>
  <span className="text-[9px] font-bold text-slate-400 block mt-1">Click to Scan</span>
</div>
                <div className="absolute top-3 left-3 bg-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                  ⭐ {product.rating.toFixed(1)} <span className="text-slate-400">({product.review_count})</span>
                </div>
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="text-xs font-bold text-orange-600 uppercase mb-1">{product.company_name}</div>
                <h3 className="font-bold text-lg mb-2">{product.product_name}</h3>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">{product.description || "100% Pure Traceable Honey."}</p>
                
                <div className="flex justify-between items-end mb-4">
                  <div className="text-2xl font-black text-slate-800">${product.price_per_bottle.toFixed(2)}</div>
                  <div className="text-xs font-bold text-slate-400">{product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'SOLD OUT'}</div>
                </div>

                <div className="flex flex-col gap-2">
                  <button onClick={() => setCheckoutProduct(product)} disabled={product.stock_quantity <= 0} className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg disabled:opacity-50 transition-colors">
                    Buy Now
                  </button>
                  <button onClick={() => loadTraceability(product.parent_receipt_id, product.product_name)} className="w-full py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                    🔍 Verify QR Trace Timeline
                  </button>
                  
                  <div className="mt-2 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Verified Rating:</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} onClick={() => handleRating(product.id, star)} className="text-slate-300 hover:text-yellow-400 text-lg transition-colors">★</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHECKOUT & BILLING MODAL */}
      {checkoutProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative p-6">
            <button onClick={() => setCheckoutProduct(null)} className="absolute top-4 right-4 text-slate-400 hover:text-black font-bold">✕</button>
            <h2 className="font-bold text-xl text-slate-800 mb-1">Secure Checkout</h2>
            <p className="text-xs text-slate-500 mb-4">{checkoutProduct.product_name} • ${checkoutProduct.price_per_bottle.toFixed(2)} / bottle</p>
            
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Quantity (Bottles)</label>
                <input type="number" min="1" max={checkoutProduct.stock_quantity} value={checkoutQty} onChange={e => setCheckoutQty(parseInt(e.target.value) || 1)} className="w-full p-3 border rounded outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Shipping Address</label>
                <input type="text" placeholder="123 Street Name, City" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="w-full p-3 border rounded outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Payment Card Simulation</label>
                <input type="text" placeholder="4111 2222 3333 4444" value={cardNumber} onChange={e => setCardNumber(e.target.value)} className="w-full p-3 border rounded outline-none" />
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border flex justify-between items-center">
                <span className="font-bold text-sm text-slate-600">Total Billed:</span>
                <span className="font-black text-xl text-slate-900">${(checkoutQty * checkoutProduct.price_per_bottle).toFixed(2)}</span>
              </div>
            </div>

            <button onClick={processPayment} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors">
              Complete Payment & Place Order
            </button>
          </div>
        </div>
      )}

      {/* TRACEABILITY TIMELINE MODAL */}
      {traceData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <button onClick={() => setTraceData(null)} className="absolute top-4 right-4 text-slate-400 hover:text-black font-bold">✕</button>
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-bold text-2xl text-slate-800">Government & Supply Chain Record</h2>
              <p className="text-sm text-orange-600 font-semibold mt-1">{activeTrace}</p>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="relative border-l-2 border-slate-200 ml-3 flex flex-col gap-8 pb-4">
                <div className="relative pl-6">
                  <div className="absolute w-4 h-4 bg-orange-500 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm"></div>
                  <h4 className="font-bold text-slate-800 text-sm">Retail Packaging</h4>
                  <p className="text-xs text-slate-500 mt-1">Sealed & Published by Processor</p>
                </div>
                <div className="relative pl-6">
                  <div className="absolute w-4 h-4 bg-blue-500 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm"></div>
                  <h4 className="font-bold text-slate-800 text-sm">Government Tax & FPO Clearance</h4>
                  <p className="text-xs text-slate-500 mt-1">Batch legally authorized, taxes settled to Ministry ledger.</p>
                </div>
                {traceData.map((log, idx) => (
                  <div key={idx} className="relative pl-6">
                    <div className="absolute w-4 h-4 bg-green-500 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm"></div>
                    <h4 className="font-bold text-slate-800 text-sm">Apiary Source: {log.apiary_id}</h4>
                    <p className="text-xs text-slate-500 mt-1 font-mono">{new Date(log.created_at).toLocaleString()}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${log.ai_status === 'Normal' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        AI Health: {log.ai_status} ({log.ai_confidence})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ENLARGED SCANNABLE QR MODAL */}
      {activeQr && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative p-6 text-center">
            <button onClick={() => setActiveQr(null)} className="absolute top-4 right-4 text-slate-400 hover:text-black font-bold">✕</button>
            <h2 className="font-bold text-xl text-slate-800 mb-1">Scan Traceability QR</h2>
            <p className="text-xs text-slate-500 mb-6">{activeQr.product_name}</p>
            
            <div className="bg-slate-50 p-6 rounded-xl border inline-block mb-6 shadow-inner">
              <img 
  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/verify?receipt=${activeQr.parent_receipt_id}`)}`} 
  alt="Large QR Code" 
  className="w-48 h-48 mx-auto object-contain"
/>
            </div>

            <div className="text-xs font-mono text-slate-400 mb-6">Batch ID: {activeQr.parent_receipt_id}</div>

            <button 
              onClick={() => {
                const receiptId = activeQr.parent_receipt_id;
                const productName = activeQr.product_name;
                setActiveQr(null);
                loadTraceability(receiptId, productName);
              }} 
              className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-sm transition-colors"
            >
              View Supply Chain Timeline Instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}