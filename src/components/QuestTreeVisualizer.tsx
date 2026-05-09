/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Quest } from '../types';

interface Props {
  quests: Quest[];
}

export const QuestTreeVisualizer: React.FC<Props> = ({ quests }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || quests.length === 0) return;

    const width = 800;
    const height = 500;
    
    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto;');

    const g = svg.append('g').attr('transform', 'translate(40,0)');

    // Create a simple hierarchy based on ID or sequence if no explicit parent is provided
    // For this demo, we'll group by "Island" (prefix)
    const groups: Record<string, any[]> = {};
    quests.forEach(q => {
      const prefix = q.id.split('_')[0];
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(q);
    });

    const rootData = {
      name: "World Progression",
      children: Object.entries(groups).map(([name, items]) => ({
        name,
        children: items.map(i => ({ name: i.id, data: i }))
      }))
    };

    const root = d3.hierarchy(rootData);
    const treeLayout = d3.tree().size([height, width - 200]);
    treeLayout(root);

    // Links
    g.selectAll('.link')
      .data(root.links())
      .enter().append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkHorizontal()
        .x((d: any) => d.y)
        .y((d: any) => d.x) as any);

    // Nodes
    const node = g.selectAll('.node')
      .data(root.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

    node.append('circle')
      .attr('r', 4)
      .attr('fill', (d: any) => d.children ? '#fbbf24' : '#64748b');

    node.append('text')
      .attr('dy', '0.31em')
      .attr('x', (d: any) => d.children ? -8 : 8)
      .attr('text-anchor', (d: any) => d.children ? 'end' : 'start')
      .text((d: any) => d.data.name)
      .attr('fill', '#e2e8f0')
      .style('font-size', '10px')
      .style('font-family', 'Inter, sans-serif')
      .clone(true).lower()
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 3);

  }, [quests]);

  return (
    <div className="rpg-panel overflow-hidden">
      <h3 className="text-amber-500 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        QUEST PROGRESSION MAPPING
      </h3>
      <div className="relative border border-slate-800 rounded bg-slate-950/50">
        <svg ref={svgRef} />
      </div>
    </div>
  );
};
