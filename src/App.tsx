import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, CheckCircle, Camera, Search, RotateCcw,
  Keyboard, MapPin, AlertCircle, X, HelpCircle, LogOut, Shield,
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import {
  processarPDF, buscarCodigo, buscarEndereco, extrairCodigoDoQR,
  salvarRota, carregarRota, limparRota,
  TabelaRota, ParadaInfo, ParadaRaw,
} from './lib/pdfParser';
import HowToScreen from './components/HowToScreen';
import QRScanner from './components/QRScanner';

type Screen = 'home' | 'loading' | 'reader';
type Mode = 'camera' | 'manual';

interface ScanResult {
  type: 'found' | 'not_found';
  info?: ParadaInfo;
}

// ── Helper: "Parada 74, 75 e 76 nesta rua também" ───────────────────────────
function listarOutrasParadas(numeros: number[], limite = 5): string {
  if (numeros.length === 0) return '';
  if (numeros.length > limite) return `+${numeros.length} paradas nesta rua também`;
  if (numeros.length === 1) return `Parada ${numeros[0]} nesta rua também`;
  const head = numeros.slice(0, -1).join(', ');
  return `Parada ${head} e ${numeros[numeros.length - 1]} nesta rua também`;
}

export default function App() {
  const { signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('home');
  const [tabela, setTabela] = useState<TabelaRota>({});
  const [paradas, setParadas] = useState<ParadaRaw[]>([]);
  const [totalParadas, setTotalParadas] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);

  // Reader state
  const [mode, setMode] = useState<Mode>('camera');
  const [cameraEverOpened, setCameraEverOpened] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [addressResults, setAddressResults] = useState<ParadaInfo[]>([]);

  const lastScannedRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // ── Load saved route on mount ──────────────────────────────────────────────
  useEffect(() => {
    const saved = carregarRota();
    if (saved) {
      setTabela(saved.tabela);
      setParadas(saved.paradas);
      setTotalParadas(saved.totalParadas);
      setMode('camera');
      setCameraEverOpened(true);
      setScreen('reader');
    }
  }, []);

  // ── PDF processing ─────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setLoadError(null);
    setScreen('loading');
    try {
      const { tabela: t, paradas: p, totalParadas: total } = await processarPDF(file);
      setTabela(t);
      setParadas(p);
      setTotalParadas(total);
      salvarRota({ tabela: t, paradas: p, totalParadas: total });
      setMode('camera');
      setCameraEverOpened(true);
      setResult(null);
      lastScannedRef.current = null;
      setManualInput('');
      setAddressResults([]);
      setScreen('reader');
    } catch (err: any) {
      setLoadError(err.message || 'Erro ao ler o PDF.');
      setScreen('home');
    }
  };

  // ── QR scan ────────────────────────────────────────────────────────────────
  const handleScanResult = useCallback(
    (text: string) => {
      const codigo = extrairCodigoDoQR(text) ?? text.trim().toUpperCase();
      if (lastScannedRef.current === codigo) return;
      lastScannedRef.current = codigo;

      const info = buscarCodigo(tabela, codigo);
      setResult(info ? { type: 'found', info } : { type: 'not_found' });
      if (info) {
        if (navigator.vibrate) navigator.vibrate(80);
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.18);
        } catch {}
      }
    },
    [tabela]
  );

  // ── Manual / address search ────────────────────────────────────────────────
  const isLikelyCodigo = (val: string) => /BR[0-9A-Z]{4,}/i.test(val) || /^[0-9A-Z]{6,}$/i.test(val.replace(/\s/g, ''));

  const handleManualSearch = useCallback(() => {
    const val = manualInput.trim();
    if (!val) return;
    setAddressResults([]);

    if (isLikelyCodigo(val)) {
      const info = buscarCodigo(tabela, val);
      setResult(info ? { type: 'found', info } : { type: 'not_found' });
    } else {
      const found = buscarEndereco(paradas, tabela, val);
      if (found.length === 1) {
        setResult({ type: 'found', info: found[0] });
      } else if (found.length > 1) {
        setAddressResults(found);
        setResult(null);
      } else {
        setResult({ type: 'not_found' });
      }
    }
  }, [manualInput, tabela, paradas]);

  const handleAddressSelect = (info: ParadaInfo) => {
    setResult({ type: 'found', info });
    setAddressResults([]);
  };

  // ── Mode switch — camera never unmounts ────────────────────────────────────
  const switchMode = (next: Mode) => {
    setMode(next);
    if (next === 'camera') {
      setCameraEverOpened(true);
      lastScannedRef.current = null;
    }
  };

  // ── New route ──────────────────────────────────────────────────────────────
  const handleNewRoute = () => {
    limparRota();
    setTabela({});
    setParadas([]);
    setTotalParadas(0);
    setResult(null);
    setManualInput('');
    setAddressResults([]);
    lastScannedRef.current = null;
    setLoadError(null);
    setCameraEverOpened(false);
    setScreen('home');
  };

  // Focus manual input when switching
  useEffect(() => {
    if (mode === 'manual' && manualInputRef.current) {
      setTimeout(() => manualInputRef.current?.focus(), 80);
    }
  }, [mode]);

  const cameraVisible = mode === 'camera';

  // ── Shared result card ─────────────────────────────────────────────────────
  const ResultCard = ({ inOverlay }: { inOverlay: boolean }) => {
    if (!result) return null;
    const base = inOverlay
      ? 'w-full px-4 py-3 flex flex-col items-center gap-0.5'
      : 'rounded-2xl px-5 py-4 flex flex-col items-center gap-0.5 flex-shrink-0';
    const bg = result.type === 'found'
      ? inOverlay ? 'bg-gray-950/96 border-b-2 border-amber-400/70' : 'bg-gray-800 border-2 border-amber-400/50'
      : inOverlay ? 'bg-red-950/96 border-b-2 border-red-500/60' : 'bg-red-900/40 border-2 border-red-500/40';

    return (
      <div className={`${base} ${bg}`}>
        {result.type === 'found' && result.info ? (
          <>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest leading-none">Parada</p>
            <p className="text-amber-400 font-black leading-none" style={{ fontSize: 'clamp(3.5rem, 18vw, 6rem)' }}>
              {result.info.numeroParada}
            </p>
            {result.info.grupoTotal > 1 && (
              <div className="bg-amber-400/20 border border-amber-400/40 rounded-xl px-5 py-1 mt-0.5">
                <p className="text-amber-300 text-xl font-bold">
                  Pacote {result.info.grupoIndex}/{result.info.grupoTotal}
                </p>
              </div>
            )}
            <p className="text-gray-500 text-xs mt-1 text-center max-w-xs leading-snug">
              {result.info.endereco}
            </p>
            {result.info.outrosPrediosNaRua.length > 0 && (
              <p className="text-gray-600 text-xs mt-0.5 text-center">
                {listarOutrasParadas(result.info.outrosPrediosNaRua)}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" strokeWidth={2} />
            <p className="text-red-300 text-base font-semibold">Código não encontrado nesta rota</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {showHowTo && <HowToScreen onClose={() => setShowHowTo(false)} />}

      <div className="flex flex-col bg-gray-950 text-white" style={{ minHeight: '100dvh' }}>

        {/* ── HOME ───────────────────────────────────────────── */}
        {screen === 'home' && (
          <div className="flex flex-col flex-1 items-center justify-between px-6 py-10 max-w-md mx-auto w-full">
            <div className="flex flex-col items-center gap-3 mt-8 w-full">
              <div className="flex flex-col items-center gap-3">
                  <div className="bg-amber-400 rounded-2xl p-4 shadow-lg shadow-amber-400/30">
                    <MapPin className="w-10 h-10 text-gray-950" strokeWidth={2.5} />
                  </div>
                  <div className="text-center">
                    <h1 className="text-2xl font-black tracking-tight text-white">Leitor Circuit</h1>
                    <p className="text-gray-500 text-xs mt-0.5">Leitor de Parada Circuit</p>
                  </div>
              </div>
              <p className="text-gray-400 text-center text-base leading-relaxed max-w-xs mt-2">
                Suba o roteiro PDF do Spoke/Circuit e escaneie os QR codes dos pacotes para encontrar cada parada instantaneamente.
              </p>
            </div>

            {loadError && (
              <div className="bg-red-900/60 border border-red-500/50 rounded-2xl px-5 py-4 flex items-start gap-3 w-full">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm leading-snug">{loadError}</p>
              </div>
            )}

            <div className="flex flex-col gap-4 w-full">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all duration-150 text-gray-950 font-bold text-xl py-5 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-amber-400/20"
              >
                <Upload className="w-6 h-6" strokeWidth={2.5} />
                Selecionar roteiro (PDF)
              </button>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />

              <button
                onClick={() => setShowHowTo(true)}
                className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all text-gray-300 font-semibold text-base py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <HelpCircle className="w-5 h-5" />
                Como usar
              </button>

              <p className="text-center text-gray-600 text-xs leading-relaxed px-2">
                Seus arquivos não são enviados a nenhum servidor — a leitura acontece no seu navegador, e a rota processada fica salva localmente no seu celular até você carregar uma nova.
              </p>
            </div>
          </div>
        )}

        {/* ── LOADING ─────────────────────────────────────────── */}
        {screen === 'loading' && (
          <div className="flex flex-col flex-1 items-center justify-center gap-6 px-6" style={{ minHeight: '100dvh' }}>
            <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xl font-semibold text-gray-200">Lendo roteiro...</p>
            <p className="text-gray-500 text-sm text-center">Isso pode levar alguns segundos dependendo do tamanho do PDF.</p>
          </div>
        )}

        {/* ── READER ──────────────────────────────────────────── */}
        {screen === 'reader' && (
          <div className="flex flex-col max-w-md mx-auto w-full" style={{ height: '100dvh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" strokeWidth={2} />
                <p className="text-white font-bold text-sm">{totalParadas} paradas carregadas</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNewRoute}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all px-3 py-2 rounded-xl text-gray-300 text-sm font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  Nova rota
                </button>
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin-painel')}
                    className="w-8 h-8 flex items-center justify-center bg-amber-400/10 hover:bg-amber-400/20 active:scale-95 transition-all rounded-xl text-amber-400"
                    title="Painel Admin"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={async () => { await signOut(); navigate('/login'); }}
                  className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-xl text-gray-500 hover:text-gray-300"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-900 border-b border-gray-800 flex-shrink-0">
              <button
                onClick={() => switchMode('camera')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all ${
                  mode === 'camera' ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-950/40' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Camera className="w-4 h-4" strokeWidth={2} />
                Ler com câmera
              </button>
              <button
                onClick={() => switchMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all ${
                  mode === 'manual' ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-950/40' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Keyboard className="w-4 h-4" strokeWidth={2} />
                Digitar código
              </button>
            </div>

            {/* ── Content: camera and manual layers, both absolute ── */}
            <div className="flex-1 relative overflow-hidden">

              {/* ── CAMERA LAYER (always mounted after first open) ── */}
              <div
                className="absolute inset-0 flex flex-col bg-black"
                style={{ display: cameraVisible ? undefined : 'none' }}
              >
                {cameraEverOpened && (
                  <>
                    {/*
                      Result bar: flex-shrink-0 inside a flex column.
                      DOES NOT push the camera — camera is in a separate
                      flex-1 wrapper with overflow:hidden, so the video
                      fills whatever space remains without shifting.
                    */}
                    <div className="flex-shrink-0">
                      <ResultCard inOverlay />
                    </div>
                    {/* Camera fills the rest — fixed height, never shifts */}
                    <div className="flex-1 min-h-0">
                      <QRScanner onScan={handleScanResult} visible={cameraVisible} />
                    </div>
                  </>
                )}
              </div>

              {/* ── MANUAL LAYER ── */}
              <div
                className="absolute inset-0 flex flex-col px-5 pt-4 gap-3 overflow-y-auto bg-gray-950"
                style={{ display: mode === 'manual' ? undefined : 'none' }}
              >
                {/* Result card at top */}
                <ResultCard inOverlay={false} />

                {/* Address search results list */}
                {addressResults.length > 1 && (
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide px-1 mb-1">
                      {addressResults.length} resultados encontrados
                    </p>
                    {addressResults.map((info) => (
                      <button
                        key={info.codigo}
                        onClick={() => handleAddressSelect(info)}
                        className="w-full text-left bg-gray-800 hover:bg-gray-700 active:scale-[0.99] transition-all border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-gray-300 text-sm leading-snug truncate">{info.endereco}</p>
                          {info.grupoTotal > 1 && (
                            <p className="text-gray-500 text-xs mt-0.5">Pacote {info.grupoIndex}/{info.grupoTotal}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 bg-amber-400/20 border border-amber-400/40 rounded-lg px-2.5 py-1">
                          <p className="text-amber-400 font-black text-lg leading-none">{info.numeroParada}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="flex-shrink-0">
                  <p className="text-gray-400 text-sm mb-2 font-medium">Código ou endereço:</p>
                  <div className="flex gap-2">
                    <input
                      ref={manualInputRef}
                      type="text"
                      value={manualInput}
                      onChange={(e) => {
                        setManualInput(e.target.value);
                        setResult(null);
                        setAddressResults([]);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                      placeholder="Ex: BR268023702160J ou Rua Fulano"
                      className="flex-1 bg-gray-800 border border-gray-700 focus:border-amber-400 outline-none text-white text-base font-mono px-4 py-3.5 rounded-xl placeholder-gray-600 transition-colors"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {manualInput && (
                      <button
                        onClick={() => {
                          setManualInput('');
                          setResult(null);
                          setAddressResults([]);
                          manualInputRef.current?.focus();
                        }}
                        className="bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all p-3.5 rounded-xl text-gray-400"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleManualSearch}
                    className="mt-3 w-full bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all text-gray-950 font-bold text-base py-3.5 rounded-xl flex items-center justify-center gap-2"
                  >
                    <Search className="w-5 h-5" strokeWidth={2.5} />
                    Buscar
                  </button>
                </div>

                {!result && addressResults.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-700 py-6">
                    <Keyboard className="w-10 h-10" strokeWidth={1.5} />
                    <p className="text-sm text-center">Digite um código ou parte do endereço e toque em Buscar</p>
                  </div>
                )}

                <div className="h-4" />
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}
