import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { ShieldCheck, User, Users, ClipboardList, Award, CheckCircle2, ChevronRight, FileText, Printer, Plus, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function InternPortal() {
  const { user, token } = useAuth();
  const [interns, setInterns] = useState([]);
  const [selectedInternId, setSelectedInternId] = useState(null);
  const [internDetails, setInternDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // New Intern Modal States (Admin/HR only)
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newJoiningDate, setNewJoiningDate] = useState('');
  const [newDuration, setNewDuration] = useState('3');
  const [newMentorId, setNewMentorId] = useState('');
  const [newManagerId, setNewManagerId] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [error, setError] = useState('');

  const fetchInterns = async () => {
    try {
      setLoading(true);
      if (user.role === 'INTERN') {
        // Interns load their own details directly
        await fetchInternDetails(user.id);
      } else {
        // Admins, Managers, and HR load the list of interns
        const res = await fetch('/api/interns', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setInterns(data.interns);
          if (data.interns.length > 0 && !selectedInternId) {
            setSelectedInternId(data.interns[0].userId);
            fetchInternDetails(data.interns[0].userId);
          }
        }
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchInternDetails = async (userId) => {
    try {
      const res = await fetch(`/api/interns/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setInternDetails(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllUsers = async () => {
    if (!['ADMIN', 'HR'].includes(user.role)) return;
    try {
      const res = await fetch('/api/meetings/hosts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAllUsers(data.hosts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInterns();
    fetchAllUsers();
  }, [token]);

  const handleSelectIntern = (userId) => {
    setSelectedInternId(userId);
    fetchInternDetails(userId);
  };

  const handleToggleChecklist = async (checklistType, itemIndex, currentVal) => {
    if (!internDetails) return;
    if (user.role === 'INTERN') return; // Interns cannot check their own list

    const profile = internDetails.intern;
    const currentChecklist = checklistType === 'onboarding'
      ? JSON.parse(profile.onboardingChecklist)
      : JSON.parse(profile.offboardingChecklist);

    // Update item
    currentChecklist[itemIndex].completed = !currentVal;
    currentChecklist[itemIndex].date = currentChecklist[itemIndex].completed
      ? new Date().toISOString().split('T')[0]
      : null;

    const endpoint = `/api/interns/${profile.userId}/${checklistType}`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ checklist: currentChecklist }),
      });

      const data = await res.json();
      if (res.ok) {
        setInternDetails(prev => ({
          ...prev,
          intern: data.profile,
        }));
        
        // Check if now fully complete
        const allDone = currentChecklist.every(i => i.completed);
        if (allDone && !currentVal) {
          // Confetti!
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/interns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          joiningDate: newJoiningDate,
          duration: newDuration,
          mentorId: newMentorId || null,
          managerId: newManagerId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowOnboardModal(false);
        // Clear
        setNewEmail('');
        setNewPassword('');
        setNewName('');
        setNewJoiningDate('');
        setNewMentorId('');
        setNewManagerId('');
        fetchInterns();
      } else {
        setError(data.error || 'Failed to onboard intern.');
      }
    } catch (err) {
      setError('Connection failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const profile = internDetails?.intern;
  const onboardingChecklist = profile ? JSON.parse(profile.onboardingChecklist) : [];
  const offboardingChecklist = profile ? JSON.parse(profile.offboardingChecklist) : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Intern Onboarding & Lifecycle</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Track joining checklists, review project handovers, and approve completion letters.</p>
        </div>

        {['ADMIN', 'HR'].includes(user.role) && (
          <button
            onClick={() => setShowOnboardModal(true)}
            className="flex items-center gap-2 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Intern</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Intern Selection List (Hidden for Intern role) */}
        {user.role !== 'INTERN' ? (
          <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-4">
            <h4 className="font-bold text-sm text-white pb-2 border-b border-slate-900">Intern Profiles</h4>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {interns.map(i => (
                <div
                  key={i.id}
                  onClick={() => handleSelectIntern(i.userId)}
                  className={`p-4.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                    selectedInternId === i.userId
                      ? 'bg-blue-600/10 border-blue-500/40 text-blue-400'
                      : 'bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-850 border border-slate-800 flex items-center justify-center font-bold text-slate-350">
                      {i.user?.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white leading-tight group-hover:text-blue-400 transition-colors">{i.user?.name}</h4>
                      <span className="text-[9px] text-slate-500 font-mono mt-1 block">Joined: {i.joiningDate}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </div>
              ))}
              {interns.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-12">No interns assigned to you.</p>
              )}
            </div>
          </div>
        ) : null}

        {/* Right Columns: Intern Details Profile & Checklists */}
        <div className={`${user.role === 'INTERN' ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-8`}>
          {internDetails ? (
            <>
              {/* Profile Card */}
              <div className="glass-card rounded-3xl border border-slate-800 p-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="absolute right-0 top-0 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl"></div>
                
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-900/20 flex items-center justify-center text-blue-400 font-bold text-2xl shadow-inner">
                    {profile.user?.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white">{profile.user?.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{profile.user?.email}</p>
                    <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-slate-400 font-medium">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-850">Mentor: {profile.mentor?.name || 'Unassigned'}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-850">Manager: {profile.manager?.name || 'Unassigned'}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-850 font-mono">Duration: {profile.duration} Months</span>
                    </div>
                  </div>
                </div>

                {/* Printable letters panel */}
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  {profile.onboardingStatus === 'COMPLETED' ? (
                    <a
                      href={`/api/interns/${profile.userId}/joining-letter?token=${token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-500/30 bg-blue-950/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold shadow"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Joining Letter</span>
                    </a>
                  ) : (
                    <div className="text-[10px] text-slate-500 italic text-center md:text-right">Joining letter locked.<br/>Complete onboarding checklist.</div>
                  )}

                  {profile.offboardingStatus === 'COMPLETED' ? (
                    <a
                      href={`/api/interns/${profile.userId}/completion-letter?token=${token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white transition-all text-xs font-bold shadow-lg"
                    >
                      <Award className="w-4 h-4" />
                      <span>Print Completion Certificate</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Checklists grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Onboarding Checklist */}
                <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-blue-400" />
                      Onboarding Checklist
                    </h3>
                    <p className="text-[10px] text-slate-550 mt-1">Status: <strong className="text-blue-450 uppercase">{profile.onboardingStatus}</strong></p>
                  </div>

                  <div className="space-y-3">
                    {onboardingChecklist.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleChecklist('onboarding', idx, item.completed)}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                          user.role === 'INTERN' ? 'pointer-events-none' : 'cursor-pointer'
                        } ${
                          item.completed
                            ? 'bg-emerald-950/20 border-emerald-900/30 text-slate-350'
                            : 'bg-slate-900/30 border-slate-850 text-slate-450 hover:border-slate-800'
                        }`}
                      >
                        <span className="text-xs font-medium capitalize">{item.task}</span>
                        {item.completed ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-slate-550 font-mono">{item.date}</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-950" />
                          </div>
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-slate-800"></span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Offboarding Checklist */}
                <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-yellow-450" />
                      Exit Offboarding Checklist
                    </h3>
                    <p className="text-[10px] text-slate-555 mt-1">Status: <strong className="text-yellow-450 uppercase">{profile.offboardingStatus}</strong></p>
                  </div>

                  <div className="space-y-3">
                    {offboardingChecklist.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleChecklist('offboarding', idx, item.completed)}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                          user.role === 'INTERN' ? 'pointer-events-none' : 'cursor-pointer'
                        } ${
                          item.completed
                            ? 'bg-emerald-950/20 border-emerald-900/30 text-slate-350'
                            : 'bg-slate-900/30 border-slate-850 text-slate-450 hover:border-slate-800'
                        }`}
                      >
                        <span className="text-xs font-medium capitalize">{item.task}</span>
                        {item.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-950" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-slate-800"></span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-center py-20 text-sm">Select an intern to view detailed lifecycles.</div>
          )}
        </div>
      </div>

      {/* ONBOARD NEW INTERN MODAL (Admin & HR only) */}
      {showOnboardModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Onboard New Intern</h3>
              <button onClick={() => setShowOnboardModal(false)} className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5 uppercase">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5 uppercase">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="intern@company.com"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5 uppercase">Default Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1.5 uppercase">Joining Date</label>
                  <input
                    type="date"
                    value={newJoiningDate}
                    onChange={(e) => setNewJoiningDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-455 mb-1.5 uppercase">Duration (Months)</label>
                  <select
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-slate-450 text-sm"
                  >
                    <option value="1">1 Month</option>
                    <option value="2">2 Months</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5 uppercase">Reporting Manager</label>
                <select
                  value={newManagerId}
                  onChange={(e) => setNewManagerId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-slate-450 text-sm"
                >
                  <option value="">Select Manager</option>
                  {allUsers.filter(u => u.role === 'MANAGER').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5 uppercase">Assigned Mentor</label>
                <select
                  value={newMentorId}
                  onChange={(e) => setNewMentorId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-slate-450 text-sm"
                >
                  <option value="">Select Mentor</option>
                  {allUsers.filter(u => u.role === 'EMPLOYEE').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
                >
                  Onboard Intern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
