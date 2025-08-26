'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api-data`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserLogs = async (userId: string) => {
    if (!userId) {
      setUserLogs([]);
      return;
    }
    
    setLogsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/get-logs/${userId}?limit=100`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      setUserLogs(result.logs || []);
    } catch (err: any) {
      console.error('Failed to load logs:', err);
      setUserLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const downloadUserLogs = async () => {
    if (!selectedUserId) return;
    
    try {
      const response = await fetch(`${API_BASE}/get-logs/${selectedUserId}?limit=10000`);
      const result = await response.json();
      
      const jsonString = JSON.stringify(result.logs, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedUserId}_logs_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download logs:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-600 to-black p-5">
        <div className="max-w-7xl mx-auto bg-white rounded-2xl p-8">
          <div className="text-center text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-600 to-black p-5">
        <div className="max-w-7xl mx-auto bg-white rounded-2xl p-8">
          <div className="bg-red-500 text-white p-4 rounded-lg text-center">
            Failed to load data: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-gradient-to-br from-gray-600 to-black p-5 text-gray-800">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl p-8">
  <h1 className="text-4xl font-bold text-center mb-8">
          🎨 Artographer Data API Dashboard
        </h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-gradient-to-br from-gray-600 to-black text-white p-6 rounded-xl shadow-lg hover:-translate-y-1 transition-transform">
            <div className="text-5xl font-bold mb-3">{data?.users?.length || 0}</div>
            <div className="text-lg opacity-95">Total Users</div>
          </div>
          <div className="bg-gradient-to-br from-gray-600 to-black text-white p-6 rounded-xl shadow-lg hover:-translate-y-1 transition-transform">
            <div className="text-5xl font-bold mb-3">{data?.userImages?.length || 0}</div>
            <div className="text-lg opacity-95">User Images</div>
          </div>
          <div className="bg-gradient-to-br from-gray-600 to-black text-white p-6 rounded-xl shadow-lg hover:-translate-y-1 transition-transform">
            <div className="text-5xl font-bold mb-3">{data?.pinnedArtworks?.length || 0}</div>
            <div className="text-lg opacity-95">Pinned Artworks</div>
          </div>
          <div className="bg-gradient-to-br from-gray-600 to-black text-white p-6 rounded-xl shadow-lg hover:-translate-y-1 transition-transform">
            <div className="text-5xl font-bold mb-3">{userLogs.length}</div>
            <div className="text-lg opacity-95">User Logs</div>
          </div>
        </div>

        {/* API Endpoints */}
        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">📡 API Endpoints</h2>
          
          <div className="space-y-4">
            <ApiEndpoint 
              method="GET" 
              path="/get-user/{id}"
              description="Get user data"
              curl={`curl -X GET ${API_BASE}/get-user/shm`}
            />
            <ApiEndpoint 
              method="POST" 
              path="/add-user"
              description="Create new user"
              curl={`curl -X POST ${API_BASE}/add-user \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "newuser"}'`}
            />
            <ApiEndpoint 
              method="POST" 
              path="/log-event"
              description="Log user event"
              curl={`curl -X POST ${API_BASE}/log-event \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "testuser", "system": "A", "taskNumber": 4, "message": "artwork clicked"}'`}
              note="System should be 'A' (Artographer) or 'B' (Baseline). Task number ranges from 1-4."
            />
            <ApiEndpoint 
              method="DELETE" 
              path="/user/{id}"
              description="Delete user and all data"
              curl={`curl -X DELETE ${API_BASE}/user/shm`}
            />
          </div>
        </div>

        <button 
          onClick={loadData}
          className="bg-gradient-to-br from-gray-600 to-black text-white px-8 py-3 rounded-lg text-lg font-semibold hover:scale-105 transition-transform mb-8"
        >
          🔄 Refresh Data
        </button>

        {/* User Logs Table */}
        <div className="mb-10">
          <h3 className="text-2xl font-bold mb-4">📝 Recent User Logs</h3>
          <div className="mb-4 flex items-center gap-4">
            <select 
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                loadUserLogs(e.target.value);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a user to view logs...</option>
              {data?.users?.map((user: any) => (
                <option key={user.user_id} value={user.user_id}>{user.user_id}</option>
              ))}
            </select>
            
            {selectedUserId && (
              <>
                <button
                  onClick={downloadUserLogs}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  📥 Download Logs as JSON
                </button>
                <span className="text-gray-600">
                  ({userLogs.length} logs found)
                </span>
              </>
            )}
          </div>
          
          <DataTable
            headers={['ID', 'Timestamp', 'System', 'Task #', 'Message', 'Event Data']}
            loading={logsLoading}
            emptyMessage={selectedUserId ? `No logs found for user: ${selectedUserId}` : 'Select a user to view their logs'}
          >
            {userLogs.map((log) => {
              const eventData = typeof log.event_data === 'string' ? JSON.parse(log.event_data) : log.event_data;
              const system = eventData.system || 'N/A';
              const taskNumber = eventData.taskNumber || 'N/A';
              
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 border-b">{log.id}</td>
                  <td className="px-4 py-3 border-b">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
                  <td className="px-4 py-3 border-b">
                    <span className={`font-bold ${system === 'A' ? 'text-purple-600' : 'text-purple-800'}`}>
                      {system}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b">{taskNumber}</td>
                  <td className="px-4 py-3 border-b">{log.message || eventData.message || 'N/A'}</td>
                  <td className="px-4 py-3 border-b">
                    <pre className="text-xs text-gray-600 max-w-xs overflow-x-auto">
                      {JSON.stringify(eventData, null, 2)}
                    </pre>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>

        {/* Users Table */}
        <div className="mb-10">
          <h3 className="text-2xl font-bold mb-4">👥 Users</h3>
          <DataTable 
            headers={['User ID', 'User Image IDs', 'Pinned Artwork IDs', 'Created At', 'Updated At']}
            loading={loading}
            emptyMessage="No users found"
          >
            {data?.users?.map((user: any) => (
              <tr key={user.user_id} className="hover:bg-gray-50 text-gray-900">
                <td className="px-4 py-3 border-b font-semibold">{user.user_id}</td>
                
                <td className="px-4 py-3 border-b font-mono text-sm text-gray-600 max-w-xs overflow-x-auto whitespace-nowrap">
                  {Array.isArray(user.userImageIds)
                    ? `[${user.userImageIds.slice(0, 10).join(', ')}${user.userImageIds.length > 10 ? ', ...' : ''}]`
                    : user.userImageIds || '[]'}
                </td>
                <td className="px-4 py-3 border-b font-mono text-sm text-gray-600 max-w-xs overflow-x-auto whitespace-nowrap">
                  {Array.isArray(user.pinnedArtworkIds)
                    ? `[${user.pinnedArtworkIds.slice(0, 10).join(', ')}${user.pinnedArtworkIds.length > 10 ? ', ...' : ''}]`
                    : user.pinnedArtworkIds || '[]'}
                </td>
                <td className="px-4 py-3 border-b">{user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}</td>
                <td className="px-4 py-3 border-b">{user.updatedAt ? new Date(user.updatedAt).toLocaleString() : 'N/A'}</td>
              </tr>
            ))}
          </DataTable>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t text-center text-gray-600">
          <p>🚀 Artographer Data API • Running on port 3001</p>
        </div>
      </div>
    </div>
  );
}

function ApiEndpoint({ method, path, description, curl, note }: any) {
  const methodColors = {
    GET: 'bg-green-600',
    POST: 'bg-blue-600',
    DELETE: 'bg-red-600',
  };

  return (
    <div className="bg-white p-4 rounded-lg border-l-4 border-purple-600">
      <div className="flex items-center gap-3 mb-2">
        <span className={`${methodColors[method as keyof typeof methodColors]} text-white px-2 py-1 rounded text-sm font-bold`}>
          {method}
        </span>
        <strong className="text-lg">{path}</strong>
        <span className="text-gray-600">- {description}</span>
      </div>
      <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
        {curl}
      </pre>
      {note && (
        <p className="text-sm text-gray-600 mt-2">
          <strong>Note:</strong> {note}
        </p>
      )}
    </div>
  );
}

function DataTable({ headers, children, loading, emptyMessage }: any) {
  return (
    <div className="overflow-x-auto shadow-lg rounded-lg">
      <table className="w-full bg-white">
        <thead className="bg-gradient-to-r from-gray-600 to-black text-white">
          <tr>
            {headers.map((header: string) => (
              <th key={header} className="px-4 py-3 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-600">
                Loading...
              </td>
            </tr>
          ) : !children || (Array.isArray(children) && children.length === 0) ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-600">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}