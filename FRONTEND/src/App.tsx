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

interface MarriageNode extends d3.SimulationNodeDatum {
  id: number;
  type: 'marriage';
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
  
      const nodes: (FamilyNode | MarriageNode)[] = familyMembers.map((member, index) => ({
        id: index,
        name: `${member.first_name} ${member.last_name}`,
        parent_marriage_id: member.parent_marriage_id,
        marriage_id: member.marriage_id,
      }));

      const marriageNodes: MarriageNode[] = [];
      const marriageMap = new Map<number, number[]>();
  
      nodes.forEach(node => {
        if ('marriage_id' in node && node.marriage_id !== null) {
          if (!marriageMap.has(node.marriage_id)) {
            const marriageNode: MarriageNode = { id: nodes.length + marriageNodes.length, type: 'marriage' };
            marriageNodes.push(marriageNode);
            marriageMap.set(node.marriage_id, [marriageNode.id]);
          }
          marriageMap.get(node.marriage_id)!.push(node.id);
        }
      });

      nodes.push(...marriageNodes);
  
      const links: { source: number; target: number }[] = [];
  
      nodes.forEach(node => {
        if ('parent_marriage_id' in node && node.parent_marriage_id !== null) {
          const parent = nodes.find(n => 'marriage_id' in n && n.marriage_id === node.parent_marriage_id);
          if (parent) {
            links.push({ source: parent.id, target: node.id });
          }
        }
      });
  
      marriageMap.forEach(ids => {
        const marriageNodeId = ids[0];
        for (let i = 1; i < ids.length; i++) {
          links.push({ source: marriageNodeId, target: ids[i] });
        }
      });
  
      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => (d as FamilyNode | MarriageNode).id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));
  
      const link = svg.append('g')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke-width', 1.5)
        .attr('stroke', '#999');
  
      const node = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', d => 'type' in d && d.type === 'marriage' ? 8 : 5)
        .attr('fill', d => 'type' in d && d.type === 'marriage' ? 'yellow' : '#69b3a2')
        .call(d3.drag<SVGCircleElement, FamilyNode | MarriageNode>()
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
        .text(d => 'name' in d ? d.name : 'Marriage');
  
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
  
      function dragstarted(event: d3.D3DragEvent<SVGCircleElement, FamilyNode | MarriageNode, FamilyNode | MarriageNode>, d: FamilyNode | MarriageNode) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
  
      function dragged(event: d3.D3DragEvent<SVGCircleElement, FamilyNode | MarriageNode, FamilyNode | MarriageNode>, d: FamilyNode | MarriageNode) {
        d.fx = event.x;
        d.fy = event.y;
      }
  
      function dragended(event: d3.D3DragEvent<SVGCircleElement, FamilyNode | MarriageNode, FamilyNode | MarriageNode>, d: FamilyNode | MarriageNode) {
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