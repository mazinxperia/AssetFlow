import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandingProvider } from './context/BrandingContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoadingPage } from './components/common/LoadingSpinner';
import { GlobalMusicPlayer } from './components/music/GlobalMusicPlayer';

// Pages
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import AssetsPage from './pages/AssetsPage';
import AssetFormPage from './pages/AssetFormPage';
import AssetDetailPage from './pages/AssetDetailPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeFormPage from './pages/EmployeeFormPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import InventoryPage from './pages/InventoryPage';
import VehicleFleetPage from './pages/VehicleFleetPage';
import TransfersPage from './pages/TransfersPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import SubscriptionDetailPage from './pages/SubscriptionDetailPage';
import SettingsPage from './pages/SettingsPage';

// Protected Route Component
function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Public Route Component (redirects to dashboard if already logged in)
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Routes */}
      <Route element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardPage />} />
        
        {/* Assets */}
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assets/new" element={<AssetFormPage />} />
        <Route path="/assets/:id" element={<AssetDetailPage />} />
        <Route path="/assets/:id/edit" element={<AssetFormPage />} />
        
        {/* Employees */}
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/new" element={<EmployeeFormPage />} />
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
        
        {/* Inventory */}
        <Route path="/inventory" element={<InventoryPage />} />

        {/* Vehicle Fleet */}
        <Route path="/vehicles" element={<VehicleFleetPage />} />
        
        {/* Transfers */}
        <Route path="/transfers" element={<TransfersPage />} />
        
        {/* Subscriptions */}
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />

        {/* Settings - Admin Only */}
        <Route path="/settings" element={
          <ProtectedRoute requireAdmin>
            <SettingsPage />
          </ProtectedRoute>
        } />
      </Route>

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <BrandingProvider>
          <AuthProvider>
            <AppRoutes />
            <GlobalMusicPlayer />
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </BrandingProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
