import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { MapPin, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? '/scanner';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email || !password) { setError('Preencha e-mail e senha.'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate(from, { replace: true });
      } else {
        const { data: signUpData, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        // Ensure profile row exists (trigger may be delayed or fail silently)
        if (signUpData.user) {
          await supabase.from('profiles').upsert(
            { id: signUpData.user.id, email: signUpData.user.email ?? email, subscription_active: false },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        }
        setSuccess('Conta criada! Faça login abaixo.');
        setMode('login');
      }
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('Invalid login credentials')) setError('E-mail ou senha incorretos.');
      else if (msg.includes('User already registered')) setError('Este e-mail já tem uma conta. Faça login.');
      else if (msg.includes('Password should be')) setError('A senha deve ter ao menos 6 caracteres.');
      else setError(msg || 'Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-amber-400 rounded-2xl p-4 shadow-lg shadow-amber-400/30">
            <MapPin className="w-10 h-10 text-gray-950" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-white">Leitor Circuit</h1>
            <p className="text-gray-500 text-xs mt-0.5">Leitor de Parada Circuit</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-gray-800">
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                  mode === m ? 'bg-amber-400 text-gray-950' : 'bg-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {success && (
            <div className="bg-green-900/50 border border-green-500/40 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-green-400 text-sm">{success}</span>
            </div>
          )}
          {error && (
            <div className="bg-red-900/50 border border-red-500/40 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-gray-800 border border-gray-700 focus:border-amber-400 outline-none text-white text-sm pl-10 pr-4 py-3 rounded-xl placeholder-gray-600 transition-colors"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-amber-400 outline-none text-white text-sm pl-10 pr-12 py-3 rounded-xl placeholder-gray-600 transition-colors"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-60 active:scale-95 transition-all text-gray-950 font-bold text-base py-3.5 rounded-xl flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {mode === 'login' && (
            <Link
              to="/esqueci-senha"
              className="text-center text-gray-500 hover:text-amber-400 text-xs transition-colors"
            >
              Esqueceu sua senha?
            </Link>
          )}
        </div>

        {/* Subscribe CTA */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 text-center">
          <p className="text-gray-300 text-sm font-medium">Ainda não tem assinatura?</p>
          <a
            href="https://pay.cakto.com.br/oubovht_946123"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-green-500 hover:bg-green-400 active:scale-95 transition-all text-white font-bold text-base py-3.5 rounded-xl block"
          >
            Assinar agora
          </a>
          <p className="text-gray-600 text-xs">Após o pagamento, crie sua conta aqui e o acesso será liberado automaticamente.</p>
        </div>


      </div>
    </div>
  );
}
