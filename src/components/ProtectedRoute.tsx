import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';

interface Props { children: React.ReactNode }

export default function ProtectedRoute({ children }: Props) {
  const { user, isSubscribed, loading } = useAuth();
  const location = useLocation();

  // Log access attempt server-side via Supabase insert
  useEffect(() => {
    if (loading) return;
    const resultado = !user
      ? 'bloqueado_sem_login'
      : !isSubscribed
      ? 'bloqueado_sem_assinatura'
      : 'permitido';
    supabase.from('logs_acesso').insert({
      user_id: user?.id ?? null,
      email: user?.email ?? null,
      rota: location.pathname,
      resultado,
    });
  }, [loading, user, isSubscribed, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isSubscribed) return <Navigate to="/assinatura-expirada" replace />;

  return <>{children}</>;
}
