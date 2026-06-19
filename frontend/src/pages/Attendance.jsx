import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { Clock, Play, Square, Calendar, ArrowUpRight, Search, Download } from 'lucide-react';

export default function Attendance() {
  const { user, token } = useAuth();
  const [punchStatus, setPunchStatus] = useState({ punchedIn: false, attendance: null });
  const [history, setHistory] = useState([]);
  const [teamLogs, setTeamLogs] = useState([]);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [loading, setLoading] = useState(true);

  // Time Tracker state
  const [secondsActive, setSecondsActive] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch personal today punch status
      const statusRes = await fetch('/api/attendance/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statusRes.ok) {
        const sData = await statusRes.json();
        setPunchStatus(sData);

        // Update active seconds tracker if punched in
        if (sData.punchedIn && sData.activeSession) {
          const loginTime = new Date(sData.activeSession.loginTime);
          const diff = Math.floor((Date.now() - loginTime.getTime()) / 1000);
          setSecondsActive(sData.attendance.totalDuration + diff);
        } else if (sData.attendance) {
          setSecondsActive(sData.attendance.totalDuration);
        }
      }

      // Fetch personal history
      const historyRes = await fetch('/api/attendance/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (historyRes.ok) {
        const hData = await historyRes.json();
        setHistory(hData.history);
      }

      // Fetch team records (Managers / Admins / HR)
      if (['ADMIN', 'HR', 'MANAGER'].includes(user.role)) {
        const teamRes = await fetch('/api/attendance/employees', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (teamRes.ok) {
          const tData = await teamRes.json();
          setTeamLogs(tData.employees);
        }
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Live timer tick for active duration
  useEffect(() => {
    let timer;
    if (punchStatus.punchedIn) {
      timer = setInterval(() => {
        setSecondsActive(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [punchStatus.punchedIn]);

  const handlePunch = async () => {
    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatDuration = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs}h ${mins}m ${s}s`;
  };

  // Helper status color mapping
  const getStatusBadge = (status) => {
    const mapping = {
      PRESENT: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30',
      LATE: 'bg-yellow-950/40 text-yellow-400 border-yellow-900/30',
      HALF_DAY: 'bg-blue-950/40 text-blue-400 border-blue-900/30',
      LEAVE: 'bg-purple-950/40 text-purple-400 border-purple-900/30',
      ABSENT: 'bg-rose-950/40 text-rose-400 border-rose-900/30',
    };
    return `text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${mapping[status] || 'bg-slate-800 text-slate-400'}`;
  };

  // Filter team members based on search query
  const filteredTeam = teamLogs.filter(member => 
    member.name.toLowerCase().includes(searchEmployee.toLowerCase()) ||
    member.email.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Punch Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card rounded-3xl border border-slate-800 p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="space-y-4 text-center md:text-left">
            <h3 className="text-xl font-bold text-white">Attendance Punching Clock</h3>
            <p className="text-slate-400 text-xs max-w-sm">Clock-in begins your daily attendance logging. Total duration resets at midnight, summing multiple active sessions.</p>
            
            <div className="grid grid-cols-2 gap-6 pt-4 max-w-sm">
              <div className="p-3 bg-slate-900/50 border border-slate-850 rounded-xl text-center md:text-left">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Today's Duration</div>
                <div className="text-sm font-bold text-white font-mono mt-0.5">{formatDuration(secondsActive)}</div>
              </div>
              <div className="p-3 bg-slate-900/50 border border-slate-850 rounded-xl text-center md:text-left">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Punch Count</div>
                <div className="text-sm font-bold text-white font-mono mt-0.5">{punchStatus.attendance?.sessionCount || 0} sessions</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 shrink-0">
            <button
              onClick={handlePunch}
              className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 border-4 transition-all duration-300 active:scale-95 shadow-xl ${
                punchStatus.punchedIn
                  ? 'bg-rose-950/30 border-rose-600/60 text-rose-400 hover:bg-rose-950/50 shadow-rose-900/10'
                  : 'bg-emerald-950/30 border-emerald-600/60 text-emerald-400 hover:bg-emerald-950/50 shadow-emerald-900/10'
              }`}
            >
              {punchStatus.punchedIn ? (
                <>
                  <Square className="w-8 h-8 fill-rose-400" />
                  <span className="font-extrabold text-sm uppercase tracking-wider">Punch Out</span>
                </>
              ) : (
                <>
                  <Play className="w-8 h-8 fill-emerald-400 ml-1 animate-pulse" />
                  <span className="font-extrabold text-sm uppercase tracking-wider">Punch In</span>
                </>
              )}
            </button>
            <span className={`text-xs font-bold px-3.5 py-1.5 rounded-full border uppercase ${
              punchStatus.punchedIn
                ? 'bg-emerald-950/30 text-emerald-450 border-emerald-900/30'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}>
              {punchStatus.punchedIn ? 'Active Work session' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Quick info list of today's logs */}
        <div className="glass-card rounded-3xl border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm text-white mb-4">Today's Punch Log</h4>
            <div className="space-y-3.5 max-h-36 overflow-y-auto">
              {punchStatus.attendance?.sessions?.map((session, idx) => (
                <div key={session.id} className="text-xs flex justify-between items-center py-2 border-b border-slate-900">
                  <span className="text-slate-400">Session {idx + 1}</span>
                  <span className="font-mono text-white">
                    {new Date(session.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {session.logoutTime ? new Date(session.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                  </span>
                </div>
              ))}
              {(!punchStatus.attendance?.sessions || punchStatus.attendance.sessions.length === 0) && (
                <p className="text-xs text-slate-500 text-center py-8">No login sessions recorded today.</p>
              )}
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-900 text-[10px] text-slate-500 text-center flex items-center gap-1.5 justify-center">
            <Clock className="w-4 h-4 text-blue-400" /> Default office hours: 09:00 AM - 06:00 PM
          </div>
        </div>
      </div>

      {/* ADMIN & MANAGER SECTION */}
      {['ADMIN', 'HR', 'MANAGER'].includes(user.role) && (
        <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Team Attendance Tracking</h3>
              <p className="text-xs text-slate-500 mt-0.5">Track daily activity logs, late marks, and monthly statuses for your direct reports.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs text-white"
                />
              </div>

              {/* CSV Export */}
              <a
                href={`/api/reports/attendance?token=${token}`}
                download
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 flex items-center gap-2 text-xs font-bold shrink-0 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">Export CSV</span>
              </a>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-slate-900 pt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Employee</th>
                  <th className="pb-3 px-4">Role</th>
                  <th className="pb-3 px-4">Today Login</th>
                  <th className="pb-3 px-4">Today Logout</th>
                  <th className="pb-3 px-4">Active Duration</th>
                  <th className="pb-3 px-4">Daily Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-xs">
                {filteredTeam.map(emp => {
                  const todayRec = emp.attendances && emp.attendances[0]; // Sorted desc in API
                  const isToday = todayRec && todayRec.date === new Date().toISOString().split('T')[0];

                  return (
                    <tr key={emp.id} className="hover:bg-slate-900/30">
                      <td className="py-3.5 pr-4 font-bold text-white">{emp.name}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-medium uppercase tracking-wide text-[10px]">{emp.role}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-350">
                        {isToday && todayRec.firstLogin ? new Date(todayRec.firstLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-350">
                        {isToday && todayRec.lastLogout ? new Date(todayRec.lastLogout).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-450">
                        {isToday ? formatDuration(todayRec.totalDuration) : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {isToday ? (
                          <span className={getStatusBadge(todayRec.status)}>{todayRec.status}</span>
                        ) : (
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-slate-900 bg-slate-900 text-slate-650">Absent</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTeam.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">No matching employee records.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Personal History */}
      <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white">Your Attendance History</h3>
          <p className="text-xs text-slate-500 mt-0.5">Review your personal daily punch timings, active durations, and status calculations.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 px-4">First Clock In</th>
                <th className="pb-3 px-4">Last Clock Out</th>
                <th className="pb-3 px-4">Total Active Duration</th>
                <th className="pb-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-xs">
              {history.map(item => (
                <tr key={item.id} className="hover:bg-slate-900/20">
                  <td className="py-3.5 pr-4 font-bold text-white">{item.date}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {item.firstLogin ? new Date(item.firstLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {item.lastLogout ? new Date(item.lastLogout).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-350">{formatDuration(item.totalDuration)}</td>
                  <td className="py-3.5 px-4">
                    <span className={getStatusBadge(item.status)}>{item.status}</span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">No attendance history logged.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
