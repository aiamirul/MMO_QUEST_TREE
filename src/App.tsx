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
  TrendingUp
} from 'lucide-react';
import { Quest, ReputationState, MetaRecord } from './types';
import { apiService } from './services/api';
import { QuestTreeVisualizer } from './components/QuestTreeVisualizer';

export default function App() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [reputation, setReputation] = useState<ReputationState>({});
  const [loading, setLoading] = useState(true);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [uploadText, setUploadText] = useState('');
  const [view, setView] = useState<'dashboard' | 'editor' | 'visualizer'>('dashboard');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Health check first
      await apiService.checkHealth();
      
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
      console.error("Failed to load data", err);
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
    
    // Save to API
    await apiService.save({
      datakey: 'rep_system_state',
      datagroup: 'quest_system',
      datatype: 'SYSTEM',
      metadata: newRep
    });
    
    setActiveQuest(null);
  };

  const parseLuaLikeJson = (text: string) => {
    try {
      // Extremely basic parser for the specific Lua-like structure provided
      // In a real app we'd use a more robust regex or dedicated parser
      // Here we'll try to find chunks and extract relevant data
      const results: Quest[] = [];
      const blocks = text.split(/([A-Z0-9_]+\s*=\s*\{)/).filter(Boolean);
      
      for (let i = 0; i < blocks.length; i += 2) {
        const id = blocks[i].replace('=', '').trim();
        const content = blocks[i+1];
        
        // Extract INHERIT
        const inheritMatch = content.match(/INHERIT\s*=\s*"([^"]+)"/);
        const inherit = inheritMatch ? inheritMatch[1] : 'BASE';

        // Extract allattrib values using regex
        const getAttr = (key: string) => {
          const match = content.match(new RegExp(`${key}\\s*=\\s*"?([^",}]+)"?`));
          return match ? match[1].trim() : '';
        };

        const getNum = (key: string) => {
          const match = content.match(new RegExp(`${key}\\s*=\\s*(-?\\d+)`));
          return match ? parseInt(match[1]) : 0;
        };

        const quest: Quest = {
          id,
          INHERIT: inherit,
          allattrib: {
            ITEM1: getAttr('ITEM1'),
            ITEM1_QTY: getNum('ITEM1_QTY'),
            REP_NAME: getAttr('REP_NAME'),
            REP_COST: getNum('REP_COST'),
            COINS: getNum('COINS'),
            CD: getNum('CD'),
            REWARD_REP_TYPE1: getAttr('REWARD_REP_TYPE1'),
            REWARD_REP_AMT1: getNum('REWARD_REP_AMT1'),
            REWARD_REP_TYPE2: getAttr('REWARD_REP_TYPE2'),
            REWARD_REP_AMT2: getNum('REWARD_REP_AMT2'),
            LOOPMESSAGE: getAttr('LOOPMESSAGE'),
            description: getAttr('description')
          }
        };

        if (id && quest.allattrib.REP_NAME) {
          results.push(quest);
        }
      }
      return results;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const handleUpload = async () => {
    const parsed = parseLuaLikeJson(uploadText);
    if (parsed.length === 0) {
      alert("No valid quest structures found in upload.");
      return;
    }

    setLoading(true);
    // Save each quest
    for (const q of parsed) {
      await apiService.save({
        datakey: `quest_${q.id}`,
        datagroup: 'quest_system',
        datatype: 'APP',
        metadata: q
      });
    }
    
    // Refresh
    await loadInitialData();
    setView('dashboard');
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
      {/* Sidebar */}
      <aside className="bg-slate-950 border-r border-slate-800 p-6 flex flex-col gap-8">
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Sword className="text-slate-950" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">PYRAT</h1>
            <p className="text-[10px] text-amber-500 font-mono uppercase tracking-widest">Architect OS</p>
          </div>
        </header>

        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm transition-all ${view === 'dashboard' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
          >
            <Scroll size={18} /> Dashboard
          </button>
          <button 
            onClick={() => setView('visualizer')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm transition-all ${view === 'visualizer' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
          >
            <TrendingUp size={18} /> Quest Tree
          </button>
          <button 
            onClick={() => setView('editor')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm transition-all ${view === 'editor' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
          >
            <Upload size={18} /> Blueprint Importer
          </button>
        </nav>

        <div className="mt-auto">
          <div className="rpg-panel p-4 bg-slate-900/50 border-slate-800">
            <h3 className="text-[10px] text-slate-500 font-mono uppercase mb-4 tracking-tighter">Faction Reputation</h3>
            <div className="flex flex-col gap-3">
              {Object.entries(reputation).sort((a,b) => b[1] - a[1]).map(([faction, value]) => (
                <div key={faction} className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{faction.replace('REP_', '')}</span>
                  <span className="font-mono text-amber-400 font-bold">{value}</span>
                </div>
              ))}
              {Object.keys(reputation).length === 0 && (
                <p className="text-[10px] text-slate-600 italic">No reputation established.</p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="p-8 overflow-y-auto max-h-screen">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 uppercase italic tracking-tighter">Available Jobs</h2>
                  <p className="text-slate-400 text-sm">Contract list retrieved from Meta-Server at 0.0.0.0</p>
                </div>
                <button onClick={loadInitialData} className="rpg-button flex items-center gap-2">
                  <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Sync
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {quests.map(q => (
                  <motion.div 
                    key={q.id}
                    layoutId={q.id}
                    onClick={() => setActiveQuest(q)}
                    className="rpg-panel hover:border-amber-500/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${q.id.includes('PYRAT') ? 'bg-red-950 text-red-400' : 'bg-blue-950 text-blue-400'}`}>
                            {q.INHERIT}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {q.id}</span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-100 group-hover:text-amber-400 transition-colors">{q.id.replace(/_/g, ' ')}</h4>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500 font-mono text-sm font-bold">
                        <Coins size={14} /> {q.allattrib.COINS}
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2 italic">"{q.allattrib.description}"</p>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
                       <div className="flex gap-4">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                             <Users size={12} /> {q.allattrib.REP_NAME} ({q.allattrib.REP_COST})
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-500">
                             <TrendingUp size={12} /> +{q.allattrib.REWARD_REP_AMT1}
                          </div>
                       </div>
                       <ChevronRight size={16} className="text-slate-600 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
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
              className="max-w-6xl mx-auto"
            >
              <h2 className="text-3xl font-bold text-white mb-8">WORLD LOGISTICS</h2>
              <QuestTreeVisualizer quests={quests} />
            </motion.div>
          )}

          {view === 'editor' && (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="rpg-panel border-amber-500/30">
                <div className="flex items-center gap-3 mb-6">
                  <Upload className="text-amber-500" />
                  <h2 className="text-2xl font-bold">BLUEPRINT INJECTION</h2>
                </div>
                <p className="text-slate-400 text-sm mb-6">Paste quest progression structures (Lua/JSON format) to update the global registry.</p>
                
                <textarea 
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  placeholder="return { QUEST_ID = { ... } }"
                  className="w-full h-[400px] bg-slate-950 border border-slate-800 rounded p-4 font-mono text-xs text-amber-500/80 focus:outline-none focus:border-amber-500 mb-6"
                />

                <div className="flex gap-4">
                  <button 
                    onClick={handleUpload}
                    disabled={loading || !uploadText}
                    className="rpg-button rpg-button-primary w-full disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Upload to Meta-Storage'}
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
                    className="rpg-button w-48 flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Download JSON
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quest Modal */}
      <AnimatePresence>
        {activeQuest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveQuest(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              layoutId={activeQuest.id}
              className="relative w-full max-w-xl rpg-panel border-amber-500 bg-slate-900 border-2"
            >
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-white uppercase italic tracking-tighter">Contract: {activeQuest.id.replace(/_/g, ' ')}</h3>
                <button onClick={() => setActiveQuest(null)} className="text-slate-500 hover:text-white transition-colors">&times;</button>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded italic text-amber-500/90 text-sm leading-relaxed border-l-4 border-l-amber-500 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-1 opacity-10">
                    <History size={60} />
                  </div>
                  "{activeQuest.allattrib.LOOPMESSAGE}"
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rpg-panel bg-slate-950/30 p-4 border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Requirement</div>
                    <div className="flex items-center gap-2 font-bold">
                       <ShieldCheck size={16} className="text-amber-500" />
                       {activeQuest.allattrib.ITEM1_QTY}x {activeQuest.allattrib.ITEM1 || 'N/A'}
                    </div>
                    <div className="text-[10px] text-red-400 mt-2">Cost: {activeQuest.allattrib.REP_COST} {activeQuest.allattrib.REP_NAME.replace('REP_', '')}</div>
                  </div>
                  <div className="rpg-panel bg-slate-950/30 p-4 border-slate-800 text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Reward</div>
                    <div className="flex items-center justify-end gap-2 font-bold text-amber-400 text-xl italic font-display">
                       {activeQuest.allattrib.COINS} <Coins size={20} />
                    </div>
                    <div className="text-[10px] text-green-400 mt-2">Reputation: +{activeQuest.allattrib.REWARD_REP_AMT1}</div>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 border border-slate-800 rounded font-mono text-[10px] text-slate-500">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={12} /> META ADVISORY
                  </div>
                  <p>Accepting this contract will impact your standing with local factions. CD Timer: {activeQuest.allattrib.CD} units.</p>
                </div>

                <button 
                  onClick={() => handleRepAction(activeQuest)}
                  className="rpg-button rpg-button-primary w-full py-4 text-lg"
                >
                  Confirm Contract Execution
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
