import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Layout, LogOut, CheckSquare, Clock, Calendar, Users, Sliders, ShieldAlert, Video, Bell, User as UserIcon } from 'lucide-react';

// Pages import
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Attendance from './pages/Attendance.jsx';
import Leaves from './pages/Leaves.jsx';
import InternPortal from './pages/InternPortal.jsx';
import Meetings from './pages/Meetings.jsx';
import Settings from './pages/Settings.jsx';
import AuditLogs from './pages/AuditLogs.jsx';

// Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      // In-app notifications are stored under settings/user profile or loaded dynamically.
      // We will pull notifications from a dedicated mock/database query.
      // For simplicity, let's query a user's alerts.
      // Since notifications is standard, we'll implement a query or fetch from auth details.
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.user?.notifications) {
        setNotifications(data.user.notifications);
        setUnreadCount(data.user.notifications.filter(n => !n.read).length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const value = {
    user,
    token,
    login,
    logout,
    notifications,
    unreadCount,
    setUnreadCount,
    setNotifications,
    refreshNotifications: fetchNotifications,
  };

  return (
    <AuthContext.Provider value={value}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="leaves" element={<Leaves />} />
            <Route
              path="interns"
              element={
                <RoleGuard allowed={['ADMIN', 'HR', 'MANAGER', 'INTERN']}>
                  <InternPortal />
                </RoleGuard>
              }
            />
            <Route path="meetings" element={<Meetings />} />
            <Route path="settings" element={<Settings />} />
            <Route
              path="audit-logs"
              element={
                <RoleGuard allowed={['ADMIN']}>
                  <AuditLogs />
                </RoleGuard>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

// Protected Route Guard
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Role Route Guard
function RoleGuard({ children, allowed }) {
  const { user } = useAuth();
  if (!allowed.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400 max-w-md">You do not have the necessary permissions to view this resource.</p>
        <Link to="/" className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors">
          Return to Dashboard
        </Link>
      </div>
    );
  }
  return children;
}

// Main Sidebar & Shell Layout
function MainLayout() {
  const { user, logout, unreadCount, notifications, token, setNotifications, setUnreadCount } = useAuth();
  const location = useLocation();
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const menuItems = [
    { path: '/', label: 'Overview', icon: Layout, roles: ['ADMIN', 'MANAGER', 'HR', 'EMPLOYEE', 'INTERN'] },
    { path: '/tasks', label: 'Tasks', icon: CheckSquare, roles: ['ADMIN', 'MANAGER', 'HR', 'EMPLOYEE', 'INTERN'] },
    { path: '/attendance', label: 'Attendance', icon: Clock, roles: ['ADMIN', 'MANAGER', 'HR', 'EMPLOYEE', 'INTERN'] },
    { path: '/leaves', label: 'Leaves', icon: Calendar, roles: ['ADMIN', 'MANAGER', 'HR', 'EMPLOYEE', 'INTERN'] },
    { path: '/interns', label: 'Interns', icon: Users, roles: ['ADMIN', 'MANAGER', 'HR', 'INTERN'] },
    { path: '/meetings', label: 'Meetings', icon: Video, roles: ['ADMIN', 'MANAGER', 'HR', 'EMPLOYEE', 'INTERN'] },
    { path: '/settings', label: 'Settings', icon: Sliders, roles: ['ADMIN', 'MANAGER', 'HR', 'EMPLOYEE', 'INTERN'] },
    { path: '/audit-logs', label: 'Audit Logs', icon: ShieldAlert, roles: ['ADMIN'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  const markAllRead = async () => {
    // Simulated read update locally or via API
    try {
      // In-app read all notifications locally
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            TM
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Task Manager</h1>
            <span className="text-[10px] text-blue-400 font-semibold tracking-widest uppercase">Enterprise</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredMenu.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-600/10'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <h4 className="font-medium text-sm text-white truncate">{user.name}</h4>
              <span className="text-[10px] text-slate-400 font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-800/80 inline-block mt-0.5 border border-slate-700">
                {user.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 hover:border-rose-900/30 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 font-medium transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-slate-800 bg-slate-950/40 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              {filteredMenu.find(item => item.path === location.pathname)?.label || 'Dashboard'}
            </h2>
            <p className="text-xs text-slate-500">Welcome back, {user.name.split(' ')[0]}</p>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* Notification Bell */}
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 text-slate-300 hover:text-white transition-all"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center border border-slate-950 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 top-14 w-80 glass-card rounded-2xl border border-slate-800 p-4 shadow-xl z-50">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <h4 className="font-bold text-sm text-white">Notifications</h4>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2.5">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No notifications</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`p-2.5 rounded-xl text-xs border ${n.read ? 'bg-transparent border-transparent text-slate-400' : 'bg-slate-900/60 border-slate-800 text-white'}`}>
                        <div className="font-bold mb-0.5">{n.title}</div>
                        <div>{n.message}</div>
                        <div className="text-[9px] text-slate-500 mt-1">{new Date(n.createdAt).toLocaleTimeString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Section */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-950">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="leaves" element={<Leaves />} />
            <Route
              path="interns"
              element={
                <RoleGuard allowed={['ADMIN', 'HR', 'MANAGER', 'INTERN']}>
                  <InternPortal />
                </RoleGuard>
              }
            />
            <Route path="meetings" element={<Meetings />} />
            <Route path="settings" element={<Settings />} />
            <Route
              path="audit-logs"
              element={
                <RoleGuard allowed={['ADMIN']}>
                  <AuditLogs />
                </RoleGuard>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
