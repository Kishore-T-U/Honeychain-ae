"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function FPODashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [lots, setLots] = useState<any[]>([]);
  const [buyerDemands, setBuyerDemands] = useState<any[]>([]);

  const fetchData = async () => {
    const { data: lts } = await supabase.from('honey_lots').select('*').in('status', ['authorized', 'payment_pending', 'sold_to_processor']);
    if (lts) setLots(lts);
    const { data: demands } = await supabase.from('buyer_demands').select('*').order('offered_price_per_kg', { ascending: false });
    if (demands) setBuyerDemands(demands);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('fpo_market')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyer_demands' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'honey_lots' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const availableLots = lots.filter(l => l.status === 'authorized');
  const transactions = lots.filter(l => l.status === 'payment_pending' || l.status === 'sold_to_processor');
  const totalCollected = availableLots.reduce((sum, lot) => sum + lot.quantity_kg, 0);

  const apiaryShares = availableLots.reduce((acc, lot) => {
    acc[lot.apiary_id] = (acc[lot.apiary_id] || 0) + lot.quantity_kg;
    return acc;
  }, {} as Record<string, number>);

  const acceptBid = async (bid: any) => {
    const demandQty = bid.requested_quantity_kg;
    if (totalCollected === 0 || demandQty > totalCollected) return alert(`Not enough inventory (${totalCollected}kg available).`);
    
    const fpoEmail = prompt(`Enter your FPO email to send the invoice to ${bid.company_name} (${bid.contact_email}):`);
    if (!fpoEmail) return;
    
    const receiptId = `RCPT-${Math.floor(Math.random() * 1000000)}`;
    const taxRate = 0.05; 
    
    for (const lot of availableLots) {
      const proportion = lot.quantity_kg / totalCollected;
      const soldQty = parseFloat((demandQty * proportion).toFixed(2));
      const remainQty = parseFloat((lot.quantity_kg - soldQty).toFixed(2));
      const grossRevenue = soldQty * bid.offered_price_per_kg;
      const netPayout = grossRevenue * (1 - taxRate);

      if (soldQty > 0) {
        await supabase.from('honey_lots').update({ 
          quantity_kg: soldQty, status: 'payment_pending', price_per_kg: bid.offered_price_per_kg, buyer_company: bid.company_name, final_payout: netPayout, receipt_id: receiptId
        }).eq('id', lot.id);

        if (remainQty > 0) {
          await supabase.from('honey_lots').insert({
            apiary_id: lot.apiary_id, quantity_kg: remainQty, status: 'authorized', ai_status: lot.ai_status, ai_confidence: lot.ai_confidence
          });
        }
      }
    }
    
    await supabase.from('buyer_demands').delete().eq('company_name', bid.company_name);
    alert(`Invoice sent from ${fpoEmail} to ${bid.contact_email}. Awaiting payment for Receipt ${receiptId}.`);
    fetchData();
  };

  // Group split database rows into a single invoice based on Receipt ID
  // Group split database rows into a single invoice, IGNORING old null data
  const groupedTransactions = Object.values(transactions.reduce((acc: any, tx: any) => {
    if (!tx.receipt_id) return acc; // <-- This fixes the "null" bug
    if (!acc[tx.receipt_id]) {
      acc[tx.receipt_id] = { receipt_id: tx.receipt_id, buyer_company: tx.buyer_company, status: tx.status, total_volume: 0, total_amount: 0, apiaries: [] };
    }
    acc[tx.receipt_id].total_volume += tx.quantity_kg;
    acc[tx.receipt_id].total_amount += (tx.quantity_kg * tx.price_per_kg);
    acc[tx.receipt_id].apiaries.push(`${tx.apiary_id}: ${tx.quantity_kg}kg`);
    if (tx.status === 'payment_pending') acc[tx.receipt_id].status = 'payment_pending';
    return acc;
  }, {}));

  const downloadReceipt = (txGroup: any) => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 30px; border: 1px solid #ccc; border-radius: 10px;">
        <h2 style="color: #16a34a; margin-bottom: 0;">HoneyChain-AE Verified Receipt</h2>
        <p style="color: #666; margin-top: 5px;">FPO Copy</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <p><strong>Receipt ID:</strong> ${txGroup.receipt_id}</p>
        <p><strong>Billed To:</strong> ${txGroup.buyer_company}</p>
        <p><strong>Status:</strong> <span style="color: ${txGroup.status === 'payment_pending' ? 'orange' : 'green'};">${txGroup.status === 'payment_pending' ? 'PAYMENT DUE' : 'PAID IN FULL'}</span></p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <h3>Origin Sources (Traceability):</h3>
        <ul>${txGroup.apiaries.map((a: string) => `<li>${a}</li>`).join('')}</ul>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <h3 style="margin-bottom: 5px;">Total Procured Volume: ${txGroup.total_volume} kg</h3>
        <h2 style="margin-top: 5px; color: #111;">Total Paid: $${txGroup.total_amount.toFixed(2)}</h2>
      </div>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FPO_Receipt_${txGroup.receipt_id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F0FDF4] p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end border-b border-green-300 pb-4 mb-8">
          <div>
            <h2 className="text-sm font-semibold text-green-700 uppercase tracking-widest">Aggregation Hub</h2>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">FPO Collector Board</h1>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-sm text-green-700 hover:underline">Sign out</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="flex flex-col gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200">
              <h3 className="text-slate-500 font-semibold mb-1">Available Inventory</h3>
              <div className="text-5xl font-bold text-green-700 mb-2">{totalCollected} <span className="text-2xl text-slate-500">kg</span></div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-sm">Batch Contributors (Share %)</div>
              <div className="max-h-[300px] overflow-y-auto p-4 flex flex-col gap-4">
                {Object.entries(apiaryShares as Record<string, number>).map(([apiary, qtyVal]) => {
                  const qty = Number(qtyVal);
                  const pct = Math.round((qty / totalCollected) * 100) || 0;
                  return (
                    <div key={apiary}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-mono font-bold text-slate-700">{apiary}</span>
                        <span className="font-bold text-green-600">{qty}kg ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden self-start">
            <div className="p-4 bg-green-50 border-b border-green-100 font-bold">Buyer Marketplace</div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="p-4">Company</th>
                  <th className="p-4">Volume Needed</th>
                  <th className="p-4">Offered Price</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buyerDemands.map(bid => (
                  <tr key={bid.company_name} className="hover:bg-green-50">
                    <td className="p-4 font-bold text-slate-800">{bid.company_name}</td>
                    <td className="p-4 font-semibold text-slate-700">{bid.requested_quantity_kg} kg</td>
                    <td className="p-4 font-bold text-green-700">${bid.offered_price_per_kg}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => acceptBid(bid)} disabled={totalCollected === 0} className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded font-bold text-sm disabled:opacity-50">Accept & Invoice</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="font-bold text-xl mb-4">Transactions & Sent Invoices</h3>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <th className="p-4">Receipt ID</th>
                <th className="p-4">Buyer</th>
                <th className="p-4">Total Amount</th>
                <th className="p-4">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedTransactions.map((tx: any) => (
                <tr key={tx.receipt_id}>
                  <td className="p-4 font-mono font-bold text-slate-700">{tx.receipt_id}</td>
                  <td className="p-4 font-bold">{tx.buyer_company}</td>
                  <td className="p-4 font-bold text-slate-800">${tx.total_amount.toFixed(2)}</td>
                  <td className="p-4">
                    {tx.status === 'payment_pending' ? (
                       <div className="flex items-center gap-3">
                         <span className="text-sm font-bold text-amber-600">Awaiting Payment</span>
                         <button onClick={() => downloadReceipt(tx)} className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded font-bold cursor-pointer">📄 Invoice</button>
                       </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-green-700">Paid</span>
                        <button onClick={() => downloadReceipt(tx)} className="text-xs bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1 rounded font-bold cursor-pointer">📄 Download</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}