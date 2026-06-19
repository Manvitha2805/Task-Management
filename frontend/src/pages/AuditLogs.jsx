import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { ShieldAlert, Search, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export default function AuditLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const url = `/api/audit?search=${encodeURIComponent(search)}&action=${actionFilter}&limit=${limit}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs);
        setTotal(data.pagination.total);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token, offset, actionFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0);
    fetchLogs();
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(prev => prev + limit);
    }
  };

  const handlePrevPage = () => {
    if (offset - limit >= 0) {
      setOffset(prev => prev - limit);
    }
  };

  const formatDetails = (detailsStr) => {
    try {
      // Check if details is JSON
      if (detailsStr.startsWith('{') || detailsStr.startsWith('[')) {
        const obj = JSON.parse(detailsStr);
        return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
      }
    } catch (e) {}
    return detailsStr;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white">System Audit Logs</h3>
        <p className="text-xs text-slate-500 mt-0.5">Search and inspect security audits, logins, settings, and task changes.</p>
      </div>

      {/* Filter bar */}
      <div className="glass-card rounded-3xl border border-slate-800 p-5 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search details, IPs, users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs text-white"
          />
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
            className="w-full sm:w-48 px-4 py-2.5 rounded-xl glass-input text-slate-400 text-xs font-semibold"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">User Logins</option>
            <option value="LOGIN_MFA">MFA Logins</option>
            <option value="LOGOUT">User Logouts</option>
            <option value="PUNCH_IN">Attendance Clock In</option>
            <option value="PUNCH_OUT">Attendance Clock Out</option>
            <option value="TASK_CREATE">Task Creation</option>
            <option value="TASK_UPDATE">Task Updates</option>
            <option value="LEAVE_APPLY">Leave Applications</option>
            <option value="LEAVE_APPROVE">Leave Approvals</option>
            <option value="SETTINGS_UPDATE">Settings Altered</option>
            <option value="MFA_ENABLE">MFA Setup Enabled</option>
          </select>

          <button
            onClick={() => { setSearch(''); setActionFilter(''); setOffset(0); fetchLogs(); }}
            className="p-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[30vh]">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/30 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="p-4">User</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-xs">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-900/10">
                    <td className="p-4">
                      <div className="font-bold text-white">{log.user?.name || 'System / Guest'}</div>
                      <div className="text-[10px] text-slate-500">{log.user?.email || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded border border-blue-900/20 bg-blue-950/20 text-blue-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300 max-w-sm truncate" title={log.details}>
                      {formatDetails(log.details)}
                    </td>
                    <td className="p-4 font-mono text-slate-450">{log.ipAddress || '-'}</td>
                    <td className="p-4 text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">No system audit logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-900 flex justify-between items-center text-xs text-slate-450 bg-slate-950/30">
            <div>
              Showing <strong className="text-white">{offset + 1}</strong> to <strong className="text-white">{Math.min(offset + limit, total)}</strong> of <strong className="text-white">{total}</strong> logs
            </div>
            
            <div className="flex gap-2">
              <button
                disabled={offset === 0}
                onClick={handlePrevPage}
                className="p-2 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-450 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={offset + limit >= total}
                onClick={handleNextPage}
                className="p-2 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-455 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
