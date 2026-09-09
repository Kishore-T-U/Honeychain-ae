"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";

export default function PublicVerifyPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const receiptId = searchParams.get("receipt");

  const [productInfo, setProductInfo] = useState<any>(null);
  const [traceData, setTraceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicData = async () => {
      if (!receiptId) {
        setLoading(false);
        return;
      }

      // 1. Fetch retail product details linked to this receipt
      const { data: product } = await supabase
        .from('retail_bottles')
        .select('*')
        .eq('parent_receipt_id', receiptId)
        .single();
      
      if (product) setProductInfo(product);

      // 2. Fetch the supply chain timeline (Apiary lots, AI health checks, etc.)
      const { data: lots } = await supabase
        .from('honey_lots')
        .select('*')
        .eq('receipt_id', receiptId);
      
      if (lots) setTraceData(lots);
      setLoading(false);
    };

    fetchPublicData();
  }, [receiptId, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-600">
        <p className="animate-pulse">Loading Verified Supply Chain Record...</p>
      </div>
    );
  }

  if (!receiptId || (!productInfo && traceData.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Invalid or Expired QR Code</h1>
        <p className="text-sm text-slate-500">This batch record could not be found on the HoneyChain ledger.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8 px-4 font-sans text-slate-800">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white text-center">
          <span className="text-xs uppercase tracking-widest font-bold bg-white/20 px-3 py-1 rounded-full">
            Government Verified & Immutable
          </span>
          <h1 className="text-2xl font-black mt-3">{productInfo?.product_name || "Pure Traceable Honey"}</h1>
          <p className="text-sm text-amber-100 mt-1">Bottled & Distributed by {productInfo?.company_name || "Verified Processor"}</p>
        </div>

        {productInfo?.description && (
          <div className="p-4 bg-amber-50/50 border-b border-amber-100 text-xs text-amber-900 text-center font-medium">
            "{productInfo.description}"
          </div>
        )}

        {/* Timeline Section */}
        <div className="p-6">
          <h2 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
            <span>🛡️</span> Complete Supply Chain Journey
          </h2>

          <div className="relative border-l-2 border-slate-200 ml-3 flex flex-col gap-8 pb-4">
            
            {/* Step 1: Retail Packaging */}
            <div className="relative pl-6">
              <div className="absolute w-4 h-4 bg-orange-500 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm"></div>
              <h4 className="font-bold text-slate-800 text-sm">Retail Packaging</h4>
              <p className="text-xs text-slate-500 mt-1">Sealed & published for public retail consumption.</p>
            </div>

            {/* Step 2: Government & FPO Verification */}
            <div className="relative pl-6">
              <div className="absolute w-4 h-4 bg-blue-500 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm"></div>
              <h4 className="font-bold text-slate-800 text-sm">Government Tax & FPO Clearance</h4>
              <p className="text-xs text-slate-500 mt-1">Batch legally authorized. 5% state tax automatically deducted & logged into Ministry ledger.</p>
            </div>

            {/* Step 3: Beekeepers & AI Health Checks */}
            {traceData.map((log, idx) => (
              <div key={idx} className="relative pl-6">
                <div className="absolute w-4 h-4 bg-green-500 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm"></div>
                <h4 className="font-bold text-slate-800 text-sm">Apiary Source: {log.apiary_id}</h4>
                <p className="text-xs text-slate-500 mt-1 font-mono">Harvested on: {new Date(log.created_at).toLocaleString()}</p>
                <div className="mt-2 inline-block">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${log.ai_status === 'Normal' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    AI Health Verification: {log.ai_status} ({log.ai_confidence})
                  </span>
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400 font-mono">
          Batch Trace ID: {receiptId} • Powered by HoneyChain-AE
        </div>

      </div>
    </div>
  );
}