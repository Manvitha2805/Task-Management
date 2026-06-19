import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { Plus, ListFilter, Calendar as CalendarIcon, KanbanSquare, Clock, AlertCircle, MessageSquare, Trash2, X, Send } from 'lucide-react';

export default function Tasks() {
  const { user, token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [view, setView] = useState('kanban'); // 'kanban', 'list', 'calendar'
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterAssignee, setFilterAssignee] = useState('ALL');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssignedId, setNewAssignedId] = useState('');

  // Details Modal States
  const [selectedTask, setSelectedTask] = useState(null);
  const [commentText, setCommentText] = useState('');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    if (!['ADMIN', 'HR', 'MANAGER'].includes(user.role)) return;
    try {
      // Fetch users list for assigning tasks
      const res = await fetch('/api/meetings/hosts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        // Filter users who can receive tasks (Employees & Interns, or all users)
        setEmployees(data.hosts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, [token]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle || !newDueDate) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          priority: newPriority,
          dueDate: newDueDate,
          assignedId: newAssignedId || null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        // Reset inputs
        setNewTitle('');
        setNewDescription('');
        setNewPriority('MEDIUM');
        setNewDueDate('');
        setNewAssignedId('');
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchTasks();
        if (selectedTask && selectedTask.id === taskId) {
          // Refresh details modal
          fetchTaskDetails(taskId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTaskDetails = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedTask(data.task);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText || !selectedTask) return;

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment: commentText }),
      });

      if (res.ok) {
        setCommentText('');
        fetchTaskDetails(selectedTask.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setSelectedTask(null);
        fetchTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter Tasks
  const filteredTasks = tasks.filter(t => {
    const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
    const matchAssignee = filterAssignee === 'ALL' || t.assignedId === filterAssignee;
    return matchPriority && matchAssignee;
  });

  // Kanban columns definition
  const columns = [
    { id: 'TODO', label: 'To Do', color: 'border-slate-800' },
    { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-500' },
    { id: 'IN_REVIEW', label: 'In Review', color: 'border-purple-500' },
    { id: 'COMPLETED', label: 'Completed', color: 'border-emerald-500' },
    { id: 'BLOCKED', label: 'Blocked', color: 'border-rose-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* View Toggles */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-850">
          <button
            onClick={() => setView('kanban')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === 'kanban' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <KanbanSquare className="w-4 h-4" />
            <span>Kanban</span>
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === 'list' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>List</span>
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === 'calendar' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Calendar</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 rounded-xl glass-input text-xs font-medium text-white"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {/* Assignee filter (Admin/Manager only) */}
          {['ADMIN', 'HR', 'MANAGER'].includes(user.role) && (
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="px-4 py-2 rounded-xl glass-input text-xs font-medium text-white max-w-[150px]"
            >
              <option value="ALL">All Assignees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          )}

          {/* Create Button (Admin and Manager only) */}
          {['ADMIN', 'MANAGER'].includes(user.role) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* KANBAN VIEW */}
          {view === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {columns.map(col => {
                const columnTasks = filteredTasks.filter(t => t.status === col.id);
                return (
                  <div key={col.id} className="flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full border-2 ${col.color.replace('border-', 'bg-')}`}></span>
                        {col.label}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                        {columnTasks.length}
                      </span>
                    </div>

                    {/* Column body */}
                    <div className="kanban-column flex flex-col gap-4 overflow-y-auto">
                      {columnTasks.map(t => (
                        <div
                          key={t.id}
                          onClick={() => { setSelectedTask(t); fetchTaskDetails(t.id); }}
                          className="glass-card p-4 rounded-2xl cursor-pointer hover:border-slate-700 transition-all border border-slate-850 hover:shadow-lg relative group"
                        >
                          <h4 className="font-bold text-xs text-white leading-tight mb-2 group-hover:text-blue-400 transition-colors">{t.title}</h4>
                          <p className="text-[10px] text-slate-400 line-clamp-2 mb-3">{t.description}</p>
                          
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-900">
                            <span className={`text-[8px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded ${
                              t.priority === 'CRITICAL' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/10' :
                              t.priority === 'HIGH' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/10' :
                              t.priority === 'MEDIUM' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/10' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {t.priority}
                            </span>
                            
                            <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* LIST VIEW */}
          {view === 'list' && (
            <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/30 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <th className="p-4">Task Name</th>
                    <th className="p-4">Assignee</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4">Creator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {filteredTasks.map(t => (
                    <tr
                      key={t.id}
                      onClick={() => { setSelectedTask(t); fetchTaskDetails(t.id); }}
                      className="hover:bg-slate-900/40 cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-bold text-white max-w-[200px] truncate">{t.title}</td>
                      <td className="p-4 text-slate-350">{t.assignedTo?.name || 'Unassigned'}</td>
                      <td className="p-4">
                        <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          t.priority === 'CRITICAL' ? 'bg-rose-950/30 text-rose-400' :
                          t.priority === 'HIGH' ? 'bg-amber-950/30 text-amber-400' :
                          t.priority === 'MEDIUM' ? 'bg-blue-950/30 text-blue-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold text-slate-350 uppercase">{t.status.replace('_', ' ')}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-400">{new Date(t.dueDate).toLocaleDateString()}</td>
                      <td className="p-4 text-slate-500">{t.createdBy?.name || 'Admin'}</td>
                    </tr>
                  ))}
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500">No tasks match selected filter criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* CALENDAR VIEW */}
          {view === 'calendar' && (
            <div className="glass-card rounded-3xl border border-slate-800 p-6">
              {/* Simplistic monthly calendar grid */}
              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {/* Generate a simple grid of 35 boxes for the current month */}
                {Array.from({ length: 35 }).map((_, idx) => {
                  const dayNum = (idx % 31) + 1; // Simulated
                  const simulatedDateStr = `2026-06-${String(dayNum).padStart(2, '0')}`;
                  const dayTasks = filteredTasks.filter(t => t.dueDate.startsWith(simulatedDateStr));

                  return (
                    <div key={idx} className="h-28 border border-slate-850 rounded-xl p-2 bg-slate-900/20 hover:border-slate-800 transition-colors flex flex-col gap-1 overflow-hidden">
                      <div className="text-[10px] font-bold text-slate-500">{dayNum}</div>
                      <div className="flex-1 overflow-y-auto space-y-1">
                        {dayTasks.map(t => (
                          <div
                            key={t.id}
                            onClick={() => { setSelectedTask(t); fetchTaskDetails(t.id); }}
                            className="p-1 rounded text-[8px] font-bold bg-blue-950/40 text-blue-400 border border-blue-900/20 truncate cursor-pointer hover:bg-blue-950/70"
                          >
                            {t.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Create New Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Task Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Task Name"
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detailed task description..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-slate-450 text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Assign To</label>
                <select
                  value={newAssignedId}
                  onChange={(e) => setNewAssignedId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-slate-450 text-sm"
                >
                  <option value="">Unassigned</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAILS & COLLABORATION MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl glass-panel rounded-3xl p-6 border border-slate-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-800 mb-4 shrink-0">
              <div>
                <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded ${
                  selectedTask.priority === 'CRITICAL' ? 'bg-rose-950/40 text-rose-400' :
                  selectedTask.priority === 'HIGH' ? 'bg-amber-950/40 text-amber-400' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {selectedTask.priority}
                </span>
                <h3 className="text-xl font-bold text-white mt-1.5">{selectedTask.title}</h3>
              </div>
              <div className="flex items-center gap-3">
                {/* Delete button (creators or admin only) */}
                {(user.role === 'ADMIN' || selectedTask.creatorId === user.id) && (
                  <button
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/30 text-slate-450 hover:text-rose-400 border border-slate-850"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setSelectedTask(null)} className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left pane: description */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Description</h4>
                    <p className="text-slate-300 text-sm mt-1.5 bg-slate-900/40 p-4 rounded-2xl border border-slate-850 leading-relaxed min-h-[100px]">
                      {selectedTask.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Comment Thread */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      Collaboration Comments ({selectedTask.comments?.length || 0})
                    </h4>

                    {/* Add Comment */}
                    <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 px-4 py-2.5 rounded-xl glass-input text-xs text-white"
                        required
                      />
                      <button type="submit" className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                      {selectedTask.comments?.map(c => (
                        <div key={c.id} className="p-3 rounded-xl bg-slate-900/50 border border-slate-850">
                          <div className="flex justify-between items-start mb-1 text-[10px]">
                            <span className="font-bold text-blue-400">{c.user?.name}</span>
                            <span className="text-slate-500">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-normal">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right pane: properties & activity logs */}
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850 space-y-3.5 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Assignee</div>
                      <div className="text-white font-medium mt-0.5">{selectedTask.assignedTo?.name || 'Unassigned'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Due Date</div>
                      <div className="text-rose-400 font-mono font-medium mt-0.5">{new Date(selectedTask.dueDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Status</div>
                      <select
                        value={selectedTask.status}
                        onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-slate-350 font-bold mt-1 text-xs"
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </div>
                  </div>

                  {/* Activity History */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Task Change Logs</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto text-[10px]">
                      {selectedTask.activities?.map(act => (
                        <div key={act.id} className="pb-2 border-b border-slate-900 text-slate-450 leading-relaxed">
                          <strong className="text-slate-350">{act.user?.name}</strong>: {act.description}
                          <div className="text-[8px] text-slate-500 mt-0.5">{new Date(act.createdAt).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
