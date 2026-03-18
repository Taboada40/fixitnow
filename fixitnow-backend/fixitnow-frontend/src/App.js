import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Profile from './components/Profile';
import ReportHistory from './components/ReportHistory';
import ReportIssue from './components/ReportIssue';
import UserNotifications from './components/UserNotifications';
import AdminNotifications from './components/AdminNotifications';
import './App.css';

function App() {
  return (
    <Router>
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
    </Router>
  );
}
export default App;