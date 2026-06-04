/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Send, Smartphone, Database as DbIcon, RefreshCcw, LogOut, CheckCircle, XCircle } from "lucide-react";
import { motion } from "motion/react";

// --- Types ---
type Message = { id: string; sender: "system" | "user"; text: string };
type Client = { id: number; name: string; phone: string; pickup: string; destination: string; proposed_payment: number };
type Driver = { id: number; name: string; phone: string; vehicle_type: string; status: string; license_plate: string; cost_per_km: number };

export default function App() {
  const [phoneNumber, setPhoneNumber] = useState("+263771234567");
  const [isPhoneSet, setIsPhoneSet] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [clients, setClients] = useState<Client[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chats
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch db data
  const fetchData = async () => {
    setDbLoading(true);
    try {
      const res = await fetch("/api/data");
      const data = await res.json();
      setClients(data.clients || []);
      setDrivers(data.drivers || []);
    } catch (e) {
      console.error("Failed to load db data", e);
    }
    setDbLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const sendUssdMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: phoneNumber, message: text }),
      });
      const data = await res.json();
      
      const sysMsg: Message = { id: (Date.now() + 1).toString(), sender: "system", text: data.reply };
      setMessages((prev) => [...prev, sysMsg]);
      fetchData(); // immediately update DB after interation
    } catch (e) {
      const errMsg: Message = { id: (Date.now() + 1).toString(), sender: "system", text: "Network error simulating SMS." };
      setMessages((prev) => [...prev, errMsg]);
    }
    setIsLoading(false);
  };

  const handleStartSession = () => {
    if (phoneNumber.length > 5) {
      setMessages([]);
      setIsPhoneSet(true);
      sendUssdMessage("Hi"); // Initial trigger
    }
  };

  const clearDatabase = async () => {
    if (confirm("Are you sure you want to clear all HandeiData?")) {
      await fetch("/api/clear", { method: "POST" });
      fetchData();
      setMessages([]);
      setIsPhoneSet(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col md:flex-row p-4 md:p-8 gap-8 font-sans">
      
      {/* LEFT PANE: Mobile Phone Simulator */}
      <div className="w-full md:w-1/3 flex justify-center items-start pt-4">
        <div className="w-full max-w-[360px] bg-slate-800 rounded-[3rem] p-4 border-[12px] border-slate-950 shadow-2xl relative shadow-slate-900/50 h-[720px] flex flex-col overflow-hidden">
          {/* Phone Notch/Status Bar */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-b-2xl z-10 flex justify-center items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
            <div className="w-8 h-1.5 rounded-full bg-slate-800"></div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-50 text-slate-800 rounded-3xl overflow-hidden mt-6 relative shadow-inner">
            
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 flex items-center justify-between shadow-md z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm leading-tight">Handei USSD</h2>
                  <p className="text-[10px] text-indigo-100 opacity-80">SMS Simulator</p>
                </div>
              </div>
              {isPhoneSet && (
                <button onClick={() => setIsPhoneSet(false)} className="text-white/70 hover:text-white" title="Change Number">
                   <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Chat Area / Setup Area */}
            {!isPhoneSet ? (
              <div className="flex-1 p-6 flex flex-col justify-center items-center text-center gap-4 bg-slate-100">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-2 shadow-sm">
                  <Smartphone className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-lg text-slate-800">Enter Phone Number</h3>
                <p className="text-xs text-slate-500 mb-2">Since this is an SMS simulator, specify your "fake" phone number to act as identity.</p>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-center font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all shadow-sm"
                  placeholder="+263..."
                />
                <button
                  onClick={handleStartSession}
                  className="w-full px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-md active:scale-[0.98]"
                >
                  Start USSD Session
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#f0f2f5]">
                {messages.length === 0 && (
                  <div className="text-center text-xs text-slate-400 mt-10">Initializing session...</div>
                )}
                {messages.map((msg) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`px-4 py-3 rounded-2xl max-w-[85%] text-[13px] shadow-sm tracking-tight leading-relaxed whitespace-pre-wrap ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-white text-slate-800 rounded-bl-sm border border-slate-100"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                     <div className="px-4 py-3 bg-white text-slate-500 rounded-2xl rounded-bl-sm border border-slate-100 flex gap-1 items-center shadow-sm">
                       <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-75"></div>
                       <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-150"></div>
                       <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-300"></div>
                     </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input Area */}
            {isPhoneSet && (
              <div className="p-3 bg-white border-t border-slate-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendUssdMessage(inputText);
                  }}
                  className="flex gap-2 relative"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type reply..."
                    className="flex-1 px-4 py-3 pr-12 bg-slate-100 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                    disabled={isLoading}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
          
          {/* Home Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-700 rounded-full opacity-50"></div>
        </div>
      </div>

      {/* RIGHT PANE: System Dashboard */}
      <div className="flex-1 flex flex-col overflow-hidden max-h-screen pb-8 relative pt-4">
        
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
              Handei Data <span className="text-xl font-light text-slate-400">| Logistics Admin</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Real-time persistent SQLite database viewer</p>
          </div>
          <div className="flex gap-3">
             <button onClick={fetchData} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 font-medium transition-all shadow-sm flex items-center gap-2">
               <RefreshCcw className={`w-4 h-4 ${dbLoading ? 'animate-spin text-indigo-400' : ''}`} />
               Refresh
             </button>
             <button onClick={clearDatabase} className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/50 rounded-lg text-sm font-medium transition-all shadow-sm">
               Reset DB
             </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-8">
          
          {/* Drivers Table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl flex flex-col shadow-lg backdrop-blur-sm">
             <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80 rounded-t-2xl">
               <h2 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
                 <DbIcon className="w-5 h-5 text-emerald-400" />
                 Drivers 
                 <span className="bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold ml-2">{drivers.length}</span>
               </h2>
             </div>
             
             <div className="p-5 overflow-auto">
               {drivers.length === 0 ? (
                 <div className="text-center py-12 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                   No drivers registered yet. Use the simulator to register a driver.
                 </div>
               ) : (
                 <div className="space-y-4">
                   {drivers.map(d => (
                     <div key={d.id} className="bg-slate-900/60 p-4 rounded-xl border border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-slate-600 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                           <div>
                              <h3 className="font-semibold text-white text-base leading-tight">{d.name}</h3>
                              <p className="text-slate-400 text-xs mt-1 font-mono tracking-wider">{d.phone}</p>
                           </div>
                           <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${d.status === 'available' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                             {d.status === 'available' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                             {d.status}
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-y-3 mt-1 pt-3 border-t border-slate-700/50">
                           <div>
                             <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Vehicle</p>
                             <p className="text-slate-200 text-sm font-medium">{d.vehicle_type}</p>
                           </div>
                           <div>
                             <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Plate</p>
                             <p className="text-slate-200 text-sm font-mono bg-slate-800 px-2 py-0.5 rounded inline-block border border-slate-700">{d.license_plate}</p>
                           </div>
                           <div>
                             <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Cost/km</p>
                             <p className="text-emerald-400 text-sm font-bold bg-emerald-400/10 inline-block px-1.5 py-0.5 rounded">${d.cost_per_km.toFixed(2)}</p>
                           </div>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
          
          {/* Clients Table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl flex flex-col shadow-lg backdrop-blur-sm">
             <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80 rounded-t-2xl">
               <h2 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
                 <DbIcon className="w-5 h-5 text-indigo-400" />
                 Client Journeys 
                 <span className="bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold ml-2">{clients.length}</span>
               </h2>
             </div>
             
             <div className="p-5 overflow-auto">
               {clients.length === 0 ? (
                 <div className="text-center py-12 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                   No clients registered yet. Use the simulator to book a ride.
                 </div>
               ) : (
                 <div className="space-y-4">
                   {clients.map(c => (
                     <div key={c.id} className="bg-slate-900/60 p-4 rounded-xl border border-slate-700 shadow-sm hover:border-slate-600 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                           <div>
                              <h3 className="font-semibold text-white text-base leading-tight">{c.name}</h3>
                              <p className="text-slate-400 text-xs mt-1 font-mono tracking-wider">{c.phone}</p>
                           </div>
                           <div className="text-right">
                             <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Budget</p>
                             <p className="text-emerald-400 text-sm font-bold bg-emerald-400/10 inline-block px-2 py-0.5 rounded border border-emerald-400/20">${c.proposed_payment}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-700/50">
                           <div className="flex-1">
                             <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Pickup</p>
                             <p className="text-slate-200 text-sm font-medium pr-2 truncate" title={c.pickup}>{c.pickup}</p>
                           </div>
                           <div className="w-6 h-px bg-slate-600 relative">
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t border-r border-slate-400 rotate-45 mr-0.5"></div>
                           </div>
                           <div className="flex-1 text-right">
                             <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Dropoff</p>
                             <p className="text-slate-200 text-sm font-medium pl-2 truncate" title={c.destination}>{c.destination}</p>
                           </div>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
          
        </div>
      </div>
      
    </div>
  );
}

