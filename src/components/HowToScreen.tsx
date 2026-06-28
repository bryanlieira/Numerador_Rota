import { X, CheckCircle, Printer, FolderOpen, Camera, Route, Download, Share2, MoreVertical } from 'lucide-react';

interface HowToScreenProps {
  onClose: () => void;
}

const usageSteps = [
  {
    icon: Route,
    title: 'Rota otimizada primeiro',
    desc: 'Certifique-se de que a rota já está roterizada/otimizada no Spoke/Circuit antes de gerar o PDF.',
    accent: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/30',
  },
  {
    icon: MoreVertical,
    title: 'Menu de três pontinhos (⋮)',
    desc: 'No app Spoke/Circuit, toque no menu ⋮ no canto superior direito da tela do mapa.',
    accent: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/30',
  },
  {
    icon: Printer,
    title: 'Imprimir rota',
    desc: 'Toque em "Imprimir rota" no menu que abrir.',
    accent: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/30',
  },
  {
    icon: FolderOpen,
    title: 'Salvar como PDF',
    desc: 'Na tela de impressão, toque em "Salvar como PDF" e salve o arquivo no celular.',
    accent: 'text-purple-400',
    bg: 'bg-purple-400/10 border-purple-400/30',
  },
  {
    icon: CheckCircle,
    title: 'Abrir no Leitor Circuit',
    desc: 'Abra o Leitor Circuit e toque em "Selecionar roteiro (PDF)", escolhendo o PDF salvo.',
    accent: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/30',
  },
  {
    icon: Camera,
    title: 'Escanear os pacotes',
    desc: 'Use a câmera ou a digitação manual para descobrir o número da parada de cada pacote.',
    accent: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/30',
  },
];

const androidSteps = [
  'Toque nos três pontinhos (⋮) no canto superior direito do navegador.',
  'Toque em "Adicionar à tela inicial" (ou "Instalar app").',
  'Confirme.',
];

const iosSteps = [
  'Toque no ícone de compartilhar (□ com seta para cima) na barra do Safari.',
  'Toque em "Adicionar à Tela de Início".',
  'Toque em "Adicionar".',
];

export default function HowToScreen({ onClose }: HowToScreenProps) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">Como usar</h2>
          <p className="text-gray-500 text-xs">Leitor de Parada Circuit</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-xl text-gray-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">

        {/* Usage steps */}
        {usageSteps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className={`flex items-start gap-4 rounded-2xl border px-4 py-4 ${step.bg}`}>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-900/60">
                  <Icon className={`w-5 h-5 ${step.accent}`} strokeWidth={2} />
                </div>
                <span className="text-gray-600 text-xs font-bold">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-base leading-tight ${step.accent}`}>{step.title}</p>
                <p className="text-gray-300 text-sm leading-snug mt-1">{step.desc}</p>
              </div>
            </div>
          );
        })}

        {/* Install section — static, no JS detection needed */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl px-4 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-amber-400" />
            <p className="text-white font-bold text-sm">Instalar na tela inicial</p>
          </div>

          {/* Android */}
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Android (Chrome)</p>
            <div className="space-y-2">
              {androidSteps.map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-gray-700 text-gray-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-gray-300 text-sm leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700" />

          {/* iOS */}
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">iPhone (Safari)</p>
            <div className="space-y-2">
              {iosSteps.map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-gray-700 text-gray-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-gray-300 text-sm leading-snug">
                    {i === 0 ? (
                      <>Toque no ícone de compartilhar (<Share2 className="w-3.5 h-3.5 inline -mt-0.5 mx-0.5" />) na barra do Safari.</>
                    ) : text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy note */}
        <div className="bg-gray-800/40 border border-gray-700/60 rounded-2xl px-4 py-4">
          <p className="text-gray-400 text-xs leading-relaxed text-center">
            O arquivo PDF <span className="text-white font-semibold">nunca é enviado a nenhum servidor</span> — toda a leitura acontece 100% no seu navegador. A rota processada fica salva localmente no seu celular.
          </p>
        </div>

        <div className="h-4" />
      </div>

      {/* Footer */}
      <div className="px-4 py-4 bg-gray-900 border-t border-gray-800 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-full bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all text-gray-950 font-bold text-base py-4 rounded-2xl"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
