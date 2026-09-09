"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function GovernmentDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("pending_review");
  const [lots, setLots] = useState<any[]>([]);

  const fetchLots = async () => {
    const { data } = await supabase.from('honey_lots').select('*').order('created_at', { ascending: false });
    if (data) setLots(data);
  };

  useEffect(() => {
    fetchLots();
    const channel = supabase.channel('govt_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'honey_lots' }, fetchLots)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('honey_lots').update({ status: newStatus }).eq('id', id);
  };

  const pendingLots = lots.filter(l => l.status === 'pending_review');
  const procuredLots = lots.filter(l => l.status === 'authorized');
  const flaggedLots = lots.filter(l => l.status === 'flagged' || l.status === 'audit_scheduled');
  
  // Tax Calculation Logic
  const soldLots = lots.filter(l => l.status === 'sold_to_processor');
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyTax = soldLots
    .filter(l => {
      const date = new Date(l.created_at);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .reduce((sum, l) => {
      const gross = l.quantity_kg * (l.price_per_kg || 0);
      return sum + (gross * 0.05); // 5% Govt Tax
    }, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-end border-b border-slate-300 pb-4 mb-8">
          <div>
            <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-widest">Ministry of Agriculture</h2>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">Lot Authorization & Tax Board</h1>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-sm text-blue-700 hover:underline">Sign out</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Pending Review</div>
            <div className="text-2xl font-bold">{pendingLots.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Authorized</div>
            <div className="text-2xl font-bold text-green-600">{procuredLots.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Flagged / Audit</div>
            <div className="text-2xl font-bold text-red-600">{flaggedLots.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 bg-blue-50/50">
            <div className="text-sm text-blue-700 font-semibold mb-1">Monthly Tax Revenue</div>
            <div className="text-2xl font-bold text-blue-900">${monthlyTax.toFixed(2)}</div>
          </div>
        </div>

        <div className="flex gap-4 mb-4 border-b border-slate-200 pb-2">
          <button onClick={() => setActiveTab("pending_review")} className={`font-bold pb-2 ${activeTab === "pending_review" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500"}`}>Awaiting Authorization</button>
          <button onClick={() => setActiveTab("authorized")} className={`font-bold pb-2 ${activeTab === "authorized" ? "text-green-600 border-b-2 border-green-600" : "text-slate-500"}`}>Procured & Tested</button>
          <button onClick={() => setActiveTab("flagged")} className={`font-bold pb-2 ${activeTab === "flagged" ? "text-red-600 border-b-2 border-red-600" : "text-slate-500"}`}>Flagged</button>
          <button onClick={() => setActiveTab("tax_ledger")} className={`font-bold pb-2 ${activeTab === "tax_ledger" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500"}`}>Tax Ledger</button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              {activeTab === "tax_ledger" ? (
                <tr className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="p-4">Receipt / Trace ID</th>
                  <th className="p-4">Buyer Company</th>
                  <th className="p-4">Gross Sale</th>
                  <th className="p-4 text-right">Tax Collected (5%)</th>
                </tr>
              ) : (
                <tr className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="p-4">Lot ID / Source</th>
                  <th className="p-4">Quantity</th>
                  <th className="p-4">AI Evidence</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {/* NORMAL WORKFLOW TABS */}
              {activeTab !== "tax_ledger" && lots.filter(l => l.status === activeTab || (activeTab === 'flagged' && l.status === 'audit_scheduled')).map(lot => (
                <tr key={lot.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-mono font-bold text-sm">{lot.id.split('-')[0]}...</div>
                    <div className="text-xs text-slate-500">{lot.apiary_id}</div>
                  </td>
                  <td className="p-4 font-bold">{lot.quantity_kg} kg</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${lot.ai_status === 'Normal' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {lot.ai_status} ({lot.ai_confidence})
                    </span>
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    {activeTab === 'pending_review' && (
                      <>
                        <button onClick={() => updateStatus(lot.id, 'flagged')} className="px-4 py-2 bg-slate-100 hover:bg-red-100 text-red-700 rounded font-semibold text-sm transition-colors">Flag</button>
                        <button onClick={() => updateStatus(lot.id, 'authorized')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm transition-colors">Proceed Verification</button>
                      </>
                    )}
                    {activeTab === 'authorized' && <span className="text-sm font-semibold text-green-700">Cleared for FPO</span>}
                    {activeTab === 'flagged' && lot.status === 'flagged' && (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => updateStatus(lot.id, 'dropped')} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded font-semibold text-sm transition-colors">Drop</button>
                        <button onClick={() => updateStatus(lot.id, 'authorized')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm transition-colors">Proceed Verification</button>
                      </div>
                    )}
                    {activeTab === 'flagged' && lot.status === 'audit_scheduled' && (
                       <span className="text-sm font-semibold text-amber-600">Audit Pending</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* TAX LEDGER TAB */}
              {activeTab === "tax_ledger" && soldLots.map(lot => {
                const grossSale = lot.quantity_kg * (lot.price_per_kg || 0);
                const taxCut = grossSale * 0.05;
                return (
                  <tr key={lot.id} className="hover:bg-blue-50/50">
                    <td className="p-4">
                      <div className="font-mono font-bold text-slate-800">{lot.receipt_id || "N/A"}</div>
                      <div className="text-xs text-slate-500">Apiary: {lot.apiary_id}</div>
                    </td>
                    <td className="p-4 font-bold">{lot.buyer_company || "Unknown"}</td>
                    <td className="p-4 font-semibold text-slate-600">${grossSale.toFixed(2)}</td>
                    <td className="p-4 text-right font-bold text-blue-700">+ ${taxCut.toFixed(2)}</td>
                  </tr>
                );
              })}
              
              {activeTab === "tax_ledger" && soldLots.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400">No completed tax records yet.</td></tr>
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}