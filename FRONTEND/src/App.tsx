import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';
import './App.css';

interface FamilyMember {
  first_name: string;
  last_name: string;
  parent_marriage_id: number;
  marriage_id: number;
}

interface FamilyNode extends d3.SimulationNodeDatum {
  id: number;
  name: string;
  parent_marriage_id: number;
  marriage_id: number;
}

function App() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const displayWidth = 1000;
  const displayHeight = 800;

  useEffect(() => {
    axios.get('http://localhost:3000/api/family-members')
      .then(response => {
        setFamilyMembers(response.data);
      })
      .catch(error => {
        console.error('There was an error fetching the family members!', error);
      });
  }, []);
  
  useEffect(() => {
    if (familyMembers.length > 0) {
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove(); // Clear previous content
  
      const width = displayWidth;
      const height = displayHeight;
  
      const nodes: FamilyNode[] = familyMembers.map((member, index) => ({
        id: index,
        name: `${member.first_name} ${member.last_name}`,
        parent_marriage_id: member.parent_marriage_id,
        marriage_id: member.marriage_id,
      }));
  
      const links: { source: number; target: number; marriage_id: number | null }[] = [];
      const marriageMap = new Map<number, number[]>();
  
      nodes.forEach(node => {
        if (node.parent_marriage_id !== null) {
          const parent = nodes.find(n => n.marriage_id === node.parent_marriage_id);
          if (parent) {
            links.push({ source: parent.id, target: node.id, marriage_id: null });
          }
        }
        if (node.marriage_id !== null) {
          if (!marriageMap.has(node.marriage_id)) {
            marriageMap.set(node.marriage_id, []);
          }
          marriageMap.get(node.marriage_id)!.push(node.id);
        }
      });
  
      marriageMap.forEach(ids => {
        for (let i = 0; i < ids.length - 1; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            links.push({ source: ids[i], target: ids[j], marriage_id: ids[i] });
          }
        }
      });
  
      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => (d as FamilyNode).id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));
  
      const link = svg.append('g')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke-width', 1.5)
        .attr('stroke', d => d.marriage_id !== null ? 'yellow' : '#999');
  
      const node = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', 5)
        .attr('fill', '#69b3a2')
        .call(d3.drag<SVGCircleElement, FamilyNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));
  
      const labels = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('x', d => d.x!)
        .attr('y', d => d.y!)
        .attr('dy', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', 'black') 
        .text(d => d.name);
  
      simulation.on('tick', () => {
        link
          .attr('x1', d => ((d.source as unknown) as FamilyNode).x!)
          .attr('y1', d => ((d.source as unknown) as FamilyNode).y!)
          .attr('x2', d => ((d.target as unknown) as FamilyNode).x!)
          .attr('y2', d => ((d.target as unknown) as FamilyNode).y!);
  
        node
          .attr('cx', d => d.x!)
          .attr('cy', d => d.y!);
  
        labels
          .attr('x', d => d.x!)
          .attr('y', d => d.y!);
      });
  
      function dragstarted(event: d3.D3DragEvent<SVGCircleElement, FamilyNode, FamilyNode>, d: FamilyNode) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
  
      function dragged(event: d3.D3DragEvent<SVGCircleElement, FamilyNode, FamilyNode>, d: FamilyNode) {
        d.fx = event.x;
        d.fy = event.y;
      }
  
      function dragended(event: d3.D3DragEvent<SVGCircleElement, FamilyNode, FamilyNode>, d: FamilyNode) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
    }
  }, [familyMembers]);

  return (
    <div>
      <h1>Family Members</h1>
      <svg ref={svgRef} width= {displayWidth} height={displayHeight}></svg>
    </div>
  );
}

export default App;