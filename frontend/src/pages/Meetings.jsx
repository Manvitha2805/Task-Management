import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { Video, Calendar as CalendarIcon, Clock, X, Check, Info, ChevronRight, UserPlus } from 'lucide-react';

export default function Meetings() {
  const { user, token } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking Flow States
  const [selectedHostId, setSelectedHostId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null); // Slot object

  // Booking Modal States
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDesc, setMeetingDesc] = useState('');

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/meetings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMeetings(data.meetings);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchHosts = async () => {
    try {
      const res = await fetch('/api/meetings/hosts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        // Exclude current user from host listing
        setHosts(data.hosts.filter(h => h.id !== user.id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetchHosts();
  }, [token]);

  // Load availability slots when host and date is selected
  useEffect(() => {
    if (selectedHostId && selectedDate) {
      fetchAvailability();
    } else {
      setSlots([]);
    }
  }, [selectedHostId, selectedDate]);

  const fetchAvailability = async () => {
    try {
      const res = await fetch(`/api/meetings/slots/${selectedHostId}/availability?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSlots(data.slots);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBookMeeting = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !meetingTitle) return;

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: meetingTitle,
          description: meetingDesc,
          hostId: selectedHostId,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
        }),
      });

      if (res.ok) {
        setShowBookingModal(false);
        setMeetingTitle('');
        setMeetingDesc('');
        setSelectedSlot(null);
        fetchMeetings();
        fetchAvailability(); // Refresh slots availability
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to book slot.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to cancel this meeting?')) return;

    try {
      const res = await fetch(`/api/meetings/${meetingId}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchMeetings();
        if (selectedHostId && selectedDate) {
          fetchAvailability(); // Refresh slots list if showing
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel meeting.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatSlotTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const upcomingMeetings = meetings.filter(m => m.status === 'BOOKED' && new Date(m.startTime) >= new Date());
  const pastMeetings = meetings.filter(m => m.status === 'CANCELLED' || new Date(m.startTime) < new Date());

  return (
    <div className="space-y-8">
      {/* Overview Head */}
      <div>
        <h3 className="text-xl font-bold text-white">Meeting Scheduler</h3>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">Book 1-on-1 mentor syncs, interview sessions, and manager alignments via interactive booking slots.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Columns: Calendly Booking Engine */}
        <div className="xl:col-span-2 space-y-6">
          <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              Schedule a Meeting
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-2 uppercase">Select Host</label>
                <select
                  value={selectedHostId}
                  onChange={(e) => setSelectedHostId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-slate-400 text-xs font-medium"
                >
                  <option value="">Choose a Host...</option>
                  {hosts.map(h => (
                    <option key={h.id} value={h.id}>{h.name} ({h.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-2 uppercase">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-xs font-medium"
                />
              </div>
            </div>

            {/* Slots Grid */}
            {selectedHostId && selectedDate ? (
              <div className="pt-4 border-t border-slate-900 space-y-4">
                <h4 className="font-bold text-xs text-white">Available Time Slots for {selectedDate}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {slots.map((slot, idx) => (
                    <button
                      key={idx}
                      disabled={!slot.available}
                      onClick={() => { setSelectedSlot(slot); setShowBookingModal(true); }}
                      className={`p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                        slot.available
                          ? 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-500 shadow-sm active:scale-95'
                          : 'bg-slate-905 border-slate-900 text-slate-650 cursor-not-allowed'
                      }`}
                    >
                      {formatSlotTime(slot.startTime)}
                    </button>
                  ))}
                  {slots.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-6 col-span-full">No work hours defined on this date.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-900 text-slate-500 text-center py-12 text-xs flex flex-col items-center gap-2">
                <CalendarIcon className="w-8 h-8 text-slate-650" />
                <span>Select a host and a date to search for available time slots.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Booked Meetings Lists */}
        <div className="space-y-6">
          {/* Upcoming Meetings */}
          <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-400" />
              Upcoming Meetings
            </h3>

            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {upcomingMeetings.map(m => {
                const isHost = m.hostId === user.id;
                const dateObj = new Date(m.startTime);
                
                return (
                  <div key={m.id} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-850 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-xs text-white leading-normal">{m.title}</h4>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {isHost ? `Guest: ${m.guest?.name || m.guestName}` : `Host: ${m.host?.name}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancelMeeting(m.id)}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-400 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
              {upcomingMeetings.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">No upcoming meetings scheduled.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MEETING BOOKING CONFIRMATION MODAL */}
      {showBookingModal && selectedSlot && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white font-sans">Book Meeting Slot</h3>
              <button onClick={() => setShowBookingModal(false)} className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-850 text-xs space-y-1.5 font-sans">
              <div>Host: <strong className="text-white">{(hosts.find(h => h.id === selectedHostId))?.name}</strong></div>
              <div>Date: <strong className="text-white font-mono">{selectedDate}</strong></div>
              <div>Time Slot: <strong className="text-white font-mono">{formatSlotTime(selectedSlot.startTime)} - {formatSlotTime(selectedSlot.endTime)}</strong></div>
            </div>

            <form onSubmit={handleBookMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Meeting Title</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Code Review Sync"
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Agenda / Notes</label>
                <textarea
                  value={meetingDesc}
                  onChange={(e) => setMeetingDesc(e.target.value)}
                  placeholder="Provide meeting agenda..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
