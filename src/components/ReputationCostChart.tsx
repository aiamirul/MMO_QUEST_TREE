/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Quest } from '../types';

interface Props {
  quests: Quest[];
}

export const ReputationCostChart: React.FC<Props> = ({ quests }) => {
  // Filter quests with valid reputation cost and label them
  const data = quests
    .filter(q => q.allattrib.REP_NAME)
    .sort((a, b) => a.allattrib.REP_COST - b.allattrib.REP_COST)
    .map((q, index) => ({
      index,
      name: q.id,
      cost: q.allattrib.REP_COST,
      faction: q.allattrib.REP_NAME,
      reward: q.allattrib.REWARD_REP_AMT1
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const q = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-700 p-3 rounded shadow-2xl text-[10px] font-mono">
          <p className="text-amber-500 font-bold mb-1">{q.name}</p>
          <p className="text-slate-300">REQ: {q.cost} {q.faction}</p>
          <p className="text-green-500">REWARD: +{q.reward}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rpg-panel h-[300px] w-full">
      <h3 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] mb-4 uppercase">Quest Economics: Rep Cost Hurdle</h3>
      <ResponsiveContainer width="100%" height="85%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis 
            type="number" 
            dataKey="index" 
            name="Sequence" 
            hide 
          />
          <YAxis 
            type="number" 
            dataKey="cost" 
            name="Reputation Cost" 
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis type="number" range={[60, 60]} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#334155' }} />
          <Scatter name="Quests" data={data} fill="#fbbf24">
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.cost > 30 ? '#ef4444' : entry.cost > 10 ? '#f59e0b' : '#10b981'} 
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
