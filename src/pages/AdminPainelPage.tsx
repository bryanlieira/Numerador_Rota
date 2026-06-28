import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, XCircle, Users, Activity, LogOut, RefreshCw, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Profile } from '../contexts/AuthContext';

const ADMIN_EMAIL = 'bryanoliveira.br@gmail.com';

interface LogEntry {
  id: string;
  email: string | null;
  rota: string | null;
  resultado: string | null;
  ip: string | null;
  criado_em: string;
}

type Plano = 'trial' | 'semanal' | 'mensal' | 'anual' | 'vitalicio' | '';

const PLANOS: { value: Plano; label: string; days: number | null }[] = [
  { value: 'trial', label: 'Trial (7 dias)', days: 7 },
  { value: 'semanal', label: 'Semanal (7 dias)', days: 7 },
  { value: 'mensal', label: 'Mensal (30 dias)', days: 30 },
  { value: 'anual', label: 'Anual (365 dias)', days: 365 },
  { value: 'vitalicio', label: 'Vitalício', days: null },
];

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminPainelPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Extra client-side guard in addition to AdminRoute
  useEffect(() => {
    if (user && user.email !== ADMIN_EMAIL) navigate('/', { replace: true });
  }, [user, navigate]);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles((data as Profile[]) ?? []);
    setLoadingProfiles(false);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('logs_acesso')
      .select('id, email, rota, resultado, ip, criado_em')
      .order('criado_em', { ascending: false })
      .limit(200);
    setLogs((data as LogEntry[]) ?? []);
    setLoadingLogs(false);
  }, []);

  useEffect(() => { fetchProfiles(); fetchLogs(); }, [fetchProfiles, fetchLogs]);

  const updateSubscription = async (profileId: string, plano: Plano, activate: boolean) => {
    setSaving(profileId);
    setError(null);
    const planoInfo = PLANOS.find((p) => p.value === plano);
    const expires_at = activate
      ? planoInfo?.days
        ? new Date(Date.now() + planoInfo.days * 86400_000).toISOString()
        : null
      : null;

    const { error: err } = await supabase
      .from('profiles')
      .update({
        subscription_active: activate,
        expires_at,
        plano: activate ? plano || null : null,
      })
      .eq('id', profileId);

    if (err) setError(`Erro ao atualizar: ${err.message}`);
    else await fetchProfiles();
    setSaving(null);
  };

  const filtered = profiles.filter(
    (p) => !search || p.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: profiles.length,
    active: profiles.filter((p) => p.subscription_active && (!p.expires_at || new Date(p.expires_at) > new Date())).length,
    blocked: profiles.filter((p) => !p.subscription_active || (p.expires_at && new Date(p.expires_at) <= new Date())).length,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-black text-base">Painel Admin</h1>
          <p className="text-gray-500 text-xs">{user?.email}</p>
        </div>
        <button
          onClick={() => { signOut(); navigate('/login'); }}
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all px-3 py-2 rounded-xl text-gray-300 text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: 'Usuários', value: stats.total, color: 'text-blue-400' },
            { icon: CheckCircle, label: 'Ativos', value: stats.active, color: 'text-green-400' },
            { icon: XCircle, label: 'Bloqueados', value: stats.blocked, color: 'text-red-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center gap-1">
              <Icon className={`w-5 h-5 ${color}`} />
              <p className="text-white font-black text-2xl">{value}</p>
              <p className="text-gray-500 text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-800">
          {(['users', 'logs'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === t ? 'bg-amber-400 text-gray-950' : 'bg-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'users' ? <><Users className="w-4 h-4" />Usuários</> : <><Activity className="w-4 h-4" />Logs</>}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500/40 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        {/* Users tab */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por e-mail..."
                  className="w-full bg-gray-800 border border-gray-700 focus:border-amber-400 outline-none text-white text-sm pl-10 pr-4 py-2.5 rounded-xl placeholder-gray-600 transition-colors"
                />
              </div>
              <button
                onClick={fetchProfiles}
                className="bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all p-2.5 rounded-xl text-gray-400"
              >
                <RefreshCw className={`w-4 h-4 ${loadingProfiles ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingProfiles ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">Nenhum usuário encontrado.</p>
            ) : (
              filtered.map((p) => {
                const isActive = p.subscription_active && (!p.expires_at || new Date(p.expires_at) > new Date());
                const isExpanded = expandedUser === p.id;
                return (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : p.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                        <div className="min-w-0 text-left">
                          <p className="text-white text-sm font-semibold truncate">{p.email}</p>
                          <p className="text-gray-500 text-xs">
                            {isActive ? `Ativo${p.plano ? ` · ${p.plano}` : ''}` : 'Sem assinatura'}
                            {p.expires_at ? ` · expira ${fmtDate(p.expires_at)}` : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-800 px-4 py-4 flex flex-col gap-3">
                        <p className="text-gray-500 text-xs">Cadastrado em: {fmtDate(p.created_at)}</p>

                        <div className="grid grid-cols-2 gap-2">
                          {PLANOS.map((plano) => (
                            <button
                              key={plano.value}
                              onClick={() => updateSubscription(p.id, plano.value, true)}
                              disabled={saving === p.id}
                              className="bg-green-900/40 hover:bg-green-900/70 border border-green-500/30 active:scale-95 transition-all text-green-400 text-xs font-semibold py-2 rounded-xl disabled:opacity-50"
                            >
                              {saving === p.id ? '...' : `+ ${plano.label}`}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => updateSubscription(p.id, '', false)}
                          disabled={saving === p.id}
                          className="w-full bg-red-900/40 hover:bg-red-900/70 border border-red-500/30 active:scale-95 transition-all text-red-400 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50"
                        >
                          {saving === p.id ? 'Salvando...' : 'Revogar acesso'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Logs tab */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                onClick={fetchLogs}
                className="bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all px-3 py-2 rounded-xl text-gray-400 flex items-center gap-1.5 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
            {loadingLogs ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">Nenhum log encontrado.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {logs.map((log) => {
                  const colorMap: Record<string, string> = {
                    permitido: 'text-green-400 bg-green-900/30 border-green-500/30',
                    bloqueado_sem_login: 'text-amber-400 bg-amber-900/30 border-amber-500/30',
                    bloqueado_sem_assinatura: 'text-red-400 bg-red-900/30 border-red-500/30',
                  };
                  const cls = colorMap[log.resultado ?? ''] ?? 'text-gray-400 bg-gray-800 border-gray-700';
                  return (
                    <div key={log.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm truncate">{log.email ?? 'anônimo'}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{log.rota} · {fmtDate(log.criado_em)}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${cls}`}>
                        {log.resultado?.replace('bloqueado_sem_', 'sem ') ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
