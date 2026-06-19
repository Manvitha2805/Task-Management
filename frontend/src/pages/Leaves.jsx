import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { Calendar, Plus, X, Check, XSquare, MessageSquare, AlertCircle, Info } from 'lucide-react';

export default function Leaves() {
  const { user, token } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Apply Leave Modal States
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('CASUAL');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // Comment Modal States for Approval/Rejection
  const [reviewLeave, setReviewLeave] = useState(null); // Leave object being approved/rejected
  const [reviewAction, setReviewAction] = useState(''); // 'APPROVE' or 'REJECT'
  const [managerComment, setManagerComment] = useState('');

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leaves', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLeaves(data.leaves);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [token]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setError('');

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after end date.');
      return;
    }

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startDate, endDate, type, reason }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowApplyModal(false);
        setStartDate('');
        setEndDate('');
        setType('CASUAL');
        setReason('');
        fetchLeaves();
      } else {
        setError(data.error || 'Failed to submit leave request.');
      }
    } catch (err) {
      setError('Connection failure.');
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewLeave || !reviewAction) return;

    const endpoint = `/api/leaves/${reviewLeave.id}/${reviewAction === 'APPROVE' ? 'approve' : 'reject'}`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ managerComment }),
      });

      if (res.ok) {
        setReviewLeave(null);
        setReviewAction('');
        setManagerComment('');
        fetchLeaves();
      } else {
        const data = await res.json();
        alert(data.error || 'Review operation failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelRequest = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;

    try {
      const res = await fetch(`/api/leaves/${leaveId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchLeaves();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel leave request.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Divide leaves into user applied and pending approvals (for Managers/Admins/HR)
  const myLeaves = leaves.filter(l => l.userId === user.id);
  const pendingReviews = leaves.filter(l => l.status === 'PENDING' && l.userId !== user.id);

  const getStatusStyle = (status) => {
    const mapping = {
      APPROVED: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30',
      REJECTED: 'bg-rose-950/40 text-rose-400 border-rose-900/30',
      PENDING: 'bg-slate-900 text-slate-450 border-slate-800',
    };
    return `text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${mapping[status] || 'bg-slate-800 text-slate-450'}`;
  };

  return (
    <div className="space-y-8">
      {/* Overview stats & buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Leave Dashboard</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Apply for vacation, sick days, or work from home, and monitor approval cycles.</p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-2 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[30vh]">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column: User Leave Requests history */}
          <div className="xl:col-span-2 space-y-6">
            <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-6">
              <h3 className="text-base font-bold text-white">Your Leave Applications</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 px-4">Dates</th>
                      <th className="pb-3 px-4">Reason</th>
                      <th className="pb-3 px-4">Status</th>
                      <th className="pb-3 px-4">Notes</th>
                      <th className="pb-3 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-xs">
                    {myLeaves.map(l => (
                      <tr key={l.id} className="hover:bg-slate-900/10">
                        <td className="py-3.5 pr-4 font-bold text-white uppercase text-[10px] tracking-wide">{l.type.replace('_', ' ')}</td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono">{l.startDate} to {l.endDate}</td>
                        <td className="py-3.5 px-4 text-slate-350 max-w-[120px] truncate" title={l.reason}>{l.reason}</td>
                        <td className="py-3.5 px-4">
                          <span className={getStatusStyle(l.status)}>{l.status}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 italic max-w-[120px] truncate" title={l.managerComment}>
                          {l.managerComment || '-'}
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          {l.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancelRequest(l.id)}
                              className="text-xs text-rose-500 hover:text-rose-400 font-semibold"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {myLeaves.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-500">You haven't submitted any leave requests.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Approvals list (Admin/Manager/HR only) */}
          <div className="space-y-6">
            {['ADMIN', 'HR', 'MANAGER'].includes(user.role) && (
              <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">Pending Leave Reviews</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Requests submitted by members of your department requiring action.</p>
                </div>

                <div className="space-y-4">
                  {pendingReviews.map(l => (
                    <div key={l.id} className="p-4 rounded-2xl bg-slate-900/40 border border-slate-850 space-y-3.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-sm text-white">{l.user.name}</h4>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-blue-900/20 bg-blue-950/20 text-blue-400 mt-1 inline-block">
                            {l.type.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono font-semibold">{l.startDate} to {l.endDate}</span>
                      </div>

                      <p className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-900">
                        Reason: "{l.reason}"
                      </p>

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => { setReviewLeave(l); setReviewAction('REJECT'); }}
                          className="flex-1 py-2 border border-slate-800 hover:bg-rose-950/20 hover:border-rose-900/30 text-rose-400 rounded-xl text-xs font-bold transition-all"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => { setReviewLeave(l); setReviewAction('APPROVE'); }}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingReviews.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center gap-2">
                      <Info className="w-8 h-8 text-slate-650" />
                      <span>All clear! No pending leave requests to approve.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPLY LEAVE MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Apply for Leave</h3>
              <button onClick={() => setShowApplyModal(false)} className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Leave Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-slate-450 text-sm"
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="PAID">Paid Leave</option>
                  <option value="UNPAID">Unpaid Leave</option>
                  <option value="WORK_FROM_HOME">Work From Home (WFH)</option>
                  <option value="INTERNSHIP">Internship Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide details about your leave request..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEAVE REVIEW COMMENT MODAL (APPROVE/REJECT DETAILS) */}
      {reviewLeave && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {reviewAction === 'APPROVE' ? 'Approve Leave' : 'Reject Leave'}
              </h3>
              <button onClick={() => { setReviewLeave(null); setReviewAction(''); }} className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-850 text-xs space-y-1">
              <div>Employee: <strong className="text-white">{reviewLeave.user?.name}</strong></div>
              <div>Duration: <strong className="text-white font-mono">{reviewLeave.startDate} to {reviewLeave.endDate}</strong></div>
              <div className="pt-2 text-slate-400">Reason: "{reviewLeave.reason}"</div>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Manager Comments</label>
                <textarea
                  value={managerComment}
                  onChange={(e) => setManagerComment(e.target.value)}
                  placeholder="Optional review notes/feedback..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => { setReviewLeave(null); setReviewAction(''); }}
                  className="flex-1 py-3 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3 rounded-xl text-white font-bold text-sm shadow-lg active:scale-95 transition-all ${
                    reviewAction === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/10'
                  }`}
                >
                  Confirm {reviewAction === 'APPROVE' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
