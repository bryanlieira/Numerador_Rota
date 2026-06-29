import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Mail, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) { setError('Informe seu e-mail.'); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-amber-400 rounded-2xl p-4 shadow-lg shadow-amber-400/30">
            <MapPin className="w-10 h-10 text-gray-950" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-white">Leitor Circuit</h1>
            <p className="text-gray-500 text-xs mt-0.5">Recuperar senha</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-green-900/40 border border-green-500/30 rounded-2xl p-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold">E-mail enviado!</p>
                <p className="text-gray-400 text-sm mt-1">
                  Verifique sua caixa de entrada em <span className="text-amber-400">{email}</span> e siga as instruções para redefinir sua senha.
                </p>
              </div>
              <Link
                to="/login"
                className="w-full bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all text-gray-950 font-bold text-sm py-3 rounded-xl text-center block mt-2"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <p className="text-white font-semibold text-sm">Esqueceu sua senha?</p>
                <p className="text-gray-500 text-xs mt-1">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-60 active:scale-95 transition-all text-gray-950 font-bold text-base py-3.5 rounded-xl flex items-center justify-center gap-2"
                >
                  {loading
                    ? <div className="w-5 h-5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                    : 'Enviar link de recuperação'}
                </button>
              </form>

              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
