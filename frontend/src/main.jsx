import React, { lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './App.jsx';
import './index.css'

const Members = lazy(() => import('./pages/Members'))
const Loans = lazy(() => import('./pages/Loans'))
const Approvals = lazy(() => import('./pages/Approvals'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const Expenditure = lazy(() => import('./pages/Expenditure'))
const Reports = lazy(() => import('./pages/Reports'))
const Interests = lazy(() => import('./pages/Interests'))
const Contributions = lazy(() => import('./pages/Contributions'))
const Activities = lazy(() => import('./pages/Activities'))
const DashboardComponent = lazy(() => import('./pages/Dashboard'))

function AppRouter() {
  return (
    <Router>
      <AuthProvider>
        <LanguageProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            >
              <Route index element={<DashboardComponent />} />
              <Route path="members" element={<Members />} />
              <Route path="loans" element={<Loans />} />
              <Route 
                path="approvals" 
                element={
                  <ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_PRESIDENT', 'ROLE_FINANCE']}>
                    <Approvals />
                  </ProtectedRoute>
                } 
              />
              <Route path="interests" element={<Interests />} />
              <Route path="contributions" element={<Contributions />} />
              <Route path="expenditure" element={<Expenditure />} />
              <Route path="reports" element={<Reports />} />
              <Route 
                path="activities" 
                element={
                  <ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_PRESIDENT', 'ROLE_FINANCE']}>
                    <Activities />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="settings" 
                element={
                  <ProtectedRoute allowedRoles={['ROLE_ADMIN']}>
                    <AdminSettings />
                  </ProtectedRoute>
                } 
              />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </LanguageProvider>
      </AuthProvider>
    </Router>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
)
