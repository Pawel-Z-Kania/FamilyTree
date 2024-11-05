import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';
import './App.css';


// INTERFACES ============================================================================================================

interface FamilyMember {
  first_name: string;
  last_name: string;
  parent_marriage_id: number | null;
  marriage_id: number | null;
  date_of_birth: string;
  date_of_death: string | null;
  description: string;
}

interface FamilyNode extends d3.SimulationNodeDatum {
  id: number;
  name: string;
  parent_marriage_id: number | null;
  marriage_id: number | null;
  date_of_birth: string;
}

interface MarriageNode extends d3.SimulationNodeDatum {
  id: number;
  type: 'marriage';
}


// COMPONENT =============================================================================================================

function App() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [newMember, setNewMember] = useState({
    first_name: '',
    last_name: '',
    relative: '',
    relationship: '',
    date_of_birth: '',
    date_of_death: '',
    description: ''
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const displayWidth = window.innerWidth;
  const displayHeight = 800;
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [popupInfo, setPopupInfo] = useState<{ x: number; y: number; member: FamilyMember | null }>({ x: 0, y: 0, member: null });


  // #region LOADING AND SAVING DATA ====================================================================================

  useEffect(() => {
    axios.get('http://localhost:3000/api/family-members')
      .then(response => {
        setFamilyMembers(response.data);
      })
      .catch(error => {
        console.error('There was an error fetching the family members!', error);
      });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewMember(prevState => ({ ...prevState, [name]: value }));
  };

  const handleAddMember = () => {
    if (!newMember.relative || !newMember.relationship) {
      alert('Please select a relative and a relationship type.');
      return;
    }

    const relative = familyMembers.find(member => `${member.first_name} ${member.last_name}` === newMember.relative);
    if (!relative) {
      alert('Selected relative not found.');
      return;
    }

    const newFamilyMember: FamilyMember = {
      first_name: newMember.first_name,
      last_name: newMember.last_name,
      parent_marriage_id: null,
      marriage_id: null,
      date_of_birth: newMember.date_of_birth,
      date_of_death: newMember.date_of_death || null,
      description: newMember.description,
    };

    switch (newMember.relationship) {
      case 'sibling':
        if (relative.parent_marriage_id) {
          newFamilyMember.parent_marriage_id = relative.parent_marriage_id;
        } else {
          const newParentMarriageId = Date.now();
          newFamilyMember.parent_marriage_id = newParentMarriageId;
          relative.parent_marriage_id = newParentMarriageId;
        }
        break;
      case 'child':
        if (relative.marriage_id) {
          newFamilyMember.parent_marriage_id = relative.marriage_id;
        } else {
          const newMarriageId = Date.now();
          newFamilyMember.parent_marriage_id = newMarriageId;
          relative.marriage_id = newMarriageId;
        }
        break;
      case 'parent':
        if (relative.parent_marriage_id) {
          newFamilyMember.marriage_id = relative.parent_marriage_id;
        } else {
          const newParentMarriageId = Date.now();
          newFamilyMember.marriage_id = newParentMarriageId;
          relative.parent_marriage_id = newParentMarriageId;
        }
        break;
      case 'spouse':
        if (relative.marriage_id) {
          newFamilyMember.marriage_id = relative.marriage_id;
        } else {
          const newMarriageId = Date.now();
          newFamilyMember.marriage_id = newMarriageId;
          relative.marriage_id = newMarriageId;
        }
        break;
      default:
        alert('Invalid relationship type.');
        return;
    }

    axios.post('http://localhost:3000/api/family-members', { newFamilyMember, relative })
      .then(response => {
        setFamilyMembers([...familyMembers, response.data.newFamilyMember, response.data.relative]);
        setNewMember({ first_name: '', last_name: '', relative: '', relationship: '', date_of_birth: '', date_of_death: '', description: '' });
      })
      .catch(error => {
        console.error('There was an error adding the family member!', error);
      });
  };

  // #endregion LOADING AND SAVING DATA ====================================================================================


  const toggleFormVisibility = () => {
    setIsFormVisible(!isFormVisible);
  };

  const handleRightClick = (event: React.MouseEvent, member: FamilyMember) => {
    event.preventDefault();
    setPopupInfo({ x: event.clientX, y: event.clientY, member });
  };

  const handleClosePopup = () => {
    setPopupInfo({ x: 0, y: 0, member: null });
  };



  // #region D3 GRAPH =================================================================================================

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
        date_of_birth: member.date_of_birth,
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

      const parentMarriageMap = new Map<number, number[]>();

      nodes.forEach(node => {
        if ('parent_marriage_id' in node && node.parent_marriage_id !== null) {
          if (!parentMarriageMap.has(node.parent_marriage_id)) {
            parentMarriageMap.set(node.parent_marriage_id, []);
          }
          parentMarriageMap.get(node.parent_marriage_id)!.push(node.id);
        }
      });

      parentMarriageMap.forEach((ids, parentMarriageId) => {
        if (ids.length > 1 && !marriageMap.has(parentMarriageId)) {
          const marriageNode: MarriageNode = { id: nodes.length + marriageNodes.length, type: 'marriage' };
          marriageNodes.push(marriageNode);
          marriageMap.set(parentMarriageId, [marriageNode.id, ...ids]);
        }
      });

      nodes.push(...marriageNodes);

      const links: { source: any; target: any; type?: string }[] = [];

      nodes.forEach(node => {
        if ('parent_marriage_id' in node && node.parent_marriage_id !== null) {
          const parentMarriageNode = node.parent_marriage_id !== null ? nodes.find(n => 'type' in n && n.type === 'marriage' && marriageMap.get(node.parent_marriage_id!) && n.id === marriageMap.get(node.parent_marriage_id!)![0]) : null;
          if (parentMarriageNode) {
            links.push({ source: parentMarriageNode.id, target: node.id, type: 'child-link' });
          }
        }
      });

      marriageMap.forEach(ids => {
        const marriageNodeId = ids[0];
        for (let i = 1; i < ids.length; i++) {
          links.push({ source: marriageNodeId, target: ids[i] });
        }
      });


      /// TODO - BELOW /////////////////////////////////////////////////////////////////////////////////////////////////

      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => (d as FamilyNode | MarriageNode).id)
          .distance(d => {

            const link = d as { source: any; target: any };

            console.log('link', link);
            console.log('nodes', nodes);

            //if(link.index)


            if (link.source.type === 'marriage' && link.target.marriage_id != null) {
              return 120;
            }
            return 200;
          }))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('y', d3.forceY().strength(0.1).y(d => {
          if ('date_of_birth' in d && d.date_of_birth) {
            const birthDate = new Date((d as FamilyNode).date_of_birth).getTime();
            const currentDate = new Date().getTime();
            const age = (currentDate - birthDate) / (1000 * 60 * 60 * 24 * 365.25); // Age in years
            return height / 2 - (age - 50) * 10; // Adjust the multiplier as needed
          }

          // TODO - MODIFY this to adjust the y position of marriage nodes
          if ('type' in d && d.type === 'marriage') {
            const connectedNode = nodes.find(node => 'parent_marriage_id' in node && node.parent_marriage_id === (d as MarriageNode).id);
            if (connectedNode) {
              return connectedNode.y! - 100; // Adjust the offset as needed
            }
          }
          return height / 2;
        }));

      /// TODO - ABOVE /////////////////////////////////////////////////////////////////////////////////////////////////  

      const link = svg.append('g')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke-width', 1.5)
        .attr('stroke', d => d.type === 'child-link' ? 'blue' : '#999'); // Different color for child-link

      const linkLabels = svg.append('g')
        .selectAll('text')
        .data(links)
        .enter().append('text')
        .attr('fill', 'red')
        .attr('font-size', '10px')
        .attr('text-anchor', 'middle')
        .text((_d, i) => i.toString());

      const node = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', d => 'type' in d && d.type === 'marriage' ? 4 : 8)
        .attr('fill', d => 'type' in d && d.type === 'marriage' ? 'yellow' : '#69b3a2')
        .style('cursor', d => 'type' in d && d.type === 'marriage' ? 'default' : 'pointer')
        .call(d3.drag<SVGCircleElement, FamilyNode | MarriageNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended))
        .on('contextmenu', (event, d) => {
          const member = 'name' in d ? familyMembers.find(m => `${m.first_name} ${m.last_name}` === d.name) : null;
          if (member) {
            handleRightClick(event, member);
          }
        });

      const labels = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('x', d => d.x!)
        .attr('y', d => d.y!)
        .attr('dy', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', 'gray')
        .text(d => 'name' in d ? d.name : 'Marriage');

      simulation.on('tick', () => {
        link
          .attr('x1', d => ((d.source as unknown) as FamilyNode).x!)
          .attr('y1', d => ((d.source as unknown) as FamilyNode).y!)
          .attr('x2', d => ((d.target as unknown) as FamilyNode).x!)
          .attr('y2', d => ((d.target as unknown) as FamilyNode).y!);

        linkLabels
          .attr('x', d => (((d.source as unknown) as FamilyNode).x! + ((d.target as unknown) as FamilyNode).x!) / 2)
          .attr('y', d => (((d.source as unknown) as FamilyNode).y! + ((d.target as unknown) as FamilyNode).y!) / 2);

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


  // #endregion D3 GRAPH =================================================================================================


  // #region HTML Content =================================================================================================

  return (
    <div style={{ position: 'relative' }}>
      <h1 style={{ textAlign: 'center' }}>Family Members</h1>
      <svg ref={svgRef} width={displayWidth} height={displayHeight}></svg>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', top: '10%', right: '20px', width: '320px', backgroundColor: 'rgb(30 30 30)', borderRadius: '10px', padding: '20px' }}>

        {isFormVisible && (
          <form onSubmit={e => { e.preventDefault(); handleAddMember(); }}
            style={{ width: '90%', marginBottom: '20px' }}>
            <div>Family member details:</div>
            <div style={{ marginBottom: '10px' }}>
              <input
                type="text"
                name="first_name"
                value={newMember.first_name}
                onChange={handleInputChange}
                placeholder="First Name"
                required
                style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: 'lightgrey', color: '#333' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <input
                type="text"
                name="last_name"
                value={newMember.last_name}
                onChange={handleInputChange}
                placeholder="Last Name"
                required
                style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: 'lightgrey', color: '#333' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <input
                type="date"
                name="date_of_birth"
                value={newMember.date_of_birth}
                onChange={handleInputChange}
                placeholder="Date of Birth"
                required
                style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: 'lightgrey', color: '#333' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <input
                type="date"
                name="date_of_death"
                value={newMember.date_of_death}
                onChange={handleInputChange}
                placeholder="Date of Death"
                style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: 'lightgrey', color: '#333' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <textarea
                name="description"
                value={newMember.description}
                onChange={handleInputChange}
                placeholder="Description"
                style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: 'lightgrey', color: '#333' }}
              />
            </div>
            <div></div>Relationships:
            <div style={{ marginBottom: '10px' }}>
              <select
                name="relative"
                value={newMember.relative}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: 'lightgrey', color: '#333' }}
              >
                <option value="">*select relative*</option>
                {familyMembers.map((member, index) => (
                  <option key={index} value={`${member.first_name} {member.last_name}`}>
                    {member.first_name} {member.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '30px' }}>
              <span>is a </span>
              <select
                name="relationship"
                value={newMember.relationship}
                onChange={handleInputChange}
                required
                style={{ width: 'auto', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: 'lightgrey', color: '#333' }}
              >
                <option value="">*relationship type*</option>
                <option value="sibling">Sibling</option>
                <option value="child">Child</option>
                <option value="parent">Parent</option>
                <option value="spouse">Spouse</option>
              </select>
              <span> to this person.</span>
            </div>
            <button
              type="submit"
              style={{ width: '100%', padding: '10px', borderRadius: '5px', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}>
              Add Member
            </button>
          </form>

        )}
        <button onClick={toggleFormVisibility} style={{ backgroundColor: 'rgb(30, 30, 30)', color: 'white', border: 'none', borderRadius: '5px', padding: '10px', cursor: 'pointer' }}>
          {isFormVisible ? 'Hide Form' : 'Show Form'}
        </button>
      </div>

      {popupInfo.member && (
        <div style={{ position: 'absolute', top: popupInfo.y, left: popupInfo.x, backgroundColor: 'rgb(30, 30, 30)', border: '1px solid black', padding: '10px', borderRadius: '5px' }}>
          <div><strong>Name:</strong> {popupInfo.member.first_name} {popupInfo.member.last_name}</div>
          <div><strong>Date of Birth:</strong> {popupInfo.member.date_of_birth}</div>
          <div><strong>Date of Death:</strong> {popupInfo.member.date_of_death || 'N/A'}</div>
          <div><strong>Description:</strong> {popupInfo.member.description}</div>
          <button onClick={handleClosePopup} style={{ marginTop: '10px', padding: '5px', borderRadius: '5px', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}>Close</button>
        </div>
      )}
    </div>
  );
}

export default App;