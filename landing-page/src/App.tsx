import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db, googleProvider } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import './index.css';

// The Cyber-Rewind / Kinetic Void Dashboard
const OperatorDashboard = ({ 
  user, 
  onLogout, 
  isDemo = false,
  isDarkMode = true,
  setIsDarkMode = () => {}
}: { 
  user: User; 
  onLogout: () => void; 
  isDemo?: boolean;
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean) => void;
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'entry' | 'history' | 'assets'>('history');
  const [syncing, setSyncing] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', url: '', timestamp: '' });
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [isHistoryGridView, setIsHistoryGridView] = useState(true);

  useEffect(() => {
    // ULTIMATE GUARD: Never attempt a live connection in demo mode or without a user
    if (isDemo || !user || !user.uid || user.uid === 'demo') {
      console.log('[Dashboard] Operational Mode: LOCAL_DEMO');
      return; 
    }

    try {
      const historyRef = collection(db, 'users', user.uid, 'history');
      const q = query(historyRef, orderBy('savedAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistory(data);
      }, (err) => {
        console.warn('[Dashboard] Sync interrupted:', err.message);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error('[Dashboard] Initialization failure:', err);
    }
  }, [user, isDemo]);

  const handleRefresh = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2000);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title) return;
    setAddStatus('saving');
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const entryId = `void_${Date.now()}`;
      await setDoc(doc(db, 'users', user.uid, 'history', entryId), {
        title: addForm.title,
        url: addForm.url || null,
        formattedTime: addForm.timestamp || '0:00:00',
        progress: 0,
        savedAt: new Date().toISOString(),
        thumbnail: null,
      });
      setAddStatus('done');
      setTimeout(() => { 
        setAddStatus('idle'); 
        setAddForm({ title: '', url: '', timestamp: '' });
        setActiveTab('history');
      }, 1500);
    } catch {
      setAddStatus('error');
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (!confirm('DELETE_THIS_TRACE?')) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'users', user.uid, 'history', id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleClearAllHistory = async () => {
    if (!confirm('CLEAR_ENTIRE_NEURAL_LOG? THIS CANNOT BE UNDONE.')) return;
    try {
      const { writeBatch, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      history.forEach(item => {
        batch.delete(doc(db, 'users', user.uid, 'history', item.id));
      });
      await batch.commit();
    } catch (err) {
      console.error('Clear error:', err);
    }
  };

  // Derived Stats
  const totalVideos = history.length;
  const parseTimeToSeconds = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  };

  const totalSecs = history.reduce((acc, curr) => acc + parseTimeToSeconds(curr.formattedTime), 0);
  const totalHours = (totalSecs / 3600).toFixed(1);

  // Analytics Helpers
  const getDensityData = () => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const now = new Date();
    const last7 = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      return { day: days[d.getDay()], date: d.toDateString(), hours: 0 };
    });

    history.forEach(item => {
      const itemDate = new Date(item.savedAt).toDateString();
      const index = last7.findIndex(d => d.date === itemDate);
      if (index !== -1) {
        last7[index].hours += parseTimeToSeconds(item.formattedTime) / 3600;
      }
    });

    const maxHours = Math.max(...last7.map(d => d.hours), 1);
    return last7.map(d => ({ ...d, pct: (d.hours / maxHours) * 100 }));
  };

  const shadowNodes = [
    { name: 'YOUTUBE_v3', domain: 'youtube.com', clr: 'var(--brand-yellow)', pct: 64 },
    { name: 'NETFLIX_CORE', domain: 'netflix.com', clr: 'var(--brand-yellow)', pct: 22 },
    { name: 'TWITCH_SYNC', domain: 'twitch.tv', clr: 'var(--brand-yellow)', pct: 14 },
  ];

  const getTopNodes = () => {
    const counts: Record<string, number> = {};
    history.forEach(item => {
      if (!item.url) return;
      try {
        const domain = new URL(item.url).hostname.replace('www.', '');
        counts[domain] = (counts[domain] || 0) + 1;
      } catch {}
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([domain, count]) => ({
        name: domain.split('.')[0].toUpperCase(),
        pct: Math.round((count / total) * 100),
        clr: 'var(--brand-yellow)'
      }));
  };

  const densityData = getDensityData();
  const topNodes = getTopNodes();
  const displayNodes = topNodes.length > 0 ? topNodes : shadowNodes;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className={`${isDemo ? 'absolute inset-0 z-50 border-4 border-brand-pink shadow-[0_0_50px_rgba(229,17,82,0.3)]' : 'fixed inset-0 z-[60]'} bg-bg-primary flex font-['Space_Grotesk'] text-text-primary overflow-hidden`}
    >
      <div className="scanline"></div>
      
      {/* LEFT MOST THIN BAR */}
      {!isDemo && (
        <div className="w-16 border-r border-border-primary/30 flex flex-col items-center py-6 gap-8 shrink-0 bg-bg-primary">
          <div className="w-8 h-8 bg-brand-pink flex items-center justify-center">
            <span className="material-symbols-outlined text-sm text-white">dashboard</span>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-10 h-10 border-2 border-border-primary flex items-center justify-center hover:bg-brand-pink transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-sm">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <div className="vertical-text text-[10px] text-gray-500 font-black tracking-[0.2em] uppercase mt-auto pb-8 whitespace-nowrap -rotate-180" style={{ writingMode: 'vertical-rl' }}>
            NODE_OPERATOR_v3.1
          </div>
        </div>
      )}

      {/* PRIMARY SIDEBAR */}
      <div className={`${isDemo ? 'w-[140px]' : 'w-[200px] md:w-[260px]'} bg-bg-secondary border-r-2 border-brand-pink flex flex-col justify-between py-8 shrink-0`}>
        <div>
          <div className="px-8 mb-12">
            <h3 className="text-[#e51152] font-black text-xs tracking-widest uppercase mb-1">{isDemo ? 'VOID_SIM' : 'VOID_OPERATOR'}</h3>
            <p className="text-gray-500 text-[10px] uppercase font-bold">{isDemo ? 'DEMO_NODE' : 'LEVEL 04 ANALYST'}</p>
          </div>
          
          <nav className="flex flex-col">
              {[
                { id: 'history', icon: 'history', label: 'USER HISTORY', active: activeTab === 'history' },
                { id: 'dashboard', icon: 'bar_chart', label: 'ANALYTICS', active: activeTab === 'analytics' },
                { id: 'entry', icon: 'add_box', label: 'MANUAL ENTRY', active: activeTab === 'entry' },
              ].map(item => (
                <button 
                 key={item.id}
                 onClick={() => {
                   if (item.id === 'history') setActiveTab('history');
                   if (item.id === 'dashboard') setActiveTab('analytics');
                   if (item.id === 'entry') setActiveTab('entry');
                 }}
                 className={`py-6 px-8 flex items-center gap-4 text-xs font-black tracking-widest transition-all border-l-4 ${item.active ? 'bg-brand-pink text-white border-border-primary' : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-border-primary/5'}`}>
                  <span className="material-symbols-outlined text-sm">{item.icon}</span>
                  {isDemo ? item.label.split(' ')[1] || item.label : item.label}
                </button>
              ))}
          </nav>
        </div>

        <div className="px-8">
           <div className="bg-bg-primary p-4 flex gap-3 items-center border border-border-primary/10 mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-yellow overflow-hidden">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} alt="" />
              </div>
              <div>
                <p className="text-[10px] font-black text-brand-yellow uppercase tracking-tighter">SYSTEM ACTIVE</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase truncate w-[120px]">{user.displayName || 'RE_WIND_01'}</p>
              </div>
           </div>
           <button onClick={onLogout} className="text-[10px] font-black text-gray-500 hover:text-text-primary flex items-center gap-2 tracking-widest uppercase mb-4">
             <span className="material-symbols-outlined text-sm">power_settings_new</span> {isDemo ? 'EXIT_DEMO' : 'LOGOUT'}
           </button>
            <a href="/docs" target="_blank" rel="noreferrer" className="text-[8px] font-black text-gray-600 hover:text-brand-pink flex items-center gap-2 tracking-[0.2em] uppercase mb-2">
              <span className="material-symbols-outlined text-xs">description</span> SYSTEM_DOCS_v2.0
            </a>
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-[8px] font-black text-gray-600 hover:text-brand-pink flex items-center gap-2 tracking-[0.2em] uppercase mb-2">
              <span className="material-symbols-outlined text-xs">shield</span> PRIVACY_POLICY_v1.0
            </a>
            <a href="/terms" target="_blank" rel="noreferrer" className="text-[8px] font-black text-gray-600 hover:text-brand-pink flex items-center gap-2 tracking-[0.2em] uppercase">
              <span className="material-symbols-outlined text-xs">gavel</span> TERMS_OF_SERVICE
            </a>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="cyber-grid absolute inset-0 pointer-events-none opacity-20"></div>

        {/* TOP NAV BAR */}
        <header className={`${isDemo ? 'h-14 px-4' : 'h-20 px-10'} border-b border-brand-pink/30 flex items-center justify-between shrink-0 bg-bg-secondary/50 backdrop-blur-sm relative z-10`}>
          <div className="flex items-center gap-6">
            <h1 className={`${isDemo ? 'text-sm' : 'text-xl'} text-[#e51152] font-black italic tracking-tighter uppercase glitch-text`}>CYBER-REWIND</h1>
            {!isDemo && (
              <nav className="flex gap-8 text-[11px] font-black tracking-widest uppercase text-text-secondary">
               {['history', 'analytics', 'entry', 'assets'].map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab as any)} className={`transition-all pb-1 border-b-2 ${activeTab === tab ? 'text-text-primary border-brand-yellow' : 'border-transparent hover:text-text-primary'}`}>
                   {tab}
                 </button>
               ))}
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-6">
             <button 
              onClick={handleRefresh}
              className={`bg-brand-yellow text-black h-10 px-6 font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all ${syncing ? 'animate-pulse opacity-50' : ''}`}>
               <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>sync</span> REFRESH_SYNC
             </button>
             <button 
              onClick={onLogout}
              className="material-symbols-outlined text-gray-400 hover:text-brand-pink transition-all active:scale-90 cursor-pointer"
              title="Logout"
             >
               power_settings_new
             </button>
             <div className={`${isDemo ? 'w-8 h-8' : 'w-10 h-10'} border-2 border-brand-pink p-0.5`}>
               <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} className="w-full h-full object-cover" alt="" />
             </div>
          </div>
        </header>

        {/* CONTENT SWITCHER */}
        <div className={`flex-1 overflow-y-auto ${isDemo ? 'p-4' : 'p-12'} custom-scrollbar relative z-10`}>
          <AnimatePresence mode="wait">
            
            {/* ── ANALYTICS VIEW ── */}
            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="max-w-7xl mx-auto"
              >
                <header className={isDemo ? 'mb-4' : 'mb-10'}>
                  <p className="text-brand-yellow font-black text-[10px] tracking-[0.3em] mb-2 uppercase">SYSTEM.LOG_v04</p>
                  <h2 className={`${isDemo ? 'text-3xl' : 'text-6xl md:text-8xl'} font-black uppercase italic leading-none tracking-tighter text-text-primary`}>REWIND <span className="text-brand-pink block">ANALYTICS</span></h2>
                  {!isDemo && (
                    <div className="bg-bg-secondary border-l-4 border-border-primary mt-4 p-4 inline-block">
                    <p className="text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">STATUS</p>
                      <p className="font-black text-sm tracking-widest uppercase text-text-primary">NODE_SYNCED</p>
                    </div>
                  )}
                </header>

                <div className="flex flex-col lg:flex-row gap-8 mb-12">
                   {/* STAT CARDS */}
                   <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'TOTAL VIDEOS', val: totalVideos, icon: 'movie' },
                        { label: 'HOURS WATCHED', val: totalHours, icon: 'schedule' },
                        { label: 'SESSION_STREAK', val: '0D', icon: 'bolt' },
                        { label: 'RECORD_VOLUME', val: `${history.length}u`, icon: 'database' },
                      ].map((item, idx) => (
                        <div key={idx} className="neo-card p-6 relative group overflow-hidden">
                           <div className="absolute top-0 right-0 w-8 h-8 bg-brand-pink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <span className="material-symbols-outlined text-white text-sm">{item.icon}</span>
                           </div>
                           <p className="text-[10px] font-black text-brand-pink tracking-widest uppercase mb-6 flex justify-between">
                             {item.label} <span className="material-symbols-outlined text-[10px]">{item.icon}</span>
                           </p>
                           <p className="text-5xl font-black tracking-tighter">{item.val}</p>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* DENSITY CHART */}
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    <div className="neo-card p-8 min-h-[350px] relative">
                       <div className="flex justify-between items-start mb-12">
                          <h3 className="font-black uppercase text-xl italic tracking-widest">7-DAY_PLAYBACK_DENSITY</h3>
                          <p className="text-brand-yellow font-black text-[10px] tracking-widest">UNIT: HRS/DAY</p>
                       </div>
                       <div className="flex items-end justify-between h-48 gap-4 px-4">
                           {densityData.map((d) => (
                            <div key={d.date} className="flex-1 flex flex-col items-center gap-4">
                               <div className="w-full bg-bg-secondary relative group flex items-end" style={{ height: `${d.pct}%` }}>
                                  <div className="w-full bg-brand-pink group-hover:bg-brand-yellow transition-colors duration-300" style={{ height: '100%' }}></div>
                                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-brand-pink opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {d.hours.toFixed(1)}h
                                  </div>
                                </div>
                               <span className="text-[10px] font-black text-gray-500 tracking-widest">{d.day}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="neo-card p-8 min-h-[250px]">
                       <div className="flex justify-between items-start mb-8">
                          <h3 className="font-black uppercase text-xl italic tracking-widest">CUMULATIVE_TIME_LOG</h3>
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-brand-yellow"></div>
                             <span className="text-gray-500 text-[10px] font-black">NODE_01</span>
                          </div>
                       </div>
                       <div className="relative h-32 w-full">
                          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                            <path 
                              d="M0,100 L50,80 L100,90 L150,60 L200,75 L250,40 L300,55 L350,20 L400,30 L450,10 L500,25" 
                              fill="none" stroke="var(--brand-yellow)" strokeWidth="4" vectorEffect="non-scaling-stroke" 
                            />
                             {/* Static visualization placeholders */}
                             <desc>Cumulative watch time spline</desc>
                          </svg>
                          <div className="flex justify-between mt-6 text-[10px] font-black text-gray-600">
                             <span>00:00</span>
                             <span>06:00</span>
                             <span>12:00</span>
                             <span>18:00</span>
                             <span>23:59</span>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* SIDE PANELS */}
                  <div className="flex flex-col gap-8">
                     <div className="neo-card p-6">
                        <h3 className="font-black uppercase text-xs tracking-widest mb-6">TOP_STREAMING_NODES</h3>
                       <div className="flex flex-col gap-6">
                          {displayNodes.map(node => (
                            <div key={node.name}>
                               <div className="flex justify-between text-[10px] font-black mb-2 tracking-widest">
                                 <span>{node.name}</span>
                                 <span className="text-brand-pink">{node.pct}%</span>
                               </div>
                               <div className="w-full h-4 bg-bg-secondary relative">
                                  <div className="h-full transition-all duration-1000" style={{ width: `${node.pct}%`, backgroundColor: node.clr }}></div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="neo-card bg-bg-secondary p-6 border-l-4 border-brand-yellow">
                       <h3 className="text-brand-yellow font-black uppercase text-[10px] tracking-widest mb-6 border-b border-border-primary/10 pb-2">SESSION_LOG</h3>
                       <div className="flex flex-col gap-4 text-[10px] font-bold">
                          <div className="flex gap-4">
                             <div className="w-2 h-2 mt-1 shrink-0 bg-brand-yellow"></div>
                             <div>
                               <p className="text-text-primary uppercase">SYNC COMPLETE</p>
                               <p className="text-gray-500 uppercase">OPERATOR: VOID_04 // TIME: {new Date().toLocaleTimeString()}</p>
                             </div>
                          </div>
                          <div className="flex gap-4">
                             <div className="w-2 h-2 mt-1 shrink-0 bg-brand-yellow"></div>
                             <div>
                               <p className="text-text-primary uppercase">DATABASE LINK EST.</p>
                               <p className="text-gray-500 uppercase">STATUS: SYNCED_ACTIVE</p>
                             </div>
                          </div>
                          <div className="flex gap-4 opacity-50">
                             <div className="w-2 h-2 mt-1 shrink-0 bg-brand-yellow animate-pulse"></div>
                             <div>
                               <p className="text-text-primary uppercase">ACTIVE TRACKING...</p>
                               <p className="text-gray-500 uppercase">PORT_LISTENING: 8080</p>
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── ENTRY VIEW ── */}
            {activeTab === 'entry' && (
              <motion.div 
                key="entry" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto py-10"
              >
                <div className="flex flex-col lg:flex-row gap-16 items-start">
                   <div className="flex-1 w-full">
                      <div className="mb-12">
                        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-text-primary italic leading-tight">
                          ADD ENTRY <span className="text-brand-pink block">MANUALLY</span>
                        </h2>
                        <div className="h-2 w-32 bg-brand-yellow mt-4"></div>
                        <p className="text-gray-500 font-black text-[10px] tracking-[0.2em] mt-8 uppercase">MANUAL OVERRIDE FOR NON-SYNCED STREAM DATA CLUSTERS.</p>
                      </div>

                      <form onSubmit={handleAddEntry} className="flex flex-col gap-10">
                        <div className="flex flex-col gap-4">
                          <label className="text-xs font-black text-gray-500 tracking-[0.2em] uppercase">VIDEO TITLE</label>
                          <input 
                            required value={addForm.title} onChange={e => setAddForm(f=>({...f, title: e.target.value}))}
                            placeholder="ENTER CORE DESIGNATION" className="input-cyber" 
                          />
                        </div>
                        <div className="flex flex-col gap-4">
                          <label className="text-xs font-black text-gray-500 tracking-[0.2em] uppercase">VIDEO URL (OPTIONAL)</label>
                          <input 
                            value={addForm.url} onChange={e => setAddForm(f=>({...f, url: e.target.value}))}
                            placeholder="HTTPS://VOID.NET/REPLAY/772-X" className="input-cyber" 
                          />
                        </div>
                        <div className="flex flex-col gap-4">
                          <label className="text-xs font-black text-gray-500 tracking-[0.2em] uppercase">TIMESTAMP (E.G. 1:23:45)</label>
                          <input 
                            required value={addForm.timestamp} onChange={e => setAddForm(f=>({...f, timestamp: e.target.value}))}
                            placeholder="00:00:00" className="input-cyber" 
                          />
                        </div>
                        
                        <button 
                          type="submit"
                          disabled={addStatus === 'saving'}
                          className={`group h-24 relative overflow-hidden transition-all active:scale-95 border-2 border-brand-pink ${addStatus === 'saving' || addStatus === 'done' ? 'bg-white' : 'bg-brand-pink'}`}
                        >
                          <div className={`absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300`}></div>
                          <span className={`relative z-10 font-black text-3xl italic tracking-tighter uppercase flex items-center justify-center gap-4 ${addStatus === 'saving' || addStatus === 'done' ? 'text-black' : 'text-white group-hover:text-black'}`}>
                            {addStatus === 'saving' ? 'EXECUTING...' : addStatus === 'done' ? 'ENTRY_LOGGED ✓' : (
                              <>SAVE ENTRY <span className="material-symbols-outlined text-4xl">bolt</span></>
                            )}
                          </span>
                        </button>
                      </form>
                   </div>

                   {/* RIGHT SIDEBAR NOTES */}
                   <div className="w-full lg:w-[320px] flex flex-col gap-8">
                      <div className="neo-card bg-bg-secondary p-8 border-l-4 border-brand-pink">
                         <h3 className="text-brand-yellow font-black text-xs tracking-widest uppercase mb-4">METADATA LOGIC</h3>
                         <p className="text-gray-400 text-[10px] font-bold leading-relaxed uppercase">
                           MANUAL ENTRIES ARE PROCESSED THROUGH THE KINETIC VOID PROTOCOL. ENSURE ALL TIMESTAMPS ALIGN WITH UTC-0 OFFSET TO PREVENT SYNC FRAGMENTATION.
                         </p>
                      </div>
                      
                      <div className="bg-bg-primary border-2 border-border-primary/10 p-4 aspect-square flex flex-col relative overflow-hidden">
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-48 h-48 border-[1px] border-brand-pink/30 rounded-full animate-ping"></div>
                            <div className="absolute w-32 h-32 border-[2px] border-brand-yellow/50 rounded-full"></div>
                            <div className="absolute w-16 h-16 border-[4px] border-brand-pink rounded-full"></div>
                         </div>
                         <div className="mt-auto bg-bg-primary border border-border-primary/20 p-2 text-center relative z-10">
                            <p className="text-[8px] font-black tracking-widest text-text-primary uppercase italic">SYSTEM_READY</p>
                         </div>
                      </div>

                      <div className="border-2 border-dashed border-border-primary/20 p-6 flex flex-col gap-4">
                         <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-brand-pink"></div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">AUTO-ARCHIVE ENABLED</p>
                         </div>
                         <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-brand-pink"></div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">ENCRYPTED UPLINK</p>
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

             {/* ── HISTORY LIST VIEW (Fallover) ── */}
            {activeTab === 'history' && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto">
                 <div className="flex justify-between items-end border-b border-[#e51152] pb-6 mb-10">
                    <div className="flex items-center gap-6">
                       <h2 className="text-4xl font-black italic tracking-tighter uppercase">PLATFORM_LOGS</h2>
                       <div className="flex items-center gap-3 bg-bg-secondary p-1 border border-border-primary/20">
                          <button 
                            onClick={() => setIsHistoryGridView(true)}
                            className={`w-8 h-8 flex items-center justify-center transition-colors ${isHistoryGridView ? 'bg-brand-pink text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                             <span className="material-symbols-outlined text-sm">grid_view</span>
                          </button>
                          <button 
                            onClick={() => setIsHistoryGridView(false)}
                            className={`w-8 h-8 flex items-center justify-center transition-colors ${!isHistoryGridView ? 'bg-brand-pink text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                             <span className="material-symbols-outlined text-sm">view_list</span>
                          </button>
                       </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <button onClick={handleClearAllHistory} className="text-[10px] font-black text-brand-pink hover:bg-brand-pink hover:text-white px-2 py-1 border border-brand-pink transition-all uppercase tracking-widest">CLEAR_ALL_LOGS</button>
                       <p className="text-[10px] font-black text-gray-500 tracking-[0.4em]">TOTAL_RECORDS: {history.length}</p>
                    </div>
                 </div>
                 
                 <div className={isHistoryGridView ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                    {history.map(item => (
                      <div key={item.id} className={`neo-card group relative ${!isHistoryGridView ? 'p-4 flex gap-6 items-center' : 'p-4'}`}>
                         {/* Specific Delete Button */}
                         <button 
                           onClick={() => handleDeleteHistoryItem(item.id)}
                           className="absolute top-2 right-2 w-8 h-8 bg-black/80 text-brand-pink border border-brand-pink/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-brand-pink hover:text-white"
                           title="DELETE_TRACE"
                         >
                            <span className="material-symbols-outlined text-sm">delete</span>
                         </button>

                         <div className={`${isHistoryGridView ? 'h-40 mb-4' : 'w-48 h-28'} bg-black relative overflow-hidden shrink-0`}>
                            <img src={item.thumbnail || "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop"} className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                            <div className="absolute bottom-4 left-4">
                               <span className="bg-brand-yellow text-black text-[9px] font-black px-2 py-1 uppercase">{item.progress || 0}%_WATCHED</span>
                            </div>
                         </div>
                         <div className="flex-1 min-w-0">
                            <h4 className="font-black text-sm uppercase truncate mb-1">{item.title}</h4>
                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                               <p>{new Date(item.savedAt).toLocaleDateString()} • {item.formattedTime}</p>
                               <a href={item.url} target="_blank" rel="noreferrer" className="text-brand-pink hover:text-black hover:bg-brand-pink px-2 py-1 transition-colors">CONTINUE_WATCHING</a>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// The Setup Guide Component (Onboarding)
const SetupGuide = ({ onClose, browser }: { onClose: () => void, browser: 'chrome' | 'firefox' }) => {
  const [selectedBrowser, setSelectedBrowser] = useState<'chrome' | 'firefox'>(browser);

  return (
    <motion.div 
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed inset-0 z-[150] bg-[#0e0e0e] text-white font-['Space_Grotesk'] overflow-y-auto"
    >
      {/* Setup Header */}
      <div className="sticky top-0 w-full bg-black border-b-2 border-[#e51152] z-[160] flex justify-between items-center px-4 md:px-8 py-4">
        <div className="flex items-center gap-3">
           <div className="bg-[#e51152] text-white font-black text-[10px] px-2 py-1 italic tracking-widest">Rewind</div>
           <span className="material-symbols-outlined text-sm text-gray-500">help</span>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 border-2 border-[#e51152] flex items-center justify-center hover:bg-[#e51152] transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Title */}
        <div className="mb-16 border-l-[12px] border-[#f7e600] pl-6">
           <span className="bg-[#f7e600] text-black font-black text-[10px] md:text-sm uppercase px-3 py-1 mb-2 inline-block">BEGINNER'S ONBOARDING</span>
           <h1 className="text-5xl md:text-8xl font-black uppercase italic leading-[0.85] tracking-tighter">
             EASY <span className="text-[#e51152]">SETUP</span> GUIDE
           </h1>
        </div>

        {/* Browser Toggle */}
        <div className="flex border-4 border-white mb-20 overflow-hidden neo-shadow-white shrink-0">
           <button 
             onClick={() => setSelectedBrowser('chrome')}
             className={`flex-1 flex items-center justify-center gap-4 py-6 font-black uppercase text-sm md:text-xl transition-all ${selectedBrowser === 'chrome' ? 'bg-[#e51152] text-white' : 'bg-black text-white grayscale opacity-50 hover:opacity-100'}`}
           >
             <span>FOR</span>
             <img src="https://cdn.simpleicons.org/googlechrome/white" className="h-8 md:h-10" alt="Chrome Logo"/>
           </button>
           <button 
             onClick={() => setSelectedBrowser('firefox')}
             className={`flex-1 flex items-center justify-center gap-4 py-6 font-black uppercase text-sm md:text-xl transition-all ${selectedBrowser === 'firefox' ? 'bg-[#f7e600] text-black' : 'bg-black text-white grayscale opacity-50 hover:opacity-100'}`}
           >
             <span>FOR</span>
             <img src="https://cdn.simpleicons.org/firefoxbrowser/white" className="h-8 md:h-10" alt="Firefox Logo"/>
           </button>
        </div>

        {/* The Timeline Flow */}
        <div className="relative flex flex-col gap-32">
          {/* Central Connecting Line */}
          <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#e51152] via-[#f7e600] to-[#e51152] opacity-50 -translate-x-[2px]"></div>

          {/* Step 1 */}
          <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-12 h-12 bg-[#e51152] text-white font-black flex items-center justify-center text-xl neo-border relative z-10 md:absolute md:left-1/2 md:-translate-x-1/2">01</div>
            <div className="flex-1 md:pr-24 text-left md:text-right">
              <h3 className="text-2xl md:text-4xl font-black text-[#e51152] uppercase mb-4 tracking-tighter">STEP 1: GET THE FILES</h3>
              <p className="text-sm md:text-lg font-bold text-gray-400 font-['Manrope'] max-w-md md:ml-auto">
                First, head over to this link <a href="https://github.com/debugonaut/video-playback-tracker" target="_blank" rel="noreferrer" className="text-white underline hover:text-[#e51152]">GitHub</a>.
              </p>
              <div className="mt-6 flex flex-col items-start md:items-end gap-3">
                <span className="text-[10px] font-black uppercase text-[#e51152] tracking-widest leading-none">Download via:</span>
                <div className="relative group">
                  <img 
                    src="/github_code.png" 
                    alt="GitHub Code Button" 
                    className="h-12 md:h-16 border-2 border-white/20 group-hover:border-[#e51152] transition-colors"
                  />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#e51152] animate-ping"></div>
                </div>
              </div>
              <p className="mt-6 text-sm font-bold text-gray-500 font-['Manrope'] max-w-md md:ml-auto">
                Once downloaded, right-click the <span className="text-white font-black italic underline decoration-[#e51152]">ZIP file</span> and select "Extract All" to get the operational folder.
              </p>
            </div>
            <div className="flex-1 md:pl-24">
              <div className="bg-[#111] p-6 border-4 border-white neo-shadow-white relative overflow-hidden group">
                <div className="absolute top-2 right-2 flex gap-1">
                   <div className="w-2 h-2 rounded-full bg-red-500"></div>
                   <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                   <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <div className="flex flex-col items-center py-8">
                   <span className="material-symbols-outlined text-4xl text-[#e51152] mb-4">folder_zip</span>
                   <div className="text-[10px] font-black uppercase text-gray-500 mb-6">REWIND_GEN_2.0.ZIP</div>
                   <button className="bg-white text-black font-black text-[10px] px-6 py-2 uppercase border-2 border-black hover:bg-[#e51152] hover:text-white transition-colors">EXTRACT TO FOLDER</button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col-reverse md:flex-row gap-8 items-start md:items-center">
            <div className="flex-1 md:pr-24">
              <div className="bg-[#111] p-6 border-4 border-[#f7e600] neo-shadow-yellow text-left relative overflow-hidden group">
                <div className="flex items-center gap-3 border-b border-white/20 pb-4 mb-6">
                   <span className="material-symbols-outlined text-[#f7e600]">search</span>
                   <span className="text-xs font-black uppercase text-gray-400">Browser / Address Bar</span>
                </div>
                <div className="bg-black border-2 border-white p-4 flex items-center justify-between group-hover:border-[#f7e600] transition-colors">
                   <code className="text-[#f7e600] font-mono text-[10px] md:text-sm font-bold">
                     {selectedBrowser === 'chrome' ? 'chrome://extensions' : 'about:debugging'}
                   </code>
                   <span className="material-symbols-outlined text-sm text-gray-500 animate-pulse">input</span>
                </div>
                <div className="mt-4 text-[8px] font-black text-gray-600 uppercase tracking-[0.2em]">
                  PRESS_ENTER_TO_EXECUTE
                </div>
              </div>
            </div>
            <div className="w-12 h-12 bg-[#f7e600] text-black font-black flex items-center justify-center text-xl neo-border relative z-10 md:absolute md:left-1/2 md:-translate-x-1/2">02</div>
            <div className="flex-1 md:pl-24 text-left">
              <h3 className="text-2xl md:text-4xl font-black text-[#f7e600] uppercase mb-4 tracking-tighter">STEP 2: OPEN EXTENSIONS</h3>
              <p className="text-sm md:text-lg font-bold text-gray-400 font-['Manrope'] max-w-md">
                Now, open your browser's extension settings.
                <br/><br/>
                For {selectedBrowser === 'chrome' ? 'Chrome' : 'Firefox'}: {selectedBrowser === 'chrome' ? 'Click the 🧩 icon or type ' : 'Type '} 
                <span className="bg-gray-800 text-white px-2 py-0.5 font-mono text-[10px] md:text-xs border border-white/20">
                  {selectedBrowser === 'chrome' ? 'chrome://extensions' : 'about:debugging'}
                </span>
                {selectedBrowser === 'chrome' ? ' in your address bar.' : ' in the search bar to access developer dashboard'}
              </p>
              {selectedBrowser === 'firefox' && (
                <div className="mt-4 p-3 bg-[#e51152]/10 border-l-4 border-[#e51152] flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#e51152] text-sm">warning</span>
                  <div className="text-[10px] font-bold text-gray-400 uppercase leading-tight">
                    <span className="text-white">Note:</span> Firefox temporary add-ons reset after restart. 
                    <br/>
                    <span className="text-[#e51152] cursor-help" title="To stay permanent, use Firefox Developer Edition and set xpinstall.signatures.required to false in about:config">Learn how to make it permanent.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-12 h-12 bg-[#e51152] text-white font-black flex items-center justify-center text-xl neo-border relative z-10 md:absolute md:left-1/2 md:-translate-x-1/2">03</div>
            <div className="flex-1 md:pr-24 text-left md:text-right">
              <h3 className="text-2xl md:text-4xl font-black text-[#e51152] uppercase mb-4 tracking-tighter">
                {selectedBrowser === 'chrome' ? 'STEP 3: THE SECRET TOGGLE' : 'STEP 3: ACCESS SYSTEM'}
              </h3>
              <p className="text-sm md:text-lg font-bold text-gray-400 font-['Manrope'] max-w-md md:ml-auto uppercase">
                {selectedBrowser === 'chrome' ? (
                  <>
                    <span className="text-[#f7e600] font-black">CRITICAL STEP:</span> Look at the top right corner of the Extensions page. You <span className="italic">must</span> turn on <span className="text-white">Developer Mode</span>. The buttons we need will not appear until this is switched on.
                  </>
                ) : (
                  <>
                    <span className="text-[#f7e600] font-black">CRITICAL STEP:</span> Look at the left sidebar menu. You <span className="italic">must</span> select <span className="text-white">This Firefox</span> (or This Nightly). This will unlock the developer loading tools.
                  </>
                )}
              </p>
            </div>
            <div className="flex-1 md:pl-24">
              <div className="bg-[#111] p-0 border-4 border-white neo-shadow-pink flex justify-center items-center relative overflow-hidden group">
                 {selectedBrowser === 'chrome' ? (
                   <div className="p-8 flex items-center gap-4 bg-black/40 border-2 border-white/10 px-6 py-4">
                      <span className="text-[10px] md:text-xs font-black uppercase text-gray-400">Developer Mode</span>
                      <div className="w-12 h-6 bg-[#e51152] border-2 border-white relative cursor-pointer shadow-[0_0_15px_rgba(229,17,82,0.5)]">
                         <div className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-white"></div>
                      </div>
                   </div>
                 ) : (
                   <div className="relative w-full aspect-square md:aspect-video">
                      <img src="/firefox_guide.png" alt="Firefox Debugging Guide" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                      <div className="absolute bottom-4 left-4 right-4 bg-[#e51152] text-white p-2 text-[10px] font-black uppercase italic border border-white">
                        Access "This Firefox" in the sidebar
                      </div>
                   </div>
                 )}
                 <div className="absolute top-0 right-0 p-1 text-[6px] text-gray-700 uppercase font-black tracking-widest hidden group-hover:block">SYSTEM_OVERRIDE</div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="relative flex flex-col-reverse md:flex-row gap-8 items-start md:items-center mb-16">
            <div className="flex-1 md:pr-24">
               <div className="bg-[#111] border-4 border-[#f7e600] neo-shadow-yellow overflow-hidden relative group">
                  <img src="/manifest_select.png" alt="Manifest Selection" className="w-full h-48 object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                     <div className="bg-[#f7e600] text-black font-black p-4 neo-border uppercase text-xs italic scale-110">TARGET: manifest.json</div>
                  </div>
                  <div className="p-4 bg-black/80 flex gap-4">
                    <button className="flex-1 bg-[#e51152] text-white font-black text-[10px] md:text-xs py-4 border-2 border-black dark:border-white shadow-[4px_4px_0px_white]">
                      {selectedBrowser === 'chrome' ? 'LOAD UNPACKED' : 'LOAD TEMPORARY ADD-ON'}
                    </button>
                    <button className="flex-1 bg-transparent text-gray-500 font-black text-[10px] md:text-xs py-4 border-2 border-gray-700 cursor-not-allowed">PACK EXTENSION</button>
                  </div>
               </div>
            </div>
            <div className="w-12 h-12 bg-[#f7e600] text-black font-black flex items-center justify-center text-xl neo-border relative z-10 md:absolute md:left-1/2 md:-translate-x-1/2">04</div>
            <div className="flex-1 md:pl-24 text-left">
              <h3 className="text-2xl md:text-4xl font-black text-[#f7e600] uppercase mb-4 tracking-tighter">STEP 4: LOAD IT UP</h3>
              <p className="text-sm md:text-lg font-bold text-gray-400 font-['Manrope'] max-w-md">
                Click the <span className="text-white font-black italic">'{selectedBrowser === 'chrome' ? 'Load Unpacked' : 'Load Temporary Add-on'}'</span> button. A folder window (or file selector) will pop up. 
                <br/><br/>
                {selectedBrowser === 'chrome' ? (
                  <>Find the <span className="text-white font-black italic underline underline-offset-4 decoration-[#f7e600]">unzipped folder</span> and click <span className="text-white font-black italic">'Select Folder'</span>.</>
                ) : (
                  <>Navigate to the <span className="text-white font-black italic underline underline-offset-4 decoration-[#f7e600]">unzipped folder</span> and select the <span className="font-mono text-xs text-white">manifest.json</span> file.</>
                )}
                <br/><br/>
                The extension should appear instantly in your browser!
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-32 p-8 md:p-12 border-4 border-white bg-[#0e0e0e] neo-shadow-white relative transition-all">
          <div className="absolute -top-6 left-8 bg-[#e51152] text-white font-black text-xs md:text-sm px-6 py-2 uppercase border-2 border-black">NEED HELP?</div>
          <h2 className="text-3xl md:text-5xl font-black uppercase italic italic mb-12 tracking-tighter">COMMON ISSUES</h2>
          
          <div className="grid md:grid-cols-2 gap-12 border-t-2 border-white/10 pt-12">
            <div className="flex flex-col gap-8 flex-1">
              <div className="relative pl-6 border-l-4 border-[#e51152]">
                <h5 className="text-[#f7e600] font-black uppercase text-xs mb-1">Q: "I don't see Load Unpacked."</h5>
                <p className="text-sm font-bold text-gray-400 font-['Manrope']">Go back to Step 3 and toggle Developer Mode. The buttons remain hidden until that switch is active.</p>
              </div>
              <div className="relative pl-6 border-l-4 border-[#e51152]">
                <h5 className="text-[#f7e600] font-black uppercase text-xs mb-1">Q: "Manifest file missing?"</h5>
                <p className="text-sm font-bold text-gray-400 font-['Manrope']">Make sure you are selecting the <span className="italic">folder inside the zip</span>, not the zip file itself. The folder should contain a <span className="font-mono text-xs text-white">manifest.json</span> file.</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center md:items-end text-center md:text-right gap-6">
               <p className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-relaxed">Still stuck? Watch our 60-second visual walkthrough to see it in action.</p>
               <button className="bg-white text-black font-black uppercase py-4 px-10 neo-border neo-shadow-white hover:bg-[#e51152] hover:text-white transition-all flex items-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none">
                 <span className="material-symbols-outlined">play_circle</span>
                 WATCH VIDEO GUIDE
               </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        {/* Footer info */}
        <div className="mt-32 pb-16 border-t-4 border-white/10 pt-16 flex flex-col md:flex-row justify-between items-center gap-8 relative px-4 md:px-8">
           <SysStatus label="NODE_END_PT" status="online" />
           <div className="text-2xl font-black italic text-white uppercase tracking-tighter">EXT_GEN_2.0</div>
           <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-gray-500">
              <a href="/docs" target="_blank" rel="noreferrer" className="hover:text-white cursor-pointer transition-colors">DOCS</a>
              <a href="https://github.com/debugonaut/video-playback-tracker" target="_blank" rel="noreferrer" className="hover:text-white cursor-pointer transition-colors">GITHUB</a>
              <a href="mailto:aadeshkhande9202@gmail.com" className="hover:text-white cursor-pointer transition-colors">SUPPORT</a>
           </div>
           <div className="text-[10px] font-black uppercase text-gray-600">©Rewind</div>
        </div>
      </div>
    </motion.div>
  );
};

// The Benefits / Login explanation view
const BenefitsView = ({ onClose, onLogin, onSkip }: { onClose: () => void, onLogin: () => void, onSkip: () => void }) => {
  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8"
    >
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md cursor-pointer" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-[#0e0e0e] border-4 border-white p-8 md:p-12 neo-shadow-white overflow-y-auto max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-[#e51152] transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">close</span>
        </button>
        
        <div className="mb-12 border-b-4 border-[#e51152] pb-6">
           <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white">THE_BENEFITS</h2>
           <p className="text-[#e51152] font-black uppercase text-xs mt-2 tracking-[0.2em]">KNOW WHY TO LOGIN</p>
        </div>

        <div className="flex flex-col gap-10">
          <div className="flex gap-6 items-start group">
             <div className="w-12 h-12 bg-[#f7e600] border-2 border-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-black">sync</span>
             </div>
             <div>
                <h4 className="text-xl font-black uppercase mb-1 text-white">Cloud Sync</h4>
                <p className="text-sm font-bold text-gray-500 font-['Manrope']">Maintain your playback history across all devices. Start a video on Chrome, resume it on Firefox or mobile effortlessly.</p>
             </div>
          </div>

          <div className="flex gap-6 items-start group">
             <div className="w-12 h-12 bg-[#e51152] border-2 border-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-white">analytics</span>
             </div>
             <div>
                <h4 className="text-xl font-black uppercase mb-1 text-white">Advanced Dashboard</h4>
                <p className="text-sm font-bold text-gray-500 font-['Manrope']">Unlock detailed analytics of your watch patterns, detailed heatmaps, and total watch-time statistics in high-fidelity.</p>
             </div>
          </div>

          <div className="flex gap-6 items-start group">
             <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-black">shield</span>
             </div>
             <div>
                <h4 className="text-xl font-black uppercase mb-1 text-white">Optional Privacy</h4>
                <p className="text-sm font-bold text-gray-500 font-['Manrope']">Rewind is fully functional without login. We only require authentication if you want persistent history sync across platforms.</p>
             </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col sm:flex-row gap-4">
           <button 
             onClick={onLogin}
             className="flex-1 bg-white text-black font-black uppercase py-5 border-4 border-black hover:bg-[#e51152] hover:text-white transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
           >
              <span className="material-symbols-outlined">login</span>
              LOGIN / SIGN UP
           </button>
           <button 
             onClick={onSkip}
             className="flex-1 bg-transparent text-[#f7e600] font-black uppercase py-5 border-4 border-[#f7e600] hover:bg-[#f7e600] hover:text-black transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
           >
              <span className="material-symbols-outlined">person_off</span>
              CONTINUE_PRIVATELY
           </button>
        </div>
      </div>
    </motion.div>
  );
};

const TrackingDemo = () => {
  const [phase, setPhase] = useState('playing'); // playing, paused, popup, dashboard

  useEffect(() => {
    let t1: any, t2: any, t3: any, t4: any, t5: any;
    
    const runLoop = () => {
      setPhase('playing');
      
      // 1. Mouse enters and moves to center, clicks pause
      t1 = setTimeout(() => {
        setPhase('paused');
      }, 3500);
      
      // 2. The brutalist popup slides in aggressively
      t2 = setTimeout(() => {
        setPhase('popup');
      }, 4500);
      
      // 3. The mouse moves up to click the popup, opening dashboard
      t3 = setTimeout(() => {
        setPhase('dashboard');
      }, 6500);
      
      // 4. Reset sequence
      t4 = setTimeout(() => {
        runLoop();
      }, 12500);
    };

    runLoop();
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); }
  }, []);

  return (
    <div className="mt-20 mx-auto w-full max-w-5xl neo-border neo-shadow bg-[#131313] md:bg-black overflow-hidden aspect-[4/3] md:aspect-video relative flex flex-col justify-end group">
      {/* Background Simulating a Video Frame */}
      <img 
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${phase !== 'playing' ? 'opacity-30 grayscale-[80%]' : 'opacity-80'}`} 
        alt="Cyber Tracker Demo Reel" 
        src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2600&auto=format&fit=crop"
      />
      
      {/* UI Interaction Warning if in Dashboard phase */}
      {phase === 'dashboard' && (
        <div className="absolute top-4 left-4 z-[70] bg-brand-pink text-white text-[10px] font-black px-3 py-1 uppercase italic animate-pulse pointer-events-none border border-white">
          SIMULATED_INTERFACE // AUTO-EXIT IN 6s
        </div>
      )}
      
      {/* Play/Pause Overlay Icon */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <motion.div 
          animate={{ scale: phase === 'playing' ? 1 : 1.1, opacity: phase === 'playing' ? 0 : 0.9 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-black/80 backdrop-blur-md p-6 neo-border neo-shadow-white relative"
        >
          <span className="material-symbols-outlined text-6xl text-white">pause</span>
        </motion.div>
      </div>

      {/* The Cursor Simulation */}
      <motion.div
        className="absolute z-50 pointer-events-none drop-shadow-xl"
        initial={{ top: "120%", left: "50%", opacity: 0 }}
        animate={{
          left: phase === 'playing' ? "60%" : phase === 'paused' ? "50%" : phase === 'popup' ? "85%" : "85%",
          top: phase === 'playing' ? "120%" : phase === 'paused' ? "55%" : phase === 'popup' ? "85%" : "120%",
          scale: phase === 'dashboard' ? 0.8 : 1,
          opacity: phase === 'dashboard' ? 0 : 1
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-[-20deg]">
          <path d="M4.5 3.5L18.5 13L11 14L8 20L4.5 3.5Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </motion.div>

      {/* The Rewind Brutalist Notification Popup */}
      <AnimatePresence>
        {(phase === 'popup' || phase === 'dashboard') && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1, scale: phase === 'dashboard' ? 0.95 : 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`absolute bottom-6 md:bottom-16 right-4 md:right-10 bg-[#0e0e0e] text-white p-4 md:p-6 neo-border neo-shadow-pink z-40 flex flex-col gap-2 w-[85%] sm:w-[350px] ${phase === 'dashboard' ? 'opacity-0 scale-95 transition-all duration-300' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#e51152] text-2xl md:text-3xl">save</span>
              <h4 className="font-['Space_Grotesk'] font-black uppercase text-lg md:text-xl leading-none">Timestamp Saved</h4>
            </div>
            <p className="font-['Manrope'] text-xs md:text-sm text-gray-400 font-bold uppercase tracking-wide">
              Logged session at <span className="text-[#f7e600]">14:02</span>
            </p>
            <div className="mt-2 text-[10px] text-center font-bold text-gray-500 border border-gray-700 py-1 uppercase hidden md:block">Click to enter operations</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Explosion into Dashboard */}
      <AnimatePresence>
        {phase === 'dashboard' && (
          <OperatorDashboard 
            isDemo={true}
            user={{ displayName: 'SIMULATED_OPERATOR', photoURL: null, uid: 'demo' } as User} 
            onLogout={() => setPhase('playing')} 
          />
        )}
      </AnimatePresence>

      {/* Video Player HUD */}
      <div className="relative z-0 w-full p-4 md:p-6 bg-gradient-to-t from-black to-transparent flex flex-col gap-4 pointer-events-none">
        {/* Progress Bar */}
        <div className="w-full h-2 md:h-4 bg-gray-900 border-2 border-white/50 relative overflow-hidden">
          <motion.div 
            className="h-full bg-[#e51152] relative"
            initial={{ width: "0%" }}
            animate={{ width: phase === 'playing' ? "100%" : "35%" }}
            transition={{ duration: phase === 'playing' ? 15 : 0.5, ease: "linear" }}
          >
          </motion.div>
        </div>
        <div className="flex justify-between font-['Space_Grotesk'] font-bold text-white/50 uppercase text-[10px] md:text-sm drop-shadow-md">
          <span>{phase === 'playing' ? 'PLAYING...' : phase === 'dashboard' ? 'OPERATOR OVERRIDE' : 'SYSTEM PAUSED'}</span>
          <span>AUTOSAVE: ON</span>
        </div>
      </div>
    </div>
  );
};
const SysStatus = ({ label, status = 'online' }: { label: string, status?: 'online' | 'warning' | 'alert' }) => (
  <div className="flex items-center gap-2 px-3 py-1 border-2 border-black dark:border-white bg-[#111] absolute -top-4 -left-2 z-10 scale-75 md:scale-90 origin-left">
    <div className={`w-2 h-2 rounded-full animate-pulse ${
      status === 'online' ? 'bg-[#00ff9d]' : status === 'warning' ? 'bg-[#f7e600]' : 'bg-[#e51152]'
    }`}></div>
    <span className="text-[8px] font-black uppercase text-white tracking-[0.2em]">{label} // {status.toUpperCase()}</span>
  </div>
);

const NeuralStream = ({ speed = 1 }: { speed?: number }) => {
  const [dots, setDots] = useState<{ id: number, x: number, y: number, char: string, color: string }[]>([]);
  const chars = '01#X<>[]{}//';
  const colors = ['#e51152', '#f7e600', '#00ff9d', '#ffffff'];

  useEffect(() => {
    const createDot = () => ({
      id: Math.random(),
      x: Math.random() * 100,
      y: -10,
      char: chars[Math.floor(Math.random() * chars.length)],
      color: colors[Math.floor(Math.random() * colors.length)]
    });

    const interval = setInterval(() => {
      setDots(prev => [...prev.slice(-40), createDot()]);
    }, 200 / speed);

    return () => clearInterval(interval);
  }, [speed]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
      <AnimatePresence>
        {dots.map(dot => (
          <motion.div
            key={dot.id}
            initial={{ y: '-10%', opacity: 0 }}
            animate={{ y: '110%', opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3 / speed, ease: "linear" }}
            className="absolute font-mono text-[8px] md:text-[10px] font-black"
            style={{ left: `${dot.x}%`, color: dot.color }}
          >
            {dot.char}
            <div className="w-[1px] h-8 bg-gradient-to-t from-transparent via-current to-transparent opacity-20 mt-1"></div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};


const ComparisonGrid = () => (
  <section id="comparison" className="py-24 px-4 bg-white dark:bg-black transition-colors duration-500">
     <div className="max-w-6xl mx-auto">
        <div className="mb-16 border-l-8 border-[#e51152] pl-6 md:pl-10">
           <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter text-black dark:text-white">PRECISION_METRICS</h2>
           <p className="text-[#e51152] font-black uppercase text-xs mt-2 tracking-[0.3em]">REWIND_VS_LEGACY_HISTORY</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-4 border-black dark:border-white neo-shadow dark:neo-shadow-white group relative">
           <SysStatus label="DATA_INTEGRITY" status="online" />
           {/* Header Row */}
           <div className="bg-black text-white p-6 md:p-10 border-b-4 border-black dark:border-white">
              <h3 className="text-2xl font-black uppercase italic">Standard History</h3>
           </div>
           <div className="bg-[#e51152] text-white p-6 md:p-10 border-b-4 border-black dark:border-white">
              <h3 className="text-2xl font-black uppercase italic">Rewind Protocol</h3>
           </div>

           {[
             { label: 'Granularity', res1: 'Page URL only', res2: 'Millisecond Timestamp' },
             { label: 'Automation', res1: 'Manual Searching', res2: 'Automatic Injection' },
             { label: 'Persistence', res1: 'Cleared on Exit', res2: 'Encrypted Cloud Sync' },
             { label: 'Compatibility', res1: 'Variable', res2: 'Universal Data Layer' }
           ].map((row, i) => (
             <React.Fragment key={i}>
                <div className="p-6 md:p-8 border-b-2 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111] transition-colors">
                   <div className="text-[10px] font-black text-gray-400 uppercase mb-2">{row.label}</div>
                   <div className="text-lg font-bold text-black dark:text-gray-400 font-['Manrope']">{row.res1}</div>
                </div>
                <div className="p-6 md:p-8 border-b-2 border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0e0e] transition-colors relative h-full">
                   <div className="text-[10px] font-black text-[#e51152] uppercase mb-2">{row.label}</div>
                   <div className="text-lg font-black text-black dark:text-white uppercase italic">{row.res2}</div>
                   <div className="absolute top-4 right-4 w-2 h-2 bg-[#00ff9d] rounded-full animate-pulse shadow-[0_0_8px_#00ff9d]"></div>
                </div>
             </React.Fragment>
           ))}
        </div>
     </div>
  </section>
);

const ArchitectureXRay = () => {
  const [activeSegment, setActiveSegment] = useState<string | null>('DOM');
  
  const segments = [
    { id: 'DOM', title: 'DOM_INTERCEPTOR', desc: 'Real-time monitoring of <video> and <audio> tag creation using MutationObserver API.' },
    { id: 'STATE', title: 'STATE_ENGINE', desc: 'Calculates precise playback position every 500ms without impacting CPU overhead.' },
    { id: 'SYNC', title: 'SYNC_PROTOCOL', desc: 'Securely offloads data packets to local IndexedDB or encrypted cloud nodes.' }
  ];

  return (
    <section id="how-it-works" className="py-24 px-4 bg-black border-y-4 border-white dark:border-black overflow-hidden relative">
       <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1 w-full relative">
             <SysStatus label="X_RAY_OUTPUT" status="online" />
             <div className="border-4 border-white aspect-video bg-[#0e0e0e] p-4 relative group overflow-hidden neo-shadow-white">
                {/* Mock Player Wireframe */}
                <div className="w-full h-full border-2 border-dashed border-white/20 flex flex-col items-center justify-center p-8">
                   <div className="w-full h-2 bg-white/10 rounded-full mb-8 relative">
                      <motion.div 
                        initial={{ width: '30%' }}
                        animate={{ width: '70%' }}
                        transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
                        className="absolute inset-y-0 left-0 bg-[#e51152] shadow-[0_0_10px_#e51152]"
                      >
                         <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#e51152] rounded-full"></div>
                      </motion.div>
                   </div>
                   <div className="flex gap-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-12 h-12 border-2 border-white/40 flex items-center justify-center">
                           <div className="w-2 h-2 bg-white/20 rotate-45"></div>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Interactive Points */}
                {segments.map((s, i) => (
                  <motion.div
                    key={s.id}
                    onMouseEnter={() => setActiveSegment(s.id)}
                    className="absolute cursor-help"
                    style={{ 
                      top: i === 0 ? '30%' : i === 1 ? '50%' : '70%', 
                      left: i === 0 ? '25%' : i === 1 ? '55%' : '35%',
                      zIndex: 20
                    }}
                  >
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 border-black ${activeSegment === s.id ? 'bg-[#f7e600] scale-125 shadow-[0_0_20px_#f7e600]' : 'bg-white opacity-40 hover:opacity-100'}`}>
                        <span className="text-black font-black text-xs">{i+1}</span>
                     </div>
                  </motion.div>
                ))}
             </div>
          </div>

          <div className="flex-1">
             <div className="mb-12 border-b-2 border-white/10 pb-6">
                <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">INTERNAL_LOGIC</h2>
                <p className="text-gray-500 font-black uppercase text-[10px] mt-2 tracking-[0.3em]">REVERSE_ENGINEERING_THE_STACK</p>
             </div>

             <div className="flex flex-col gap-6">
                {segments.map((s) => (
                   <button 
                     key={s.id}
                     onClick={() => setActiveSegment(s.id)}
                     onMouseEnter={() => setActiveSegment(s.id)}
                     className={`p-6 border-4 text-left transition-all ${activeSegment === s.id ? 'bg-[#e51152] border-white translate-x-4 neo-shadow-white' : 'bg-[#111] border-white/10 hover:border-white/40'}`}
                   >
                      <h4 className={`text-xl font-black uppercase mb-1 ${activeSegment === s.id ? 'text-white' : 'text-[#e51152]'}`}>{s.title}</h4>
                      <p className={`text-sm font-bold font-['Manrope'] leading-relaxed ${activeSegment === s.id ? 'text-white' : 'text-gray-500'}`}>{s.desc}</p>
                   </button>
                ))}
             </div>
          </div>
       </div>
    </section>
  );
};

const AuthView = ({ onBack }: { onBack: () => void }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    if (reason === 'signup') {
      setMode('signup');
    }
  }, []);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const confirmPasswordRef = React.useRef<HTMLInputElement>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'sync' || params.get('reason') === 'extension_auth' || params.get('handler') === 'firefox') {
        const idToken = await user.getIdToken();
        
        if (idToken) {
          // 1. Content Script Bridge (Firefox + Backup)
          window.postMessage({ type: 'REWIND_AUTH_SUCCESS', token: idToken }, '*');
          
          // 2. Hash-based bridge (Firefox backup)
          if (params.get('handler') === 'firefox') {
             window.location.hash = `token=${idToken}`;
          }
          
          // 3. Chrome Direct Bridge (if ID is known - would require more config, using postMessage for now)
          
          setError(null);
          setLoading(false);
          // Show success message before closing
          document.body.innerHTML = `
            <div style="background:#000; color:#fff; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif;">
              <h1 style="color:#e51152; font-size:4rem; margin-bottom:0;">SYNC_SUCCESS</h1>
              <p style="text-transform:uppercase; letter-spacing:0.2em; color:#fff;">Neural Connection Established</p>
              <div style="margin-top:20px; color:#555; font-size:10px;">CLOSING PORTAL IN 3s...</div>
            </div>
          `;
          setTimeout(() => { window.close(); }, 3000);
          return;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailRef.current?.value || '';
    const password = passwordRef.current?.value || '';
    const confirmPassword = confirmPasswordRef.current?.value || '';
    
    if (!email || !password) return;
    
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let userCredential;
      if (mode === 'login') {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'sync' || params.get('reason') === 'extension_auth') {
        const idToken = await userCredential.user.getIdToken();
        window.postMessage({ type: 'REWIND_AUTH_SUCCESS', token: idToken }, '*');
        
        document.body.innerHTML = `
            <div style="background:#000; color:#fff; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif;">
              <h1 style="color:#f7e600; font-size:4rem; margin-bottom:0;">SYNC_SUCCESS</h1>
              <p style="text-transform:uppercase; letter-spacing:0.2em; color:#fff;">Email Identification Synchronized</p>
              <div style="margin-top:20px; color:#555; font-size:10px;">CLOSING PORTAL IN 3s...</div>
            </div>
        `;
        setTimeout(() => { window.close(); }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen bg-black text-white font-['Space_Grotesk'] overflow-hidden flex flex-col md:flex-row relative"
    >
      {/* 1. Left Side: Neural Stream Panel (Desktop only) */}
      <div className="hidden md:flex flex-[1.4] bg-[#0a0a0a] border-r-4 border-[#e51152] relative overflow-hidden flex-col justify-between p-12">
         <NeuralStream speed={2} />
         
         <div className="relative z-10">
            <button 
              onClick={onBack}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer group mb-12"
            >
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[#e51152] text-xl group-hover:-translate-x-1 transition-transform">fast_rewind</span>
                <span className="text-[#e51152] font-black text-sm md:text-base tracking-tighter">RE</span>
                <span className="bg-white text-black px-1.5 py-0.5 font-black text-sm md:text-base tracking-tighter">WIND</span>
              </div>
            </button>
            <h2 className="text-6xl lg:text-8xl font-black uppercase italic leading-[0.8] tracking-tighter mb-6">
              SYNCING <br /> <span className="text-[#e51152]">PLAYHEAD</span>S.
            </h2>
            <p className="text-gray-500 font-black uppercase text-xs tracking-[0.4em] max-w-sm">
              TRACKING_STATE // BUFFER_BYPASS // SESSION_SYNC
            </p>
         </div>

         <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center gap-4 border-l-2 border-[#e51152] pl-4">
               <div>
                  <div className="text-[10px] font-black uppercase text-gray-500">System Logs</div>
                  <div className="text-xs font-mono text-[#00ff9d]">AUTH_PROTOCOL_ESTABLISHED... OK</div>
               </div>
            </div>
            <div className="flex items-center gap-4 border-l-2 border-[#f7e600] pl-4">
               <div>
                  <div className="text-[10px] font-black uppercase text-gray-500">Security Layer</div>
                  <div className="text-xs font-mono text-[#f7e600]">ENCRYPTION_ACTIVE: AES-256-GCM</div>
               </div>
            </div>
         </div>

         {/* Scanline overlay */}
         <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-10"></div>
      </div>

      {/* 2. Right Side: Auth Form Terminal */}
      <div className="flex-1 bg-[#0e0e0e] flex flex-col relative">
         <header className="w-full h-16 border-b-2 border-white px-6 flex items-center justify-between md:hidden">
            <button onClick={onBack} className="flex items-center gap-1">
               <span className="text-[#e51152] font-black text-sm">RE</span>
               <span className="bg-white text-black px-1 py-0.5 font-black text-sm">WIND</span>
            </button>
            <button onClick={onBack} className="material-symbols-outlined text-white">close</button>
         </header>

         <main className="flex-1 flex flex-col justify-center p-6 md:p-12 lg:p-20 overflow-y-auto">
            <div className="max-w-md mx-auto w-full">
               <div className="mb-10 text-center md:text-left">
                  <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white mb-2 leading-none">INITIALIZE <br className="hidden md:block"/> <span className="text-[#e51152]">ACCOUNT.</span></h1>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Select your entry method below.</p>
               </div>

               {/* Binary Toggle */}
               <div className="flex justify-center md:justify-start mb-8">
                  <div className="flex border-2 border-black dark:border-white p-1 bg-gray-100 dark:bg-black relative">
                  <motion.div 
                     animate={{ x: mode === 'login' ? 0 : '100%' }}
                     transition={{ type: "spring", stiffness: 300, damping: 30 }}
                     className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-[#e51152] z-0"
                  />
                  <button 
                     onClick={() => setMode('login')}
                     className={`relative z-10 px-8 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${mode === 'login' ? 'text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                  >
                     LOGIN
                  </button>
                  <button 
                     onClick={() => setMode('signup')}
                     className={`relative z-10 px-8 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${mode === 'signup' ? 'text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                  >
                     SIGNUP
                  </button>
                  </div>
               </div>

               <div className="flex flex-col gap-6">
                  {error && (
                    <div className="bg-[#e51152]/10 border-2 border-[#e51152] p-4 text-[#e51152] font-black text-[10px] uppercase tracking-widest text-center">
                      ERROR: {error}
                    </div>
                  )}
                  {/* Google Auth */}
                  <button 
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-black text-white font-black uppercase py-4 flex items-center justify-center gap-3 hover:bg-[#e51152] transition-all text-[10px] tracking-widest border-2 border-black active:translate-x-1 active:translate-y-1 disabled:opacity-50"
                  >
                     <img src="https://cdn.simpleicons.org/google/fff" className="w-4 h-4" alt="Google" />
                     {loading ? 'PROCESSING...' : 'CONTINUE_WITH_GOOGLE'}
                  </button>

                  <div className="flex items-center gap-4">
                     <div className="h-[1px] flex-1 bg-black/10 dark:bg-white/10"></div>
                     <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.3em]">OR_USE_TERMINAL</span>
                     <div className="h-[1px] flex-1 bg-black/10 dark:bg-white/10"></div>
                  </div>

                  <form className="flex flex-col gap-4" onSubmit={handleEmailSubmit}>
                     <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IDENTIFIER (EMAIL)</label>
                        <input ref={emailRef} type="email" placeholder="[EMAIL_ADDRESS]" required className="bg-[#1a1a1a] border-2 border-white/20 text-white p-4 font-black text-xs uppercase tracking-widest focus:border-[#e51152] outline-none transition-colors placeholder:text-gray-600" />
                     </div>
                     <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                           <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">CREDENTIAL (PASSWORD)</label>
                           <button type="button" className="text-[8px] font-black text-[#e51152] hover:underline uppercase tracking-widest transition-colors">Forgot Password?</button>
                        </div>
                        <input ref={passwordRef} type="password" placeholder="••••••••" required minLength={6} className="bg-[#1a1a1a] border-2 border-white/20 text-white p-4 font-black text-xs tracking-widest focus:border-[#e51152] outline-none transition-colors" />
                     </div>

                     {mode === 'signup' && (
                        <div className="flex flex-col gap-2">
                           <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">CONFIRM_CREDENTIAL</label>
                           <input ref={confirmPasswordRef} type="password" placeholder="••••••••" required className="bg-[#1a1a1a] border-2 border-white/20 text-white p-4 font-black text-xs tracking-widest focus:border-[#e51152] outline-none transition-colors" />
                        </div>
                     )}
                     <button type="submit" disabled={loading} className="bg-[#e51152] text-white font-black uppercase py-5 text-sm border-2 border-white/20 neo-shadow hover:bg-black hover:text-[#f7e600] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all mt-4 disabled:opacity-50">
                        {loading ? 'PROCESSING...' : mode === 'login' ? 'EXECUTE_LOGIN' : 'CREATE_ACCOUNT'}
                     </button>
                  </form>
               </div>
            </div>
         </main>
         <div className="absolute bottom-6 right-6 pointer-events-none opacity-20 hidden md:block">
            <div className="text-right text-[10px] font-mono leading-tight">
               NODE_STABLE // REGION: US-EAST-1 <br />
               VERSION: 2.0.4_BETA
            </div>
         </div>
      </div>
    </motion.div>
  );
};

// The "Why Login" / Benefits Portal
const WhyLoginView = ({ onBack, onLogin }: { onBack: () => void, onLogin: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-[#0e0e0e] text-white font-['Space_Grotesk'] p-6 md:p-12 flex flex-col items-center justify-center relative overflow-hidden"
    >
      <div className="cyber-grid opacity-20"></div>
      
      <div className="max-w-4xl w-full relative z-10">
        <button onClick={onBack} className="mb-8 flex items-center gap-2 text-brand-pink font-black uppercase text-xs tracking-widest hover:translate-x-1 transition-transform">
          <span className="material-symbols-outlined">west</span> BACK_TO_SURFACE
        </button>

        <div className="border-4 border-white neo-shadow-white p-8 md:p-16 bg-black relative">
          <div className="absolute top-0 right-0 bg-brand-yellow text-black px-4 py-1 font-black text-[10px] uppercase tracking-tighter">
            UPGRADE_REQUIRED
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-8 leading-none">
            WHY <span className="text-brand-pink">SYNC?</span>
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
            {[
              { icon: 'cloud_sync', title: 'Cross-Device Persistence', desc: 'Your video markers follow you from desktop to laptop instantly. Never lose your place again.' },
              { icon: 'history', title: 'Unlimited Neural Log', desc: 'Extension storage is limited. Cloud Sync unlocks your full historical archive.' },
              { icon: 'insights', title: 'Deep Analytics', desc: 'Get weekly reports on your consumption entropy and site-specific focus metrics.' },
              { icon: 'security', title: 'Data Hardening', desc: 'Securely backup your manual entries and custom bookmarks in our encrypted void.' }
            ].map((item, i) => (
              <div key={i} className="flex gap-6 group">
                <div className="w-12 h-12 shrink-0 bg-brand-pink flex items-center justify-center neo-border group-hover:bg-brand-yellow group-hover:text-black transition-colors">
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <div>
                  <h3 className="font-black uppercase text-sm mb-1 tracking-widest text-brand-yellow">{item.title}</h3>
                  <p className="text-gray-400 text-sm font-bold leading-tight">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 flex flex-col md:flex-row gap-6">
            <button 
              onClick={onLogin}
              className="flex-1 bg-brand-pink text-white font-black uppercase py-5 text-xl neo-shadow hover:bg-white hover:text-black transition-all active:translate-x-1 active:translate-y-1"
            >
              INITIALIZE_SYNC
            </button>
            <button 
              onClick={onBack}
              className="flex-1 border-2 border-white text-white font-black uppercase py-5 text-xl hover:bg-white/10 transition-all"
            >
              STAY_OFFLINE
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'landing' | 'auth' | 'dashboard' | 'why-login' | 'profile'>('landing');
  const [onboardingBrowser, setOnboardingBrowser] = useState<'chrome' | 'firefox'>('chrome');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Centralized App State & Routing Logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    const path = window.location.pathname;

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('[Rewind] Auth Update:', u?.email || 'GUEST');
      setUser(u);
      setLoading(false);

      // 1. Extension Directives (High Priority)
      if (reason === 'signup' || reason === 'register' || reason === 'login' || reason === 'sync') {
        setCurrentView('auth');
        return;
      }

      // 2. User Authentication State Handling
      if (u) {
        // Only auto-redirect to dashboard if not in the middle of a bridge flow
        if (reason !== 'extension_auth' && params.get('handler') !== 'firefox') {
          setCurrentView('dashboard');
        }
      } else {
        // 3. Guest Deep Linking & Mode Protection
        if (path === '/why-login') setCurrentView('why-login');
        else if (path === '/profile' || path === '/sync') setCurrentView('auth');
        else if (currentView === 'dashboard' || currentView === 'profile') {
          // If a guest somehow lands on a protected view, revert to landing
          setCurrentView('landing');
        }
      }
    });

    return () => unsubscribe();
  }, [currentView]); // Responsive to internal view changes if needed

  const openSetup = (browser: 'chrome' | 'firefox') => {
    setOnboardingBrowser(browser);
    setShowSetupGuide(true);
  };

  // Apply dark class to root gracefully
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const ThemeToggle = () => (
    <button 
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="relative w-24 h-10 border-2 border-[#e51152] bg-black overflow-hidden group cursor-pointer"
      aria-label="Toggle Theme"
    >
      {/* Track Grid Lines */}
      <div className="absolute inset-0 flex justify-evenly pointer-events-none">
        <div className="w-[1px] h-full bg-white/10"></div>
        <div className="w-[1px] h-full bg-white/10"></div>
        <div className="w-[1px] h-full bg-white/10"></div>
      </div>
      
      {/* Sliding Thumb */}
      <motion.div 
        animate={{ x: isDarkMode ? 52 : 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="absolute top-[2px] left-[2px] bottom-[2px] w-10 bg-[#e51152] flex items-center justify-center border border-black"
      >
        <span className="material-symbols-outlined text-black font-black text-lg">
          {isDarkMode ? 'dark_mode' : 'light_mode'}
        </span>
      </motion.div>
    </button>
  );

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'dark bg-[#0e0e0e]' : 'bg-white'}`}>
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e]">
             <div className="text-[#e51152] font-black text-2xl animate-pulse tracking-tighter italic">INITIALIZING_CORE...</div>
          </div>
        ) : currentView === 'why-login' ? (
          <WhyLoginView onBack={() => setCurrentView('landing')} onLogin={() => setCurrentView('auth')} />
        ) : (currentView === 'profile' || currentView === 'dashboard') && user ? (
          <OperatorDashboard 
            user={user} 
            onLogout={() => signOut(auth)} 
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
          />
        ) : currentView === 'auth' ? (
          <AuthView key="auth" onBack={() => setCurrentView('landing')} />
        ) : (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence>
              {showSetupGuide && (
                <SetupGuide 
                  browser={onboardingBrowser} 
                  onClose={() => setShowSetupGuide(false)} 
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {showBenefits && (
                <BenefitsView
                  onClose={() => setShowBenefits(false)} 
                  onLogin={() => {
                    setShowBenefits(false);
                    setCurrentView('auth');
                  }}
                  onSkip={() => {
                    setShowBenefits(false);
                    setShowSetupGuide(true);
                  }}
                />
              )}
            </AnimatePresence>
            <header className="w-full border-b-4 border-black dark:border-white bg-white dark:bg-black sticky top-0 z-[100] flex justify-between items-center px-4 md:px-6 py-4 transition-colors duration-500">
              <button 
                onClick={() => setCurrentView('landing')}
                className="text-xl md:text-2xl font-black italic tracking-tighter text-black dark:text-white uppercase flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <span className="material-symbols-outlined text-[#e51152] text-2xl md:text-3xl hidden sm:block">fast_rewind</span>
                REWIND
              </button>
                <div className="hidden md:flex items-center gap-8">
                  <a className="font-['Space_Grotesk'] uppercase tracking-tighter text-black dark:text-white font-bold hover:bg-[#e51152] hover:text-white transition-none px-2 py-1" href="#features">FEATURES</a>
                  <a className="font-['Space_Grotesk'] uppercase tracking-tighter text-black dark:text-white font-bold hover:bg-[#e51152] hover:text-white transition-none px-2 py-1" href="#compatibility">DEVICES</a>
                  <a className="font-['Space_Grotesk'] uppercase tracking-tighter text-black dark:text-white font-bold hover:bg-[#e51152] hover:text-white transition-none px-2 py-1" href="#how-it-works">MACHINA</a>
                  <ThemeToggle />
                  <button 
                    type="button"
                    onClick={() => {
                      console.log('[Rewind] Triggering Why-Login Portal');
                      setCurrentView('why-login');
                    }}
                    className="bg-black dark:bg-white text-white dark:text-black font-black uppercase px-6 py-2.5 border-4 border-black dark:border-white hover:bg-[#e51152] dark:hover:bg-[#e51152] hover:text-white transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    Login / Sign Up
                  </button>
                </div>

                {/* Mobile controls */}
                <div className="flex md:hidden items-center gap-4 text-black dark:text-white">
                  <ThemeToggle />
                  <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="material-symbols-outlined text-3xl hover:text-[#e51152] transition-colors"
                  >
                    {isMobileMenuOpen ? 'close' : 'menu'}
                  </button>
                </div>
              </header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, x: "100%" }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: "100%" }}
                  className="fixed inset-0 z-[90] bg-black text-white p-8 pt-32 flex flex-col gap-8 md:hidden"
                >
                  <a onClick={() => { setIsMobileMenuOpen(false); window.location.href = '#features'; }} className="text-4xl font-black italic uppercase tracking-tighter" href="#features">FEATURES</a>
                  <a onClick={() => { setIsMobileMenuOpen(false); window.location.href = '#compatibility'; }} className="text-4xl font-black italic uppercase tracking-tighter" href="#compatibility">DEVICES</a>
                  <a onClick={() => { setIsMobileMenuOpen(false); window.location.href = '#how-it-works'; }} className="text-4xl font-black italic uppercase tracking-tighter" href="#how-it-works">MACHINA</a>
                  <div className="h-[2px] w-full bg-[#e51152] my-4"></div>
                  <button 
                    onClick={() => {
                        setIsMobileMenuOpen(false);
                        setCurrentView('why-login');
                    }}
                    className="bg-[#e51152] text-white font-black uppercase py-4 text-2xl"
                  >
                    LOGIN_SYNC
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

      <main>
        {/* Hero Section */}
        <section className="relative px-4 py-16 md:py-32 flex flex-col items-center text-center overflow-hidden border-b-4 border-black dark:border-white">
          <div className="absolute top-10 left-10 -rotate-12 hidden lg:block hover:rotate-0 transition-transform">
            <div className="bg-[#f7e600] text-black font-black px-4 py-2 neo-border neo-shadow text-xl uppercase italic">LIVE TRACKING</div>
          </div>
          <div className="absolute bottom-32 right-10 rotate-6 hidden lg:block z-10 hover:-rotate-0 transition-transform">
            <div className="bg-[#e51152] text-white font-black px-4 py-2 neo-border neo-shadow-white xl uppercase italic">AUTOSAVE: ON</div>
          </div>
          
          <h1 className="text-[3rem] sm:text-6xl md:text-[8rem] font-black tracking-tighter uppercase leading-[0.85] mb-6 md:mb-8 max-w-6xl mt-8 text-black dark:text-white">
            NEVER LOSE YOUR <span className="text-[#e51152] italic underline decoration-[4px] md:decoration-[10px] decoration-current underline-offset-4 md:underline-offset-[16px]">PLACE</span> AGAIN.
          </h1>
          <p className="text-lg md:text-2xl font-bold max-w-2xl text-gray-600 dark:text-gray-300 mb-10 md:mb-12 uppercase tracking-tight px-4">
            Automatic timestamp preservation for every video on the web. No logins. No manual bookmarks. Just pure tracking.
          </p>
          
           <div className="flex flex-col sm:flex-row gap-4 md:gap-6 w-full max-w-2xl px-4">
            <div className="flex-1 flex flex-col items-center">
              <button onClick={() => openSetup('chrome')} className="w-full bg-[#e51152] text-white text-lg md:text-xl font-black uppercase py-4 md:py-6 px-4 md:px-8 border-4 border-black dark:border-white neo-shadow hover:bg-black hover:text-[#f7e600] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-3">
                <img src="https://cdn.simpleicons.org/googlechrome/white" className="w-6 h-6 md:w-8 md:h-8" alt="Chrome Logo"/>
                <span className="whitespace-nowrap">Add to Chrome</span>
              </button>
              <button onClick={() => setCurrentView('why-login')} className="mt-4 text-[#e51152] font-black uppercase text-[10px] italic underline decoration-2 underline-offset-4 hover:text-[#f7e600] transition-colors">Know why to login</button>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <button 
                onClick={() => openSetup('firefox')} 
                className="w-full bg-white dark:bg-[#f7e600] text-black text-lg md:text-xl font-black uppercase py-4 md:py-6 px-4 md:px-8 border-4 border-black dark:border-white neo-shadow hover:bg-[#f7e600] dark:hover:bg-white active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-3"
              >
                <img src="https://cdn.simpleicons.org/firefoxbrowser/black" className="w-6 h-6 md:w-8 md:h-8" alt="Firefox Logo"/>
                <span className="whitespace-nowrap">Add to Firefox</span>
              </button>
            </div>
          </div>
          
          {/* Functional Demo injected here */}
          <div className="w-full px-4 md:px-0">
             <TrackingDemo />
          </div>
          
        </section>

        <ArchitectureXRay />
        <ComparisonGrid />

        {/* Feature Grid Section */}
        <section className="px-6 py-24 md:py-32 bg-white dark:bg-[#131313] transition-colors duration-500 font-['Space_Grotesk']" id="features">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-12 md:mb-16 border-b-4 border-black dark:border-[#e51152] pb-6 md:pb-8 relative">
              <SysStatus label="CORE_MODUELS" status="online" />
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-black dark:text-white">Core Capabilities</h2>
              <span className="text-[#e51152] font-black text-xl md:text-2xl hidden md:block border-2 border-[#e51152] px-3 py-1 bg-[#e51152]/10">VER: 2.0.4</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#f9f9f9] dark:bg-[#0e0e0e] text-black dark:text-white p-6 md:p-8 neo-border neo-shadow hover:bg-black hover:text-white dark:hover:bg-[#e51152] transition-colors flex flex-col gap-6 group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-[#f7e600] flex items-center justify-center neo-border group-hover:border-white">
                  <span className="material-symbols-outlined text-3xl md:text-4xl text-black">radar</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Instant Discovery</h3>
                <p className="text-base md:text-lg font-bold leading-tight text-gray-600 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-white">
                  Uses a high-performance MutationObserver to scan the tab DOM and lock onto any video element within milliseconds of page load.
                </p>
              </div>
              <div className="bg-[#f9f9f9] dark:bg-[#0e0e0e] text-black dark:text-white p-6 md:p-8 neo-border neo-shadow hover:bg-black hover:text-white dark:hover:bg-[#e51152] transition-colors flex flex-col gap-6 group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-[#e51152] flex items-center justify-center neo-border dark:border-white">
                  <span className="material-symbols-outlined text-3xl md:text-4xl text-white">database</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Zero-Server Logs</h3>
                <p className="text-base md:text-lg font-bold leading-tight text-gray-600 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-white">
                  All timestamp data is processed and stored locally via chrome.storage. No accounts, no clouds, just raw session preservation.
                </p>
              </div>
              <div className="bg-[#f9f9f9] dark:bg-[#0e0e0e] text-black dark:text-white p-6 md:p-8 neo-border neo-shadow hover:bg-black hover:text-white dark:hover:bg-[#e51152] transition-colors flex flex-col gap-6 group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white flex items-center justify-center neo-border group-hover:border-white">
                  <span className="material-symbols-outlined text-3xl md:text-4xl text-[#e51152]">notifications_active</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Resume Triggers</h3>
                <p className="text-base md:text-lg font-bold leading-tight text-gray-600 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-white">
                  Brutalist popups alert you the moment you land on a saved video, allowing a one-click transition back to your previous session.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Compatibility Section */}
        <section className="px-6 py-24 md:py-32 bg-[#f0f0f0] dark:bg-[#0e0e0e] border-y-4 border-black dark:border-white transition-colors duration-500 font-['Space_Grotesk']" id="compatibility">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 md:gap-16">
            <div className="flex-1">
              <h2 className="text-[3rem] md:text-7xl font-black uppercase tracking-tighter mb-6 md:mb-8 leading-[0.9] text-black dark:text-white">Universal <br className="hidden md:block"/><span className="text-[#e51152] underline decoration-[8px] decoration-[#f7e600]">Support.</span></h2>
              <p className="text-lg md:text-xl mb-10 max-w-md text-gray-600 dark:text-gray-400 font-bold">Our engine is built on standard HTML5 Media APIs, ensuring perfect capability tracking with the modern web's structure.</p>
              <div className="p-6 bg-[#e51152] text-white border-4 border-black dark:border-white neo-shadow inline-block lg:rotate-[-2deg] max-w-md w-full">
                <h4 className="text-xl md:text-2xl font-black uppercase flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined">warning</span>
                  Flash is Dead
                </h4>
                <p className="font-bold text-sm md:text-base leading-tight">Legacy Adobe Flash content is not supported. Please welcome to the future.</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="border-4 border-black dark:border-white neo-shadow bg-white dark:bg-[#131313] transition-colors duration-500 overflow-hidden">
                <div className="bg-black dark:bg-[#e51152] text-white p-4 font-black uppercase flex justify-between border-b-4 border-black dark:border-white">
                  <span>Platform</span>
                  <span>Status</span>
                </div>
                <div className="divide-y-4 divide-black dark:divide-white">
                  <div className="p-4 md:p-6 flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-black border-2 border-black dark:border-white flex items-center justify-center shrink-0">
                        <img src="https://cdn.simpleicons.org/youtube/FF0000" className="w-6 h-6 md:w-8 md:h-8" alt="YouTube Logo" />
                      </div>
                      <span className="text-xl md:text-2xl font-black uppercase dark:text-white">YouTube</span>
                    </div>
                    <span className="bg-[#f7e600] text-black px-3 md:px-4 py-1 font-black border-2 border-black text-xs md:text-sm">OPTIMIZED</span>
                  </div>
                  <div className="p-4 md:p-6 flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-black border-2 border-black dark:border-white flex items-center justify-center shrink-0">
                        <img src="https://cdn.simpleicons.org/twitch/9146FF" className="w-6 h-6 md:w-8 md:h-8" alt="Twitch Logo" />
                      </div>
                      <span className="text-xl md:text-2xl font-black uppercase dark:text-white">Twitch</span>
                    </div>
                    <span className="bg-[#f7e600] text-black px-3 md:px-4 py-1 font-black border-2 border-black text-xs md:text-sm">OPTIMIZED</span>
                  </div>
                  <div className="p-4 md:p-6 flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-black border-2 border-black dark:border-white flex items-center justify-center shrink-0">
                        <img src="https://cdn.simpleicons.org/netflix/E50914" className="w-6 h-6 md:w-8 md:h-8" alt="Netflix Logo" />
                      </div>
                      <span className="text-xl md:text-2xl font-black uppercase dark:text-white">Netflix</span>
                    </div>
                    <span className="bg-[#f7e600] text-black px-3 md:px-4 py-1 font-black border-2 border-black text-xs md:text-sm">OPTIMIZED</span>
                  </div>
                  <div className="p-4 md:p-6 flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-black border-2 border-black dark:border-white flex items-center justify-center shrink-0">
                        <img src="https://cdn.simpleicons.org/html5/E34F26" className="w-6 h-6 md:w-8 md:h-8" alt="HTML5 Logo" />
                      </div>
                      <span className="text-xl md:text-2xl font-black uppercase dark:text-white">Any web media player</span>
                    </div>
                    <span className="bg-black dark:bg-white text-white dark:text-black px-3 md:px-4 py-1 font-black border-2 border-black text-xs md:text-sm">NATIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="px-6 py-24 md:py-40 bg-white dark:bg-[#131313] text-black dark:text-white transition-colors duration-500 overflow-hidden font-['Space_Grotesk']" id="how-it-works">
          <div className="max-w-7xl mx-auto text-center mb-16 md:mb-24">
            <h2 className="text-5xl md:text-[6rem] font-black uppercase tracking-tighter mb-6 leading-none">The Machine <span className="text-white dark:text-[#f7e600] bg-black dark:bg-transparent px-2 md:px-0 italic">Flow</span></h2>
            <p className="text-lg md:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto uppercase font-bold px-4">A simple architecture designed for maximum performance and absolutely zero friction.</p>
          </div>
          <div className="max-w-6xl mx-auto relative px-4">
            <div className="hidden lg:block absolute top-[60px] left-[15%] right-[15%] h-[4px] bg-black dark:bg-[#f7e600]"></div>
            <div className="flex flex-col lg:flex-row justify-between items-center lg:items-start gap-12 md:gap-16 relative">
              <div className="flex-1 flex flex-col items-center text-center group max-w-sm">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-black text-black dark:text-white border-4 border-black dark:border-white neo-shadow dark:neo-shadow-white mb-6 md:mb-8 flex items-center justify-center relative z-10 group-hover:bg-[#e51152] group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-5xl md:text-6xl">code</span>
                </div>
                <h4 className="text-2xl md:text-3xl font-black uppercase mb-3 dark:text-[#f7e600]">content.js</h4>
                <p className="text-base md:text-lg leading-tight font-bold text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors">The DOM probe. Continuously monitors video states and communicates lifecycle events to the runtime.</p>
              </div>
              <div className="flex-1 flex flex-col items-center text-center group max-w-sm">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-black text-black dark:text-white border-4 border-black dark:border-white neo-shadow dark:neo-shadow-white mb-6 md:mb-8 flex items-center justify-center relative z-10 group-hover:bg-[#e51152] group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-5xl md:text-6xl">security</span>
                </div>
                <h4 className="text-2xl md:text-3xl font-black uppercase mb-3 dark:text-[#f7e600]">local_storage</h4>
                <p className="text-base md:text-lg leading-tight font-bold text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors">A private, browser-sandboxed database storing your keyframe markers with absolute privacy.</p>
              </div>
              <div className="flex-1 flex flex-col items-center text-center group max-w-sm">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-black text-black dark:text-white border-4 border-black dark:border-white neo-shadow dark:neo-shadow-white mb-6 md:mb-8 flex items-center justify-center relative z-10 group-hover:bg-[#e51152] group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-5xl md:text-6xl">dashboard</span>
                </div>
                <h4 className="text-2xl md:text-3xl font-black uppercase mb-3 dark:text-[#f7e600]">operator_ui</h4>
                <p className="text-base md:text-lg leading-tight font-bold text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors">The central hub. Retrieve session history, track analytics, and manage your global video bookmarks.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black text-white w-full border-t-4 border-black dark:border-white flex flex-col items-center md:items-start md:flex-row justify-between py-10 md:py-16 px-6 md:px-12 gap-8 relative z-10">
        <div className="flex flex-col items-center md:items-start gap-2">
           <div className="text-3xl font-black text-[#f7e600] uppercase tracking-tighter">REWIND</div>
           <div className="font-['Space_Grotesk'] font-bold uppercase text-xs text-gray-400">© 2024 REWIND. NO RADIUS ALLOWED.</div>
           <div className="font-['Space_Grotesk'] font-black uppercase text-xs text-white bg-[#e51152] px-2 py-0.5 mt-2">MADE BY AADESH KHANDE</div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 items-center md:items-end text-center md:text-right">
          <div className="flex flex-col gap-3">
             <h5 className="font-black text-[#e51152] text-sm uppercase mb-1">Infrastructure</h5>
             <a className="font-['Space_Grotesk'] font-bold uppercase text-sm text-gray-400 hover:text-white transition-colors" href="/docs" target="_blank" rel="noreferrer">Documentation</a>
             <a className="font-['Space_Grotesk'] font-bold uppercase text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 justify-center md:justify-end" href="https://github.com/debugonaut/video-playback-tracker" target="_blank" rel="noreferrer">GitHub Repository <span className="material-symbols-outlined text-xs">open_in_new</span></a>
          </div>
          <div className="flex flex-col gap-3">
             <h5 className="font-black text-[#e51152] text-sm uppercase mb-1">Legal</h5>
             <a className="font-['Space_Grotesk'] font-bold uppercase text-sm text-gray-400 hover:text-white transition-colors" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
             <a className="font-['Space_Grotesk'] font-bold uppercase text-sm text-gray-400 hover:text-white transition-colors" href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
          </div>
        </div>
       </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
