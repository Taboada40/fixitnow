import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Profile from './components/Profile';
import ReportHistory from './components/ReportHistory';
import ReportIssue from './components/ReportIssue';
import UserNotifications from './components/UserNotifications';
import AdminNotifications from './components/AdminNotifications';
import TopNavBar from './components/TopNavBar';
import { useSession } from './utils/profileSession';
import './App.css';

function AppContent() {
  const location = useLocation();
  const session = useSession();
  const hideNavOnPaths = ['/login', '/register'];
  const showNav = !!session && !hideNavOnPaths.includes(location.pathname);

  return (
    <>
      {showNav && <TopNavBar />}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/notifications" element={<UserNotifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/report-issue" element={<ReportIssue />} />
        <Route path="/reports" element={<ReportHistory />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
export default App;