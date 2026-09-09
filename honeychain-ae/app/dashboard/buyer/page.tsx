"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function BuyerDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [qtyNeeded, setQtyNeeded] = useState("");
  const [priceOffered, setPriceOffered] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [allBids, setAllBids] = useState<any[]>([]);
  const [myTransactions, setMyTransactions] = useState<any[]>([]);
  
  // Retail & Analytics State
  const [retailProducts, setRetailProducts] = useState<any[]>([]);
  const [consumerSales, setConsumerSales] = useState<any[]>([]);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [bottlePrice, setBottlePrice] = useState("");
  const [bottleStock, setBottleStock] = useState("");
  const [weightPerBottle, setWeightPerBottle] = useState("");
  const [publishingReceipt, setPublishingReceipt] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.email) {
      const verifiedName = user.email.split('@')[0].toUpperCase();
      setCompanyName(verifiedName);
      setContactEmail(user.email);

      // Fetch procured lots
      const { data: txs } = await supabase.from('honey_lots').select('*').eq('buyer_company', verifiedName).in('status', ['payment_pending', 'sold_to_processor', 'fully_bottled']);
      if (txs) setMyTransactions(txs);

      // Fetch published retail products
      const { data: rProducts } = await supabase.from('retail_bottles').select('*').eq('company_name', verifiedName);
      if (rProducts) setRetailProducts(rProducts);

      // Fetch consumer purchases for analytics
      const { data: cSales } = await supabase.from('consumer_transactions').select('*, retail_bottles!inner(company_name, price_per_bottle, product_name)').eq('retail_bottles.company_name', verifiedName);
      if (cSales) setConsumerSales(cSales);
    }

    const { data: bids } = await supabase.from('buyer_demands').select('*').order('offered_price_per_kg', { ascending: false });
    if (bids) setAllBids(bids);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('buyer_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyer_demands' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'honey_lots' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retail_bottles' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumer_transactions' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const submitDemand = async () => {
    if (!companyName || !contactEmail || !qtyNeeded || !priceOffered) return alert("Fill all fields");
    setIsSubmitting(true);
    await supabase.from('buyer_demands').upsert({
      company_name: companyName, contact_email: contactEmail, requested_quantity_kg: parseFloat(qtyNeeded), offered_price_per_kg: parseFloat(priceOffered), updated_at: new Date().toISOString()
    });
    setIsSubmitting(false); setQtyNeeded(""); setPriceOffered("");
  };

  const payInvoice = async (receiptId: string) => {
    await supabase.from('honey_lots').update({ status: 'sold_to_processor' }).eq('receipt_id', receiptId);
    alert(`Payment successful! Receipt ${receiptId} unlocked.`);
    fetchData();
  };

  const publishProduct = async (receiptId: string, availableVolume: number) => {
    if (!productName || !bottlePrice || !bottleStock || !weightPerBottle) return alert("Fill all product details");
    
    const totalWeightNeeded = parseFloat(bottleStock) * parseFloat(weightPerBottle);
    if (totalWeightNeeded > availableVolume) {
      return alert(`Not enough inventory! You need ${totalWeightNeeded.toFixed(2)}kg, but batch has ${availableVolume.toFixed(2)}kg.`);
    }

    // 1. Insert product
    await supabase.from('retail_bottles').insert({
      company_name: companyName,
      product_name: productName,
      description: productDesc,
      price_per_bottle: parseFloat(bottlePrice),
      stock_quantity: parseInt(bottleStock),
      parent_receipt_id: receiptId
    });

    // 2. Deduct from database lots to fix floating-point/state bug
    const { data: lotsToUpdate } = await supabase.from('honey_lots').select('*').eq('receipt_id', receiptId);
    if (lotsToUpdate) {
      let remainingToDeduct = totalWeightNeeded;
      for (const lot of lotsToUpdate) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(lot.quantity_kg, remainingToDeduct);
        const newQty = lot.quantity_kg - deduct;
        remainingToDeduct -= deduct;
        
        await supabase.from('honey_lots').update({ 
          quantity_kg: parseFloat(newQty.toFixed(2)), 
          status: newQty <= 0 ? 'fully_bottled' : 'sold_to_processor' 
        }).eq('id', lot.id);
      }
    }

    alert(`Product published! ${totalWeightNeeded.toFixed(2)}kg deducted from inventory.`);
    setPublishingReceipt(null);
    setProductName(""); setProductDesc(""); setBottlePrice(""); setBottleStock(""); setWeightPerBottle("");
    fetchData();
  };

  const dropProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to drop/close sales for this product?")) return;
    
    const { error } = await supabase.from('retail_bottles').delete().eq('id', productId);
    
    if (error) {
      alert("Error dropping product: " + error.message);
    } else {
      alert("Product sales dropped successfully.");
      fetchData();
    }
  };

  const groupedTransactions = Object.values(myTransactions.reduce((acc: any, tx: any) => {
    if (!tx.receipt_id) return acc;
    if (!acc[tx.receipt_id]) {
      acc[tx.receipt_id] = { receipt_id: tx.receipt_id, buyer_company: tx.buyer_company, status: tx.status, total_volume: 0, total_amount: 0, apiaries: [] };
    }
    acc[tx.receipt_id].total_volume += tx.quantity_kg;
    acc[tx.receipt_id].total_amount += (tx.quantity_kg * tx.price_per_kg);
    acc[tx.receipt_id].apiaries.push(`${tx.apiary_id}: ${tx.quantity_kg}kg`);
    if (tx.status === 'payment_pending') acc[tx.receipt_id].status = 'payment_pending';
    return acc;
  }, {}));

  const totalRevenue = consumerSales.reduce((sum, s) => sum + s.total_paid, 0);
  const totalUnitsSold = consumerSales.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end border-b border-slate-300 pb-4 mb-8">
          <div>
            <h2 className="text-sm font-semibold text-indigo-600 uppercase tracking-widest">Processor Portal</h2>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">Marketplace & Retail Analytics</h1>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-sm text-indigo-700 hover:underline">Sign out</button>
        </div>

        {/* ANALYTICS METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Total Retail Revenue</div>
            <div className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Consumer Bottles Sold</div>
            <div className="text-2xl font-bold text-indigo-600">{totalUnitsSold} units</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Active Retail Listings</div>
            <div className="text-2xl font-bold text-slate-800">{retailProducts.length} products</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4">Post Procurement Bid</h3>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex gap-4">
                <input type="text" value={companyName} readOnly className="w-1/2 p-3 border rounded outline-none bg-slate-100 text-slate-500 font-bold" />
                <input type="email" value={contactEmail} readOnly className="w-1/2 p-3 border rounded outline-none bg-slate-100 text-slate-500" />
              </div>
              <div className="flex gap-4">
                <input type="number" value={qtyNeeded} onChange={e => setQtyNeeded(e.target.value)} className="w-1/2 p-3 border rounded outline-none" placeholder="Qty Needed (kg)"/>
                <input type="number" value={priceOffered} onChange={e => setPriceOffered(e.target.value)} className="w-1/2 p-3 border rounded outline-none" placeholder="Price / kg ($)"/>
              </div>
            </div>
            <button onClick={submitDemand} disabled={isSubmitting} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg">Broadcast Demand</button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[320px]">
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 font-bold text-indigo-900">Live Market Order Book</div>
            <div className="overflow-y-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  {allBids.map(bid => (
                    <tr key={bid.company_name}>
                      <td className="p-3 font-bold">{bid.company_name} {bid.company_name === companyName && <span className="text-xs text-indigo-500">(You)</span>}</td>
                      <td className="p-3">{bid.requested_quantity_kg} kg</td>
                      <td className="p-3 text-right font-bold text-green-600">${bid.offered_price_per_kg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PAYMENTS & INVOICES */}
        <h3 className="font-bold text-xl mb-4">Payments & Receipts</h3>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <th className="p-4">Receipt ID</th>
                <th className="p-4">Total Volume</th>
                <th className="p-4">Total Amount</th>
                <th className="p-4 text-right">Action / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedTransactions.map((tx: any) => (
                <tr key={tx.receipt_id}>
                  <td className="p-4 font-mono font-bold">{tx.receipt_id}</td>
                  <td className="p-4">{tx.total_volume.toFixed(2)} kg</td>
                  <td className="p-4 font-bold">${tx.total_amount.toFixed(2)}</td>
                  <td className="p-4 text-right">
                    {tx.status === 'payment_pending' ? (
                      <button onClick={() => payInvoice(tx.receipt_id)} className="px-4 py-2 bg-green-600 text-white rounded font-bold text-sm">Pay Invoice</button>
                    ) : (
                      <span className="text-sm font-bold text-green-700">Paid & Authorized</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RETAIL BOTTLING & MANAGEMENT */}
        <h3 className="font-bold text-xl mb-4">Retail Bottling & Active Listings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {groupedTransactions.filter((tx: any) => tx.status === 'sold_to_processor' || tx.status === 'fully_bottled').map((tx: any) => (
            <div key={tx.receipt_id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-xs font-bold text-indigo-600 uppercase">Procured Batch</div>
                  <div className="font-mono font-bold text-slate-800">{tx.receipt_id}</div>
                  <div className="text-sm text-slate-500">{tx.total_volume.toFixed(2)} kg Available</div>
                </div>
                {tx.total_volume > 0 && (
                  <button onClick={() => setPublishingReceipt(tx.receipt_id)} className="px-4 py-2 bg-slate-800 text-white rounded font-bold text-sm">Package & Sell</button>
                )}
              </div>

              {publishingReceipt === tx.receipt_id && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <input type="text" placeholder="Product Name (e.g. Pure Wild Honey)" value={productName} onChange={e => setProductName(e.target.value)} className="p-2 border rounded text-sm w-full outline-none" />
                  <input type="text" placeholder="Marketing Description" value={productDesc} onChange={e => setProductDesc(e.target.value)} className="p-2 border rounded text-sm w-full outline-none" />
                  <div className="flex gap-3">
                    <input type="number" placeholder="Total Bottles" value={bottleStock} onChange={e => setBottleStock(e.target.value)} className="p-2 border rounded text-sm w-1/2 outline-none" />
                    <input type="number" placeholder="Weight/Bottle (kg)" value={weightPerBottle} onChange={e => setWeightPerBottle(e.target.value)} className="p-2 border rounded text-sm w-1/2 outline-none" />
                  </div>
                  <input type="number" placeholder="Price per Bottle ($)" value={bottlePrice} onChange={e => setBottlePrice(e.target.value)} className="p-2 border rounded text-sm w-full outline-none" />
                  <button onClick={() => publishProduct(tx.receipt_id, tx.total_volume)} className="w-full py-2 bg-indigo-600 text-white rounded font-bold mt-2">Publish to Store</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ACTIVE LISTINGS WITH DROP OPTION */}
        <h3 className="font-bold text-lg mb-3">Live Store Products (Drop Sales Option)</h3>
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
                <th className="p-3">Product</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Price</th>
                <th className="p-3 text-right">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {retailProducts.map(p => (
                <tr key={p.id}>
                  <td className="p-3 font-bold">{p.product_name}</td>
                  <td className="p-3">{p.stock_quantity} bottles</td>
                  <td className="p-3 font-bold text-green-600">${p.price_per_bottle.toFixed(2)}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => dropProduct(p.id)} className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded font-bold text-xs">Drop Sales</button>
                  </td>
                </tr>
              ))}
              {retailProducts.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No active products.</td></tr>}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}