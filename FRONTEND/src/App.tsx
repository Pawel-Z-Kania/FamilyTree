import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

interface FamilyMember {
  first_name: string;
  last_name: string;
  parent_marriage_id: number;
  marriage_id: number;
}

function App() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    axios.get('http://localhost:3000/api/family-members')
      .then(response => {
        setFamilyMembers(response.data);
      })
      .catch(error => {
        console.error('There was an error fetching the family members!', error);
      });
  }, []);

  return (
    <div>
      <h1>Family Members</h1>
      <div className="family-members-container">
        {familyMembers.map((member, index) => (
          <div key={index} className="family-member-box">
            <p>{member.first_name} {member.last_name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;