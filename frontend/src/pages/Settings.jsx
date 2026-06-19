import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { Sliders, Shield, User, Key, Check, Info, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function Settings() {
  const { user, token, login } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'mfa', 'workspace'

  // Profile Form States
  const [profileName, setProfileName] = useState(user.name);
  const [profileEmail, setProfileEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // MFA Flow States
  const [mfaStatus, setMfaStatus] = useState(user.mfaEnabled);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mfaMessage, setMfaMessage] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  // Workspace Settings States (Admin only)
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [lateGracePeriod, setLateGracePeriod] = useState(15);
  const [halfDayThreshold, setHalfDayThreshold] = useState(4);
  const [workspaceMessage, setWorkspaceMessage] = useState('');

  const fetchGlobalSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setWorkStartTime(data.settings.workStartTime);
        setWorkEndTime(data.settings.workEndTime);
        setLateGracePeriod(data.settings.lateGracePeriod);
        setHalfDayThreshold(data.settings.halfDayThreshold);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchGlobalSettings();
    }
  }, [token]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMessage('');
    setProfileError('');

    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setProfileMessage(data.message);
        setNewPassword('');
        // Update local auth user state
        login(data.user, token);
      } else {
        setProfileError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileError('Failed to save profile changes.');
    }
  };

  // MFA Initiator Flow
  const handleSetupMfa = async () => {
    setMfaError('');
    setMfaMessage('');
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setQrCodeUrl(data.qrCodeUrl);
        setMfaSecret(data.secret);
      } else {
        setMfaError(data.error || 'Failed to initiate MFA setup.');
      }
    } catch (err) {
      setMfaError('Failed to fetch QR details.');
    }
  };

  const handleEnableMfa = async (e) => {
    e.preventDefault();
    setMfaError('');
    setMfaMessage('');

    try {
      const res = await fetch('/api/auth/mfa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: otpCode }),
      });

      const data = await res.json();
      if (res.ok) {
        setMfaStatus(true);
        setQrCodeUrl('');
        setMfaSecret('');
        setOtpCode('');
        setMfaMessage(data.message);
        // Update user state
        login({ ...user, mfaEnabled: true }, token);
      } else {
        setMfaError(data.error || 'Verification code failed.');
      }
    } catch (err) {
      setMfaError('Enable failed.');
    }
  };

  const handleDisableMfa = async (e) => {
    e.preventDefault();
    setMfaError('');
    setMfaMessage('');

    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: disablePassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setMfaStatus(false);
        setDisablePassword('');
        setMfaMessage(data.message);
        // Update user state
        login({ ...user, mfaEnabled: false }, token);
      } else {
        setMfaError(data.error || 'Incorrect password.');
      }
    } catch (err) {
      setMfaError('Disable failed.');
    }
  };

  const handleUpdateWorkspace = async (e) => {
    e.preventDefault();
    setWorkspaceMessage('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workStartTime,
          workEndTime,
          lateGracePeriod,
          halfDayThreshold,
        }),
      });

      if (res.ok) {
        setWorkspaceMessage('Workspace configurations saved successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar navigation */}
      <div className="lg:col-span-1 glass-card rounded-3xl border border-slate-800 p-6 flex flex-col gap-2 h-fit shrink-0">
        <button
          onClick={() => setActiveTab('profile')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-bold ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
              : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Edit Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('mfa')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-bold ${
            activeTab === 'mfa'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
              : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Security / MFA</span>
        </button>

        {user.role === 'ADMIN' && (
          <button
            onClick={() => setActiveTab('workspace')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-bold ${
              activeTab === 'workspace'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Workspace Rules</span>
          </button>
        )}
      </div>

      {/* Main settings box */}
      <div className="lg:col-span-3">
        {activeTab === 'profile' && (
          <div className="glass-card rounded-3xl border border-slate-800 p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Profile Details</h3>
              <p className="text-xs text-slate-500 mt-0.5">Modify your account parameters, contact email, and password settings.</p>
            </div>

            {profileMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs">
                {profileMessage}
              </div>
            )}
            {profileError && (
              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-450 text-xs">
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-2 uppercase">Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-2 uppercase">Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-2 uppercase">Change Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm"
                />
              </div>

              <div className="pt-4 border-t border-slate-900 text-right">
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'mfa' && (
          <div className="glass-card rounded-3xl border border-slate-800 p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Multi-Factor Authentication (MFA)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Enhance account security by verifying a 6-digit TOTP code during logins.</p>
            </div>

            {mfaMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs">
                {mfaMessage}
              </div>
            )}
            {mfaError && (
              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-450 text-xs">
                {mfaError}
              </div>
            )}

            {!mfaStatus ? (
              /* MFA Setup and activation */
              <div className="space-y-6">
                {!qrCodeUrl ? (
                  <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        MFA is currently Disabled
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm">Scan a QR code from Google Authenticator to enable 2-Factor Authentication.</p>
                    </div>
                    <button
                      onClick={handleSetupMfa}
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all shrink-0"
                    >
                      Setup Authenticator
                    </button>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-850 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="flex flex-col items-center p-4 bg-white rounded-2xl w-fit mx-auto border-4 border-slate-200">
                      <img src={qrCodeUrl} alt="MFA QR Code" className="w-44 h-44" />
                      <div className="text-[10px] text-slate-500 font-mono mt-2 select-all">Secret: {mfaSecret}</div>
                    </div>

                    <form onSubmit={handleEnableMfa} className="space-y-4">
                      <h4 className="font-bold text-sm text-white">Scan & Verify</h4>
                      <p className="text-xs text-slate-400">1. Scan the QR code using Google Authenticator or Microsoft Authenticator.<br/>2. Enter the generated 6-digit code below to confirm and enable MFA.</p>
                      
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center text-xl tracking-[0.4em] py-3 rounded-xl glass-input text-white font-bold"
                        required
                      />

                      <button
                        type="submit"
                        disabled={otpCode.length !== 6}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg disabled:opacity-50 active:scale-95 transition-all"
                      >
                        Verify and Enable
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              /* Disable MFA panel */
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-slate-905 border border-slate-850 flex items-center gap-3">
                  <ShieldCheck className="w-8 h-8 text-emerald-450 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-white">MFA is Active</h4>
                    <p className="text-xs text-slate-400">Your account is fully secured with 2-Factor Authentication.</p>
                  </div>
                </div>

                <form onSubmit={handleDisableMfa} className="p-6 rounded-2xl bg-rose-950/10 border border-rose-900/10 space-y-4">
                  <h4 className="font-bold text-sm text-rose-400">Disable 2-Factor Authentication</h4>
                  <p className="text-xs text-slate-450">Please verify your account password to disable Multi-Factor Authentication.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="password"
                      placeholder="Account Password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl glass-input text-white text-sm"
                      required
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs active:scale-[0.98] transition-all shrink-0"
                    >
                      Disable MFA
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'workspace' && user.role === 'ADMIN' && (
          <div className="glass-card rounded-3xl border border-slate-800 p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Global Workspace Rules</h3>
              <p className="text-xs text-slate-500 mt-0.5">Configure operational work start times, grace delay parameters, and active hour metrics.</p>
            </div>

            {workspaceMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs">
                {workspaceMessage}
              </div>
            )}

            <form onSubmit={handleUpdateWorkspace} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-455 mb-2 uppercase">Official Start Time</label>
                  <input
                    type="text"
                    value={workStartTime}
                    onChange={(e) => setWorkStartTime(e.target.value)}
                    placeholder="e.g. 09:00"
                    className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-455 mb-2 uppercase">Official End Time</label>
                  <input
                    type="text"
                    value={workEndTime}
                    onChange={(e) => setWorkEndTime(e.target.value)}
                    placeholder="e.g. 18:00"
                    className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-455 mb-2 uppercase">Late Grace Period (Mins)</label>
                  <input
                    type="number"
                    value={lateGracePeriod}
                    onChange={(e) => setLateGracePeriod(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-455 mb-2 uppercase">Half Day Threshold (Hours)</label>
                  <input
                    type="number"
                    value={halfDayThreshold}
                    onChange={(e) => setHalfDayThreshold(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-900 text-right">
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
                >
                  Save Workspace Rules
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
