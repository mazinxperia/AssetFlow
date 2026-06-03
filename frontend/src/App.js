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
import DisposedAssetsPage from './pages/DisposedAssetsPage';
import VehicleFleetPage from './pages/VehicleFleetPage';
import TransfersPage from './pages/TransfersPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import SubscriptionDetailPage from './pages/SubscriptionDetailPage';
import SettingsPage from './pages/SettingsPage';
import PersonalizationPage from './pages/PersonalizationPage';

// Protected Route Component
function ProtectedRoute({ children, requireAdmin = false, requireWrite = false }) {
  const { isAuthenticated, loading, isSuperAdmin, canWrite } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireWrite && !canWrite) {
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
        <Route path="/assets/new" element={<ProtectedRoute requireWrite><AssetFormPage /></ProtectedRoute>} />
        <Route path="/assets/:id" element={<AssetDetailPage />} />
        <Route path="/assets/:id/edit" element={<ProtectedRoute requireWrite><AssetFormPage /></ProtectedRoute>} />
        
        {/* Employees */}
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/new" element={<ProtectedRoute requireWrite><EmployeeFormPage /></ProtectedRoute>} />
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/employees/:id/edit" element={<ProtectedRoute requireWrite><EmployeeFormPage /></ProtectedRoute>} />
        
        {/* Inventory */}
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/disposed-assets" element={<DisposedAssetsPage />} />

        {/* Vehicle Fleet */}
        <Route path="/vehicles" element={<VehicleFleetPage />} />
        
        {/* Transfers */}
        <Route path="/transfers" element={<TransfersPage />} />
        
        {/* Subscriptions */}
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />

        <Route path="/personalization" element={<PersonalizationPage />} />

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
      <AuthProvider>
        <ThemeProvider>
          <BrandingProvider>
            <AppRoutes />
            <GlobalMusicPlayer />
            <Toaster position="top-right" richColors />
          </BrandingProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
