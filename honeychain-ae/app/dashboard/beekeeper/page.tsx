"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function BeekeeperDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  const [apiaryId, setApiaryId] = useState("APIARY-001");
  const [harvestQty, setHarvestQty] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.email) {
      const verifiedName = user.email.split('@')[0].toUpperCase();
      setApiaryId(verifiedName); // Locks the ID to the authenticated email
      
      const { data } = await supabase.from('honey_lots')
        .select('*')
        .eq('apiary_id', verifiedName)
        .order('created_at', { ascending: false });
      if (data) setHistory(data);
    }
  };

  useEffect(() => {
    fetchHistory();
    const channel = supabase.channel('beekeeper_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'honey_lots' }, fetchHistory)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleLogHarvest = async () => {
    if (!harvestQty || !apiaryId) return alert("Please enter Apiary ID and quantity.");
    setIsLogging(true);
    
    await supabase.from('honey_lots').insert({ 
      apiary_id: apiaryId,
      quantity_kg: parseFloat(harvestQty), 
      status: 'pending_review',
      ai_status: result ? result.risk_status : 'Unverified',
      ai_confidence: result ? `${(result.confidence_score * 100).toFixed(1)}%` : 'N/A'
    });
    setHarvestQty("");
    setResult(null);
    setIsLogging(false);
  };

  const handleClearLogs = async () => {
    if(!confirm("Clear all completed and dropped logs?")) return;
    await supabase.from('honey_lots').delete().in('status', ['sold_to_processor', 'dropped']);
    fetchHistory();
  };

  const downloadBeekeeperReceipt = (lot: any) => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 30px; border: 1px solid #ccc; border-radius: 10px;">
        <h2 style="color: #d97706; margin-bottom: 0;">HoneyChain-AE Verified Payout</h2>
        <p style="color: #666; margin-top: 5px;">Beekeeper Copy • ${lot.apiary_id}</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <p><strong>Receipt ID:</strong> ${lot.receipt_id}</p>
        <p><strong>Procured By:</strong> ${lot.buyer_company}</p>
        <p><strong>Status:</strong> <span style="color: green;">PAID IN FULL</span></p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <h3 style="margin-bottom: 5px;">Your Contribution: ${lot.quantity_kg} kg</h3>
        <p style="color: #666; font-size: 14px;">5% Government Tax has been automatically deducted.</p>
        <h2 style="margin-top: 10px; color: #111;">Net Payout Deposited: $${lot.final_payout.toFixed(2)}</h2>
      </div>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Beekeeper_Payout_${lot.receipt_id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- KEEP YOUR EXISTING AI FUNCTIONS BELOW THIS LINE ---
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 1. Audio Capture (DSP Anomaly Detection)
  const startAudioScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadForAnalysis(audioBlob, "analyze-audio", "audio.webm");
        stream.getTracks().forEach(track => track.stop()); // Kill mic
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Enforce 10-second scan window
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 10000);
      
    } catch (err) {
      alert("Microphone access denied or unavailable.");
    }
  };

  // 2. Image Capture (Disease Identification)
  const handleImageCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadForAnalysis(file, "analyze-image", file.name);
    }
  };

  // 3. API Transport layer
  const uploadForAnalysis = async (fileBlob: Blob, endpoint: string, filename: string) => {
  setAnalyzing(true);
  const formData = new FormData();
  formData.append("file", fileBlob, filename);
  try {
    // Ensure there is always a clean slash between the base URL and the endpoint
    const base = "https://honeychain-ai-engine.onrender.com";
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const res = await fetch(`${base}${formattedEndpoint}`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    setResult(data);
  } catch (error) {
    alert("Failed to process AI Diagnostics.");
  } finally {
    setAnalyzing(false);
  }
};

return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-end border-b border-slate-300 pb-4 mb-8">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">HoneyChain-AE</h2>
            <h1 className="text-4xl font-bold italic text-slate-900 mt-1">Hive evidence</h1>
          </div>
          <button onClick={handleSignOut} className="text-sm text-amber-700 hover:underline">Sign out</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="flex flex-col gap-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Log New Harvest</label>
              <div className="flex gap-4 items-center">
                <input 
  type="text" 
  value={apiaryId} 
  readOnly 
  className="px-4 py-3 border bg-slate-100 text-slate-500 rounded shadow-sm w-32 outline-none cursor-not-allowed font-bold" 
/>
                <input type="number" placeholder="Quantity (kg)" value={harvestQty} onChange={(e) => setHarvestQty(e.target.value)} className="px-4 py-3 border bg-white rounded shadow-sm w-40 outline-none" />
                <button onClick={handleLogHarvest} disabled={isLogging} className="bg-[#1A1A1A] hover:bg-black text-white px-6 py-3 rounded font-semibold disabled:opacity-70">
                  {isLogging ? "Logging..." : "Log Harvest"}
                </button>
              </div>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-amber-200">
              <h2 className="text-xl font-bold text-amber-900 mb-4">AI Field Diagnostics</h2>
              <div className="flex gap-4 mb-6">
                <button onClick={startAudioScan} disabled={analyzing} className="flex-1 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold">🎙️ Acoustic Check</button>
                <div className="relative flex-1">
  <input 
    type="file" 
    accept="image/*" 
    capture="environment" 
    onChange={handleImageCapture} 
    disabled={analyzing} 
    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
  />
  <button className="w-full h-full py-4 bg-amber-50 text-amber-900 border-2 border-amber-300 rounded-lg font-bold">
    📷 Open Camera / Scan
  </button>
</div>
              </div>
              
              {/* Fixed-height container restores your UI styling safely */}
              <div className="min-h-[160px] flex flex-col justify-center">
                {result && !analyzing && (
                  <div className="p-5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold">Diagnosis:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${result.risk_status === 'Normal' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {result.risk_status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{result.detail}</p>
                    <div className="text-xs font-mono text-slate-500">Confidence: {(result.confidence_score * 100).toFixed(1)}%</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col h-full max-h-[750px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Evidence History & Revenue</h3>
              <button onClick={handleClearLogs} className="text-xs text-red-600 hover:underline font-bold">Clear Completed/Dropped</button>
            </div>
            
            <div className="bg-white border border-slate-300 rounded shadow-sm flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto">
                {history.map((lot: any) => (
                  <div key={lot.id} className="flex justify-between items-center p-4 border-b border-slate-200 hover:bg-slate-50">
                    <div>
                      {/* Safely handle potential null statuses with optional chaining (?.) */}
                      <div className="font-mono font-bold text-slate-800">{lot.apiary_id} <span className="text-xs text-blue-600 ml-2 uppercase">[{lot.status?.replace(/_/g, ' ')}]</span></div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{new Date(lot.created_at).toLocaleString()} • {lot.quantity_kg}kg</div>
                      
                      {/* State 1: Invoice Sent, Awaiting Buyer Payment */}
                      {lot.status === 'payment_pending' && (
                        <div className="flex items-center gap-3 mt-2">
                          <div className="text-sm font-bold text-amber-600">Pending Payout: ${lot.final_payout?.toFixed(2)} (Awaiting Buyer)</div>
                        </div>
                      )}

                      {/* State 2: Fully Paid & Receipt Generated */}
                      {/* State 2: Fully Paid & Receipt Generated */}
                      {lot.status === 'sold_to_processor' && (
                        <div className="flex items-center gap-3 mt-2">
                          <div className="text-sm font-bold text-green-700">Payout Cleared: ${lot.final_payout?.toFixed(2)} (95% Share)</div>
                          <button onClick={() => downloadBeekeeperReceipt(lot)} className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded font-bold cursor-pointer">📄 Receipt {lot.receipt_id}</button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 border rounded text-xs font-bold uppercase ${lot.ai_status === 'Normal' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                        {lot.ai_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}