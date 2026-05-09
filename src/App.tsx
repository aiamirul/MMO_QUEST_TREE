/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sword, 
  Coins, 
  Users, 
  Map as MapIcon, 
  Scroll, 
  Upload, 
  Download, 
  RefreshCcw, 
  ChevronRight,
  Info,
  History,
  ShieldCheck,
  TrendingUp,
  Package,
  Activity
} from 'lucide-react';
import { Quest, ReputationState, MetaRecord } from './types';
import { apiService } from './services/api';
import { QuestTreeVisualizer } from './components/QuestTreeVisualizer';
import { ReputationCostChart } from './components/ReputationCostChart';

export default function App() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [reputation, setReputation] = useState<ReputationState>({});
  const [loading, setLoading] = useState(true);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [uploadText, setUploadText] = useState('');
  const [view, setView] = useState<'dashboard' | 'editor' | 'visualizer' | 'items' | 'metrics'>('dashboard');

  // Extract unique items from quests
  const getUniqueItems = () => {
    const itemsMap: Record<string, { name: string; count: number; quests: string[] }> = {};
    quests.forEach(q => {
      const itemName = q.allattrib.ITEM1;
      if (itemName && itemName !== "") {
        if (!itemsMap[itemName]) {
          itemsMap[itemName] = { name: itemName, count: 0, quests: [] };
        }
        itemsMap[itemName].count += q.allattrib.ITEM1_QTY || 0;
        itemsMap[itemName].quests.push(q.id);
      }
    });
    return Object.values(itemsMap);
  };

  const uniqueItems = getUniqueItems();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Health check first - if this fails, we just work in local mode
      try {
        await apiService.checkHealth();
      } catch (e) {
        console.warn("API Health check failed, working in local mode", e);
      }
      
      const records = await apiService.getByGroup('quest_system');
      
      // Look for quests and rep state
      const questRecords = records.filter(r => r.datakey.startsWith('quest_'));
      const repRecord = records.find(r => r.datakey === 'rep_system_state');

      if (questRecords.length > 0) {
        setQuests(questRecords.map(r => r.metadata as Quest));
      }
      if (repRecord) {
        setReputation(repRecord.metadata as ReputationState);
      }
    } catch (err) {
      console.warn("Failed to load data from API, system will operate with local cache if available.", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRepAction = async (quest: Quest) => {
    const newRep = { ...reputation };
    const attr = quest.allattrib;

    // Check cost
    const currentRep = newRep[attr.REP_NAME] || 0;
    if (currentRep < attr.REP_COST) {
      alert(`Insufficient reputation for ${attr.REP_NAME}. Required: ${attr.REP_COST}, Current: ${currentRep}`);
      return;
    }

    // Spend rep
    newRep[attr.REP_NAME] = currentRep - attr.REP_COST;

    // Add rewards
    newRep[attr.REWARD_REP_TYPE1] = (newRep[attr.REWARD_REP_TYPE1] || 0) + attr.REWARD_REP_AMT1;
    if (attr.REWARD_REP_TYPE2) {
      newRep[attr.REWARD_REP_TYPE2] = (newRep[attr.REWARD_REP_TYPE2] || 0) + attr.REWARD_REP_AMT2!;
    }

    setReputation(newRep);
    
    // Save to API (Fail silently or warn, but update local state so app works)
    try {
      await apiService.save({
        datakey: 'rep_system_state',
        datagroup: 'quest_system',
        datatype: 'SYSTEM',
        metadata: newRep
      });
    } catch (err) {
      console.warn("API save failed, using local state only", err);
    }
    
    setActiveQuest(null);
  };

  const parseLuaLikeJson = (text: string) => {
    if (!text) return [];
    
    try {
      // 1. Sanitize: Remove comments
      // Multi-line comments --[[ ... ]]
      let sanitized = text.replace(/--\[\[[\s\S]*?\]\]/g, '');
      // Single-line comments -- ...
      sanitized = sanitized.split('\n').map(line => line.split('--')[0]).join('\n');

      // 2. Clear out "return {" and the trailing "}"
      sanitized = sanitized.replace(/return\s*\{/, '');
      sanitized = sanitized.trim();
      if (sanitized.endsWith('}')) sanitized = sanitized.slice(0, -1);

      const results: Quest[] = [];
      
      // 3. Find top level assignments: ID = { ... }
      // This regex looks for CamelCase_Or_Caps_IDs followed by an equals and a curly brace block
      const questMatches = sanitized.matchAll(/([A-Z0-9_]+)\s*=\s*\{([\s\S]*?)\},\s*(?=[A-Z0-9_]+\s*=|\s*$)/g);

      for (const match of questMatches) {
        const id = match[1];
        const body = match[2];

        // Extract INHERIT
        const inheritMatch = body.match(/INHERIT\s*=\s*["']([^"']+)["']/);
        const inherit = inheritMatch ? inheritMatch[1] : 'BASE';

        // Find allattrib block
        const attrBlockMatch = body.match(/allattrib\s*=\s*\{([\s\S]*?)\}/);
        if (!attrBlockMatch) continue;
        const attrBody = attrBlockMatch[1];

        // Helper to extract values
        const extractValue = (key: string) => {
          // Check for multi-line string [[ ... ]]
          const mlRegex = new RegExp(`${key}\\s*=\\s*\\[\\[([\\s\\S]*?)\\]\\]`);
          const mlMatch = attrBody.match(mlRegex);
          if (mlMatch) return mlMatch[1].trim();

          // Check for quoted string
          const sRegex = new RegExp(`${key}\\s*=\\s*["']([^"']*)["']`);
          const sMatch = attrBody.match(sRegex);
          if (sMatch) return sMatch[1].trim();

          // Check for numbers
          const nRegex = new RegExp(`${key}\\s*=\\s*(-?\\d+)`);
          const nMatch = attrBody.match(nRegex);
          if (nMatch) return parseInt(nMatch[1]);

          return '';
        };

        const quest: Quest = {
          id,
          INHERIT: inherit,
          allattrib: {
            ITEM1: extractValue('ITEM1') as string,
            ITEM1_QTY: extractValue('ITEM1_QTY') as number,
            REP_NAME: extractValue('REP_NAME') as string,
            REP_COST: extractValue('REP_COST') as number,
            COINS: extractValue('COINS') as number,
            CD: extractValue('CD') as number,
            REWARD_REP_TYPE1: extractValue('REWARD_REP_TYPE1') as string,
            REWARD_REP_AMT1: extractValue('REWARD_REP_AMT1') as number,
            REWARD_REP_TYPE2: extractValue('REWARD_REP_TYPE2') as string,
            REWARD_REP_AMT2: extractValue('REWARD_REP_AMT2') as number,
            LOOPMESSAGE: extractValue('LOOPMESSAGE') as string,
            description: extractValue('description') as string
          }
        };

        results.push(quest);
      }

      return results;
    } catch (e) {
      console.error("Advanced Lua parsing failure:", e);
      return [];
    }
  };

  const handleUpload = async () => {
    if (!uploadText) return;
    let parsed: Quest[] = [];
    
    // Try JSON first
    try {
      const jsonData = JSON.parse(uploadText);
      if (Array.isArray(jsonData)) {
        parsed = jsonData;
      } else if (typeof jsonData === 'object') {
        // If it's a map of id -> data
        parsed = Object.entries(jsonData).map(([id, val]: [string, any]) => ({
          id,
          ...val
        }));
      }
    } catch (e) {
      // Not JSON, try Lua-like
      parsed = parseLuaLikeJson(uploadText);
    }

    if (parsed.length === 0) {
      alert("No valid quest structures detected. Please check your data format.");
      return;
    }

    // Set quests locally immediately for preview
    setQuests(parsed);
    
    setLoading(true);
    try {
      for (const q of parsed) {
        try {
          await apiService.save({
            datakey: `quest_${q.id}`,
            datagroup: 'quest_system',
            datatype: 'APP',
            metadata: q
          });
        } catch (e) {
          console.warn(`Failed to save quest ${q.id} to cloud`, e);
        }
      }
      setView('dashboard');
      setUploadText('');
    } catch (err) {
      console.warn("Cloud sync partial or failed, using local session state.", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadText(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const loadSample = () => {
    setUploadText(`ROGUE_PYRAT_001 = {
	INHERIT = "PIRATE_QUEST",
	allattrib = {
		ITEM1 = "RUM_CRATE", ITEM1_QTY = 3,
		REP_NAME = "REP_PYRATS",
		REP_COST = 0,
		COINS = 20,
		CD = 5,
		REWARD_REP_TYPE1 = "REP_PYRATS", REWARD_REP_AMT1 = 8,
		LOOPMESSAGE = "Every pirate starts in the mud.",
		description = "Deliver rum crates stolen from docks."
	},
}`);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-600 rounded flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-amber-600/20">Ω</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 font-display">ODYSSEY <span className="text-amber-500">ARCHITECT</span></h1>
          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono tracking-widest">v2.4.0</span>
        </div>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold border border-slate-700 flex items-center gap-2 transition-all active:scale-95 cursor-pointer">
            <Upload size={14} /> LOAD FILE
            <input type="file" className="hidden" accept=".json,.txt" onChange={handleFileSelect} />
          </label>
          <button 
            onClick={() => setView('editor')}
            className={`px-4 py-2 rounded text-[10px] font-bold border flex items-center gap-2 transition-all active:scale-95 ${view === 'editor' ? 'bg-amber-600/20 border-amber-500 text-amber-500' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'}`}
          >
            <Scroll size={14} /> INJECTOR
          </button>
          <button 
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quests, null, 2));
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", dataStr);
              downloadAnchorNode.setAttribute("download", "quest_blueprint.json");
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-[10px] font-bold text-slate-950 flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-600/20"
          >
            <Download size={14} /> EXPORT
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Quest Registry */}
        <aside className="w-72 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] mb-4 uppercase font-display">Quest Registry</h2>
            <nav className="flex flex-col gap-1">
              <button 
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-all ${view === 'dashboard' ? 'bg-amber-600/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'}`}
              >
                <Scroll size={14} /> Dashboard
              </button>
              <button 
                onClick={() => setView('visualizer')}
                className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-all ${view === 'visualizer' ? 'bg-amber-600/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'}`}
              >
                <TrendingUp size={14} /> Progress Tree
              </button>
              <button 
                onClick={() => setView('metrics')}
                className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-all ${view === 'metrics' ? 'bg-amber-600/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'}`}
              >
                <Activity size={14} /> Econ Metrics
              </button>
              <button 
                onClick={() => setView('items')}
                className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-all ${view === 'items' ? 'bg-amber-600/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'}`}
              >
                <Package size={14} /> Item Registry
              </button>
            </nav>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <h3 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] mb-4 uppercase">Directives</h3>
            <div className="space-y-2">
              {quests.map(q => (
                <div 
                  key={q.id}
                  onClick={() => {
                    setView('dashboard');
                    setActiveQuest(q);
                  }}
                  className={`p-2.5 rounded group cursor-pointer border transition-all duration-200 ${activeQuest?.id === q.id ? 'bg-amber-600/10 border-amber-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="flex justify-between text-[11px] font-bold mb-0.5">
                    <span className={activeQuest?.id === q.id ? 'text-amber-500' : 'text-slate-300'}>{q.id}</span>
                    <span className="text-amber-500 opacity-60 font-mono">${q.allattrib.COINS}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate group-hover:text-slate-400 italic">
                    {q.allattrib.description}
                  </div>
                </div>
              ))}
              {quests.length === 0 && (
                <div className="text-[10px] text-slate-600 italic px-2 py-4 border border-dashed border-slate-800 rounded">
                  No blueprints identified.
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/20">
             <div className="text-[9px] text-slate-600 font-mono flex flex-col gap-1 uppercase tracking-wider">
                <div>Build: 0x8FA22</div>
                <div>Status: <span className="text-emerald-500">Online</span></div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-slate-900 relative flex flex-col overflow-hidden">
          {/* Subtle Dot Grid Background */}
          <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none"></div>
          
          {/* Main Visual Content */}
          <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
            <AnimatePresence mode="wait">
              {view === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-4xl mx-auto space-y-8"
                >
                  <div className="flex justify-between items-end border-b border-slate-800 pb-6">
                    <div>
                      <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase font-display">System Feed</h2>
                      <p className="text-slate-500 text-xs font-mono mt-1">META_DATA_SYNC: <span className="text-amber-500">CONNECTED</span> // LAST_ENTRY: {new Date().toLocaleTimeString()}</p>
                    </div>
                    <button 
                      onClick={loadInitialData} 
                      className="rpg-button h-10 flex items-center gap-2 border-slate-800 bg-slate-950/50 backdrop-blur"
                    >
                      <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> REFRESH_LOGS
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {quests.map(q => (
                      <motion.div 
                        key={q.id}
                        layoutId={q.id}
                        onClick={() => setActiveQuest(q)}
                        className={`rpg-panel border border-slate-800 p-5 group cursor-pointer hover:bg-slate-800/40 transition-all ${activeQuest?.id === q.id ? 'border-amber-500/50 bg-amber-500/5' : ''}`}
                      >
                        <div className="flex gap-6">
                          <div className="w-16 h-16 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                             <Scroll size={24} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="text-lg font-bold text-slate-100 group-hover:text-amber-400 transition-colors tracking-tight">{q.id.replace(/_/g, ' ')}</h4>
                                <div className="flex items-center gap-2 text-[9px] uppercase font-mono tracking-widest text-slate-500 mt-0.5">
                                  <span className="text-amber-500">{q.INHERIT}</span>
                                  <span>•</span>
                                  <span>CD: {q.allattrib.CD}U</span>
                                </div>
                              </div>
                              <div className="px-3 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-amber-500 text-xs font-bold shadow-inner">
                                ${q.allattrib.COINS}
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed italic line-clamp-1 opacity-80 font-serif">"{q.allattrib.description}"</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {view === 'visualizer' && (
                <motion.div 
                  key="visualizer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="max-w-5xl mx-auto h-full flex flex-col gap-6"
                >
                  <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                     <h2 className="text-3xl font-black text-white italic uppercase font-display">Logistics Tree</h2>
                     <div className="flex gap-4">
                        <div className="text-[10px] flex items-center gap-2 font-mono text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> ENGINE_ACTIVE</div>
                        <div className="text-[10px] flex items-center gap-2 font-mono text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-500"></span> NODES: {quests.length}</div>
                     </div>
                  </div>
                  <QuestTreeVisualizer quests={quests} />
                </motion.div>
              )}

              {view === 'metrics' && (
                <motion.div
                  key="metrics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-5xl mx-auto space-y-8"
                >
                  <div className="border-b border-slate-800 pb-6">
                    <h2 className="text-4xl font-black text-white italic uppercase font-display tracking-tighter">Economic Analysis</h2>
                    <p className="text-slate-500 text-xs font-mono mt-1">CROSS_FACTION_REPUTATION_SCALING // METRIC_ID: REP_PROGRESSION_001</p>
                  </div>
                  <ReputationCostChart quests={quests} />
                  <div className="rpg-panel border-amber-500/10 bg-slate-900/20 p-6">
                    <h4 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Progression Logic</h4>
                    <p className="text-sm text-slate-400 font-serif italic leading-relaxed">
                      "The chart above translates social capital into a tangible logistics hurdle. As reputation requirements spike, players are forced into specialized loops. Each point represents a bottleneck in the world's power distribution."
                    </p>
                  </div>
                </motion.div>
              )}

              {view === 'items' && (
                <motion.div 
                  key="items"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-5xl mx-auto space-y-8"
                >
                  <div className="border-b border-slate-800 pb-6">
                    <h2 className="text-4xl font-black text-white italic uppercase font-display tracking-tighter text-blue-500">Item Registry</h2>
                    <p className="text-slate-500 text-xs font-mono mt-1">UNIQUE_ITEM_EXTRACTION // DATABASE_SYNC: <span className="text-emerald-500">STABLE</span></p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {uniqueItems.map(item => (
                      <div key={item.name} className="rpg-panel bg-slate-900/60 border-slate-800 hover:border-blue-500/30 group">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform shadow-inner">
                            <Package size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-tight group-hover:text-blue-400 transition-colors">{item.name.replace(/_/g, ' ')}</h4>
                            <div className="text-[10px] font-mono text-slate-600 italic">ID: {item.name}</div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono border-t border-slate-800 pt-3 mt-auto">
                           <span className="text-slate-500 uppercase">Total Flow:</span>
                           <span className="text-blue-500 font-bold">{item.count} units</span>
                        </div>
                        <div className="mt-2 text-[9px] text-slate-700 font-mono flex flex-wrap gap-1">
                          {item.quests.map(qid => (
                            <span key={qid} className="px-1 bg-slate-950 rounded border border-slate-800">{qid}</span>
                          ))}
                        </div>
                      </div>
                    ))}

                    {uniqueItems.length === 0 && (
                      <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded">
                        <Package size={48} className="mx-auto text-slate-800 mb-4" />
                        <p className="text-slate-600 font-mono text-sm">No items identified in current blueprint pool.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {view === 'editor' && (
                <motion.div 
                  key="editor"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="max-w-4xl mx-auto"
                >
                  <div className="rpg-panel border-amber-500/20 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Upload className="text-amber-500" />
                        <h2 className="text-2xl font-black italic uppercase font-display">Data Injection Hub</h2>
                      </div>
                      <button 
                        onClick={loadSample}
                        className="text-[10px] font-bold text-slate-500 hover:text-amber-500 transition-colors uppercase tracking-widest border border-slate-800 px-3 py-1 rounded"
                      >
                        Load Sample Lua
                      </button>
                    </div>
                    
                    <textarea 
                      value={uploadText}
                      onChange={(e) => setUploadText(e.target.value)}
                      placeholder="Paste JSON or Lua-style quest blueprints here..."
                      className="w-full h-[350px] bg-slate-950 border border-slate-800 rounded p-4 font-mono text-[11px] text-emerald-400/80 focus:outline-none focus:border-amber-500/50 mb-6 custom-scrollbar placeholder:text-slate-800"
                    />

                    <div className="flex gap-4">
                      <button 
                        onClick={handleUpload}
                        disabled={loading || !uploadText}
                        className="rpg-button rpg-button-primary flex-1 h-12 text-sm disabled:opacity-50"
                      >
                        {loading ? 'INJECTING...' : 'COMMIT CHANGES TO META-RECORDS'}
                      </button>
                      <button 
                        onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quests, null, 2));
                          const downloadAnchorNode = document.createElement('a');
                          downloadAnchorNode.setAttribute("href", dataStr);
                          downloadAnchorNode.setAttribute("download", "quest_blueprint.json");
                          document.body.appendChild(downloadAnchorNode);
                          downloadAnchorNode.click();
                          downloadAnchorNode.remove();
                        }}
                        className="rpg-button w-48 flex items-center justify-center gap-2 h-12"
                      >
                        <Download size={14} /> EXPORT ALL
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Lore Overlay Panel (Dynamic Footer) */}
          <AnimatePresence>
            {activeQuest && (
              <motion.div 
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 200, opacity: 0 }}
                className="absolute bottom-4 left-4 right-4 h-36 bg-slate-950/90 border border-slate-700/50 rounded-lg p-5 flex gap-8 backdrop-blur-xl shadow-2xl z-20"
              >
                <div className="w-24 h-full rounded bg-slate-900 border border-slate-800 flex-shrink-0 relative overflow-hidden flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent"></div>
                  <Users size={40} className="text-slate-700 group-hover:text-amber-500 transition-colors duration-500" />
                </div>
                
                <div className="flex-1 flex flex-col justify-center gap-2">
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] font-display">Contract Transmission // {activeQuest.id}</h4>
                    <button onClick={() => setActiveQuest(null)} className="text-slate-600 hover:text-white transition-colors text-xl font-light">&times;</button>
                  </div>
                  <p className="text-base italic text-slate-300 leading-relaxed font-serif pr-12 line-clamp-2">
                    "{activeQuest.allattrib.LOOPMESSAGE}"
                  </p>
                </div>

                <div className="w-64 border-l border-slate-800 pl-8 flex flex-col justify-center gap-3">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500">REQUIREMENT:</span>
                    <span className="text-slate-300 font-bold">{activeQuest.allattrib.ITEM1_QTY}x {activeQuest.allattrib.ITEM1}</span>
                  </div>
                  <button 
                    onClick={() => handleRepAction(activeQuest)}
                    className="rpg-button rpg-button-primary w-full h-10 shadow-lg shadow-amber-600/10 cursor-pointer"
                  >
                    EXECUTE
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Sidebar: Faction Metrics */}
        <aside className="w-64 border-l border-slate-800 bg-slate-950 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 bg-slate-900/30">
            <h2 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] mb-6 uppercase font-display">Faction Metrics</h2>
            
            <div className="space-y-6">
              {['REP_PYRATS', 'REP_BANKS', 'REP_KNIGHTS'].map(faction => {
                const value = reputation[faction] || 0;
                // Calculate color and percentage for mock display
                const maxVal = 500;
                const percentage = Math.min((value / maxVal) * 100, 100);
                const isPositive = faction.includes('PYRATS');
                
                return (
                  <div key={faction}>
                    <div className="flex justify-between text-[10px] mb-2 font-mono">
                      <span className="text-slate-400">{faction}</span>
                      <span className={value > 0 ? 'text-amber-500' : 'text-slate-500'}>{value} pts</span>
                    </div>
                    <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className={`h-full transition-all duration-1000 ${isPositive ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`}
                      />
                    </div>
                  </div>
                );
              })}

              {Object.keys(reputation).length > 3 && (
                <div className="pt-4 border-t border-slate-900">
                   <p className="text-[9px] text-slate-600 font-mono italic">Additional metrics found in buffer...</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 overflow-y-auto shrink-0 bg-slate-950">
            <h3 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] mb-4 uppercase">Logic Buffer</h3>
            <div className="bg-slate-900 border border-slate-800 rounded-md p-3 font-mono text-[9px] text-emerald-400 leading-tight h-48 overflow-y-auto custom-scrollbar">
              <div className="opacity-50 mb-1">-- ACTIVE_RECORD_SHAPE</div>
              {activeQuest ? (
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(activeQuest.allattrib, null, 2)}
                </pre>
              ) : (
                <div className="text-slate-700 italic">No node selected. Waiting for input signal...</div>
              )}
            </div>
          </div>

          <div className="mt-auto p-4 border-t border-slate-800 bg-slate-900/10">
             <div className="text-[9px] text-slate-700 font-mono flex flex-col gap-1 uppercase tracking-tighter">
                <div>Memory: 0x22F-44</div>
                <div>Hash: AE-00-11-BC</div>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
