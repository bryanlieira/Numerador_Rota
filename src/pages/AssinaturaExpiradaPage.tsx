import { Link } from 'react-router-dom';
import { MapPin, CreditCard, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AssinaturaExpiradaPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-amber-400 rounded-2xl p-4 shadow-lg shadow-amber-400/30">
            <MapPin className="w-10 h-10 text-gray-950" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-black text-white">Leitor Circuit</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5 text-center">
          <div className="w-16 h-16 bg-red-900/40 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-xl">Assinatura inativa</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              Sua assinatura não está ativa ou expirou. Assine para continuar usando o Leitor Circuit.
            </p>
            {user && (
              <p className="text-gray-600 text-xs mt-3">
                Logado como <span className="text-gray-400">{user.email}</span>
              </p>
            )}
          </div>

          <a
            href="https://pay.cakto.com.br/oubovht_946123"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-green-500 hover:bg-green-400 active:scale-95 transition-all text-white font-bold text-base py-4 rounded-xl block"
          >
            Assinar agora
          </a>

          <p className="text-gray-600 text-xs leading-relaxed">
            Já assinou? Aguarde alguns instantes — o acesso é liberado automaticamente após a confirmação do pagamento. Recarregue a página se necessário.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all text-gray-300 font-semibold text-sm py-3.5 rounded-xl"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
          <Link to="/" className="text-center text-gray-600 text-xs underline">Voltar ao início</Link>
        </div>
      </div>
    </div>
  );
}
