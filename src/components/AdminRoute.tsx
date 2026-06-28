import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props { children: React.ReactNode }

export default function AdminRoute({ children }: Props) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
