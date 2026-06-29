import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import App from './App';
import LoginPage from './pages/LoginPage';
import AssinaturaExpiradaPage from './pages/AssinaturaExpiradaPage';
import EsqueciSenhaPage from './pages/EsqueciSenhaPage';
import AdminPainelPage from './pages/AdminPainelPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />

          {/* Protected scanner */}
          <Route
            path="/scanner"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />

          <Route path="/assinatura-expirada" element={<AssinaturaExpiradaPage />} />

          {/* Admin panel */}
          <Route
            path="/admin-painel"
            element={
              <AdminRoute>
                <AdminPainelPage />
              </AdminRoute>
            }
          />

          {/* Redirect root → scanner (ProtectedRoute handles auth) */}
          <Route path="/" element={<Navigate to="/scanner" replace />} />
          <Route path="*" element={<Navigate to="/scanner" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
