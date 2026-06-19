import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Users, FileText, CheckCircle2, Clock, Calendar, CheckSquare, ChevronRight, Video, ArrowUpRight, Play, Square } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [punchStatus, setPunchStatus] = useState({ punchedIn: false, attendance: null });
  const [loading, setLoading] = useState(true);

  // Time Clock State
  const [timeStr, setTimeStr] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch user attendance status
      const punchRes = await fetch('/api/attendance/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (punchRes.ok) {
        const pData = await punchRes.json();
        setPunchStatus(pData);
      }

      // 2. Fetch tasks
      const tasksRes = await fetch('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tasksRes.ok) {
        const tData = await tasksRes.json();
        setTasks(tData.tasks);
      }

      // 3. Fetch leaves
      const leavesRes = await fetch('/api/leaves', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (leavesRes.ok) {
        const lData = await leavesRes.json();
        setLeaves(lData.leaves);
      }

      // 4. Fetch meetings
      const meetingsRes = await fetch('/api/meetings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meetingsRes.ok) {
        const mData = await meetingsRes.json();
        setMeetings(mData.meetings);
      }

      // 5. Fetch general attendance summary (For Admin/Manager/HR)
      if (['ADMIN', 'HR', 'MANAGER'].includes(user.role)) {
        const summaryRes = await fetch('/api/attendance/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (summaryRes.ok) {
          const sData = await summaryRes.json();
          setAttendanceSummary(sData.summary);
        }
      }

      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const handlePunchToggle = async () => {
    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPunchStatus({ punchedIn: data.punchedIn, attendance: data.attendance });
        fetchDashboardData(); // Refresh summary values
      }
    } catch (e) {
      console.error('Punch clock operation failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Attendance Chart formatting
  const colors = ['#10b981', '#eab308', '#f43f5e', '#a855f7'];
  const chartData = attendanceSummary ? [
    { name: 'Present', value: attendanceSummary.present },
    { name: 'Late Marks', value: attendanceSummary.late },
    { name: 'Absences', value: attendanceSummary.absent },
    { name: 'Approved Leaves', value: attendanceSummary.onLeave },
  ] : [];

  // Employee/Intern Stats
  const activeTasks = tasks.filter(t => ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.status));
  const completedTasksCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const overdueTasksCount = tasks.filter(t => {
    return ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.status) && new Date(t.dueDate) < new Date();
  }).length;

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-950/30 to-slate-950 border border-blue-900/20 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white">Hello, {user.name}!</h2>
          <p className="text-slate-400 mt-1.5 text-sm">Here is a quick overview of your workspace actions today.</p>
        </div>
        <div className="glass-card px-6 py-4 rounded-2xl border border-slate-800 flex items-center gap-4">
          <Clock className="w-6 h-6 text-blue-400 animate-pulse" />
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Local Time</div>
            <div className="text-xl font-bold font-mono text-white">{timeStr}</div>
          </div>
        </div>
      </div>

      {/* DASHBOARDS BY ROLE */}
      {['ADMIN', 'HR', 'MANAGER'].includes(user.role) ? (
        /* Administrative & Manager Dashboard Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Headcount</div>
                <div className="text-3xl font-bold text-white mt-1">{attendanceSummary?.totalEmployees || 0}</div>
              </div>

              <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Active Tasks</div>
                <div className="text-3xl font-bold text-white mt-1">
                  {tasks.filter(t => t.status !== 'COMPLETED').length}
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Pending Leaves</div>
                <div className="text-3xl font-bold text-white mt-1">
                  {leaves.filter(l => l.status === 'PENDING').length}
                </div>
              </div>
            </div>

            {/* Quick Task board */}
            <div className="glass-card rounded-3xl border border-slate-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Recent Task Assignments</h3>
                <Link to="/tasks" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
                  Go to Board <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="space-y-4">
                {tasks.slice(0, 4).map(t => (
                  <div key={t.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-850 flex justify-between items-center hover:border-slate-800 transition-all">
                    <div>
                      <h4 className="font-bold text-sm text-white">{t.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Assigned to: {t.assignedTo?.name || 'Unassigned'}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                      t.status === 'COMPLETED' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' :
                      t.status === 'IN_PROGRESS' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
                {tasks.length === 0 && <p className="text-slate-500 text-center py-6 text-sm">No tasks assigned yet.</p>}
              </div>
            </div>
          </div>

          {/* Side Charts / Lists */}
          <div className="space-y-8">
            {/* Daily Attendance Chart */}
            <div className="glass-card rounded-3xl border border-slate-800 p-6 flex flex-col items-center">
              <h3 className="text-lg font-bold text-white w-full text-left mb-6">Today's Attendance Status</h3>
              
              {attendanceSummary ? (
                <>
                  <div className="w-full h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Custom Legends */}
                  <div className="grid grid-cols-2 gap-4 w-full mt-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="text-slate-400">Present: {attendanceSummary.present}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      <span className="text-slate-400">Late: {attendanceSummary.late}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                      <span className="text-slate-400">Absent: {attendanceSummary.absent}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-slate-400">Leave: {attendanceSummary.onLeave}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-slate-500 text-sm py-12">No attendance data logged today.</div>
              )}
            </div>

            {/* Leave Approval Panel */}
            <div className="glass-card rounded-3xl border border-slate-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Pending Leaves</h3>
                <Link to="/leaves" className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                  Manage all
                </Link>
              </div>

              <div className="space-y-4">
                {leaves.filter(l => l.status === 'PENDING').slice(0, 3).map(l => (
                  <div key={l.id} className="p-3.5 rounded-xl bg-slate-905 border border-slate-850">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-white">{l.user.name}</h4>
                        <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">{l.type.replace('_', ' ')} LEAVE</span>
                      </div>
                      <span className="text-xs text-blue-400 font-mono font-semibold">{l.startDate}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 truncate">Reason: "{l.reason}"</p>
                  </div>
                ))}
                {leaves.filter(l => l.status === 'PENDING').length === 0 && (
                  <p className="text-slate-500 text-center py-6 text-xs">No pending requests.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* EMPLOYEE & INTERN Dashboard Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main User widgets */}
          <div className="lg:col-span-2 space-y-8">
            {/* Time Tracking & Punch clock card */}
            <div className="glass-card rounded-3xl border border-slate-800 p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
              {/* Background accent */}
              <div className="absolute right-0 top-0 w-48 h-48 bg-blue-600/5 rounded-full blur-3xl"></div>
              
              <div className="space-y-3 text-center md:text-left">
                <h3 className="text-lg font-bold text-white">Daily Attendance Punch</h3>
                <p className="text-slate-400 text-xs max-w-sm">Clock in to log your presence, track work sessions, and calculate active work durations automatically.</p>
                {punchStatus.attendance?.firstLogin && (
                  <div className="text-xs text-slate-400 flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2">
                    <div>First login: <strong className="text-white font-mono">{new Date(punchStatus.attendance.firstLogin).toLocaleTimeString()}</strong></div>
                    {punchStatus.attendance.lastLogout && (
                      <div>Last logout: <strong className="text-white font-mono">{new Date(punchStatus.attendance.lastLogout).toLocaleTimeString()}</strong></div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-4 shrink-0">
                <button
                  onClick={handlePunchToggle}
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
                      <Play className="w-8 h-8 fill-emerald-400 ml-1 animate-ping-once" />
                      <span className="font-extrabold text-sm uppercase tracking-wider">Punch In</span>
                    </>
                  )}
                </button>
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${
                  punchStatus.punchedIn
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}>
                  Status: {punchStatus.punchedIn ? 'Active Work' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Task stats and summaries */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-2xl">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Assigned Tasks</div>
                <div className="text-3xl font-extrabold text-white mt-1">{tasks.length}</div>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                  <span className="text-blue-400 font-bold">{activeTasks.length}</span> active tasks remaining
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Completed Tasks</div>
                <div className="text-3xl font-extrabold text-white mt-1">{completedTasksCount}</div>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                  <span className="text-emerald-400 font-bold">
                    {tasks.length ? Math.round((completedTasksCount / tasks.length) * 100) : 0}%
                  </span> completion rate
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl border-rose-900/10 hover:border-rose-900/30">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Overdue Tasks</div>
                <div className="text-3xl font-extrabold text-rose-400 mt-1">{overdueTasksCount}</div>
                <div className="text-[10px] text-slate-400 mt-2">Requires immediate attention</div>
              </div>
            </div>

            {/* My Tasks Board quick view */}
            <div className="glass-card rounded-3xl border border-slate-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Active Task List</h3>
                <Link to="/tasks" className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                  View full board
                </Link>
              </div>

              <div className="space-y-4">
                {activeTasks.slice(0, 3).map(t => (
                  <div key={t.id} className="p-4 rounded-xl bg-slate-905 border border-slate-850 flex justify-between items-center hover:border-slate-800 transition-all">
                    <div>
                      <h4 className="font-bold text-sm text-white">{t.title}</h4>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          t.priority === 'CRITICAL' ? 'bg-rose-950/40 text-rose-400' :
                          t.priority === 'HIGH' ? 'bg-amber-950/40 text-amber-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {t.priority}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-blue-400 font-semibold bg-blue-950/30 px-3 py-1 rounded-lg border border-blue-900/20">
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
                {activeTasks.length === 0 && (
                  <p className="text-slate-500 text-center py-8 text-sm">All clear! No active tasks.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column details */}
          <div className="space-y-8">
            {/* Meetings Widget */}
            <div className="glass-card rounded-3xl border border-slate-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Today's Schedule</h3>
                <Link to="/meetings" className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                  Book Slot
                </Link>
              </div>

              <div className="space-y-4">
                {meetings.filter(m => m.status === 'BOOKED').slice(0, 3).map(m => (
                  <div key={m.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-850 flex gap-3.5 items-start">
                    <Video className="w-5 h-5 text-blue-400 mt-1 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-white">{m.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(m.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">With: {user.role === 'INTERN' || user.role === 'EMPLOYEE' ? m.host?.name : m.guest?.name || m.guestName}</p>
                    </div>
                  </div>
                ))}
                {meetings.filter(m => m.status === 'BOOKED').length === 0 && (
                  <p className="text-slate-500 text-center py-8 text-xs">No meetings scheduled for today.</p>
                )}
              </div>
            </div>

            {/* Leave requests list */}
            <div className="glass-card rounded-3xl border border-slate-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Leave Status</h3>
                <Link to="/leaves" className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                  Apply Leave
                </Link>
              </div>

              <div className="space-y-4">
                {leaves.slice(0, 3).map(l => (
                  <div key={l.id} className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-850">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs text-white">{l.type.replace('_', ' ')}</span>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        l.status === 'APPROVED' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' :
                        l.status === 'REJECTED' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/30' :
                        'bg-slate-800 text-slate-400 border border-slate-700/20'
                      }`}>
                        {l.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 font-mono">{l.startDate} to {l.endDate}</div>
                  </div>
                ))}
                {leaves.length === 0 && (
                  <p className="text-slate-500 text-center py-6 text-xs">No leave requests applied.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
