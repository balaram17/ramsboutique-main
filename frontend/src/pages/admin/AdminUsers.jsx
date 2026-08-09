import React, { useEffect, useState } from 'react';
import api from '../../lib/api';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get('/admin/users').then((r) => setUsers(r.data)); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Joined</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2 font-medium">{u.name}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.phone}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{u.created_at?.split('T')[0]}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="4" className="text-center py-8 text-gray-500">No users yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
