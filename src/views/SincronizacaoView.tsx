import React, { useState, useEffect } from 'react';
import {
  syncService,
  FullAnalysisResult,
  SyncBatchProgress,
  SyncExecutionResult,
} from '../services/syncService';
import { syncStatusService, SyncStatusInfo } from '../services/syncStatusService';
import { useAuth } from '../auth/AuthContext';
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  HardDrive,
  Cloud,
  FileJson,
  LogIn,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const SincronizacaoView: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>(() => syncStatusService.getStatus());

  useEffect(() => {
    const unsubscribe = syncStatusService.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // Estados de backup
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Estados de análise e sincronização
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<FullAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Estados de resolução de conflitos
  const [conflictChoices, setConflictChoices] = useState<Record<string, 'manter_servidor' | 'usar_local'>>({});

  // Estados de execução do envio em lote
  const [isExecuting, setIsExecuting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<SyncBatchProgress | null>(null);
  const [executionResult, setExecutionResult] = useState<SyncExecutionResult | null>(null);

  // Expansão de coleções
  const [showAllCollections, setShowAllCollections] = useState(false);

  // 1. Download de backup
  const handleDownloadBackup = () => {
    setBackupError(null);
    try {
      const res = syncService.downloadLocalBackup();
      setBackupMessage(`Backup concluído! Arquivo "${res.filename}" gerado com ${res.totalKeys} chaves locais (${(res.totalBytes / 1024).toFixed(1)} KB).`);
      setTimeout(() => setBackupMessage(null), 8000);
    } catch (err) {
      setBackupError(`Falha ao gerar backup: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 2. Análise de diferenças
  const handleAnalyze = async (preserveResult: boolean = false) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    if (!preserveResult) {
      setExecutionResult(null);
    }
    setConflictChoices({});
    try {
      const res = await syncService.analyzeDifferences();
      setAnalysis(res);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. Escolha por conflito
  const handleConflictChoice = (conflictKey: string, choice: 'manter_servidor' | 'usar_local') => {
    setConflictChoices((prev) => ({
      ...prev,
      [conflictKey]: choice,
    }));
  };

  const handleBulkConflictChoice = (choice: 'manter_servidor' | 'usar_local') => {
    if (!analysis) return;
    const newChoices: Record<string, 'manter_servidor' | 'usar_local'> = {};
    analysis.allConflicts.forEach((c) => {
      const key = `${c.collectionId}:${c.id}`;
      newChoices[key] = choice;
    });
    setConflictChoices(newChoices);
  };

  // Verifica se todos os conflitos foram decididos
  const unresolvedConflictsCount = analysis
    ? analysis.allConflicts.filter((c) => !conflictChoices[`${c.collectionId}:${c.id}`]).length
    : 0;

  // Total de itens que serão escritos no Firestore
  const totalItemsToSend = analysis
    ? analysis.totalToSend +
      analysis.allConflicts.filter((c) => conflictChoices[`${c.collectionId}:${c.id}`] === 'usar_local').length
    : 0;

  // 4. Execução do envio
  const handleConfirmSync = async () => {
    if (!analysis) return;
    if (unresolvedConflictsCount > 0) {
      setAnalysisError(`Por favor, tome uma decisão para todos os ${unresolvedConflictsCount} conflitos antes de confirmar o envio.`);
      return;
    }

    // Vincula escolhas aos itens de conflito
    const updatedAnalysis: FullAnalysisResult = {
      ...analysis,
      allConflicts: analysis.allConflicts.map((c) => ({
        ...c,
        choice: conflictChoices[`${c.collectionId}:${c.id}`],
      })),
    };

    setIsExecuting(true);
    setAnalysisError(null);
    setExecutionResult(null);

    try {
      const res = await syncService.executeSync(updatedAnalysis, (progress) => {
        setBatchProgress(progress);
      });
      setExecutionResult(res);
      // Recarrega análise preservando o resumo final da execução
      await handleAnalyze(true);
    } catch (err) {
      setAnalysisError(`Erro durante o envio: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExecuting(false);
      setBatchProgress(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Cabeçalho da Tela */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-slate-900 text-white shrink-0 shadow-xs">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Sincronização e Backup
                </h2>
                <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  Administrador
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Gerencie o backup local deste navegador e sincronize dados de forma controlada com o banco de dados do servidor (Firestore).
              </p>
            </div>
          </div>

          {/* Status Atual Rápido */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            {syncStatus.hasFirebaseSession ? (
              <>
                <Cloud className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700 block">Sessão Firebase Ativa</span>
                  <span className="text-slate-500 font-mono text-[11px]">{syncStatus.firebaseEmail}</span>
                </div>
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700 block">Modo Navegador</span>
                  <span className="text-slate-500 text-[11px]">Sem sessão ativa do Firebase</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO A: BAIXAR BACKUP DESTE NAVEGADOR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">1. Baixar backup deste navegador</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
                Exporta um arquivo JSON estruturado contendo todos os registros e parâmetros armazenados no localStorage deste computador (todas as chaves <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-800">toolshop_*</code>).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors shadow-2xs shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Baixar backup (JSON)</span>
          </button>
        </div>

        {backupMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{backupMessage}</span>
          </div>
        )}

        {backupError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 animate-in fade-in">
            <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{backupError}</span>
          </div>
        )}
      </div>

      {/* SEÇÃO B: ENVIAR DADOS DESTE NAVEGADOR PARA O SERVIDOR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">2. Enviar dados deste navegador para o servidor</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
                Compara cada registro do navegador com o Firestore por ID. Itens idênticos são ignorados; itens novos são preparados para envio; e conflitos exigem escolha individual antes da confirmação.
              </p>
            </div>
          </div>

          {syncStatus.hasFirebaseSession ? (
            <button
              type="button"
              onClick={() => handleAnalyze(false)}
              disabled={isAnalyzing || isExecuting}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors shadow-2xs shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Analisando dados...' : 'Analisar diferenças'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => loginWithGoogle()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors shadow-2xs shrink-0"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar com Google</span>
            </button>
          )}
        </div>

        {/* Alerta se não houver sessão do Firebase */}
        {!syncStatus.hasFirebaseSession && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Sessão do Firebase necessária</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              O envio de dados para o servidor exige uma conta Google com permissão autenticada no Firebase Authentication. Faça login com o Google para habilitar a comparação e gravação.
            </p>
          </div>
        )}

        {/* Erro durante a análise */}
        {analysisError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
            <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Falha na análise de sincronização:</span>
              <span>{analysisError}</span>
            </div>
          </div>
        )}

        {/* PRÉ-VISUALIZAÇÃO COM CONTAGENS POR COLEÇÃO */}
        {analysis && (
          <div className="space-y-6 pt-2">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                <span className="text-xs font-semibold text-indigo-700 block uppercase tracking-wider">A Enviar (Só no Local)</span>
                <span className="text-2xl font-bold text-indigo-950 mt-1 block tabular-nums">
                  {analysis.totalToSend}
                </span>
                <span className="text-[11px] text-indigo-600 mt-1 block">
                  Registros novos que ainda não existem no servidor.
                </span>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <span className="text-xs font-semibold text-emerald-700 block uppercase tracking-wider">Idênticos (Ignorados)</span>
                <span className="text-2xl font-bold text-emerald-950 mt-1 block tabular-nums">
                  {analysis.totalIdentical}
                </span>
                <span className="text-[11px] text-emerald-600 mt-1 block">
                  Registros exatamente iguais nos dois lados (inclui exemplos).
                </span>
              </div>

              <div className={`rounded-xl border p-4 ${analysis.totalConflicts > 0 ? 'border-amber-300 bg-amber-50/80' : 'border-slate-200 bg-slate-50'}`}>
                <span className={`text-xs font-semibold block uppercase tracking-wider ${analysis.totalConflicts > 0 ? 'text-amber-800' : 'text-slate-600'}`}>
                  Conflitos Detectados
                </span>
                <span className={`text-2xl font-bold mt-1 block tabular-nums ${analysis.totalConflicts > 0 ? 'text-amber-950' : 'text-slate-800'}`}>
                  {analysis.totalConflicts}
                </span>
                <span className={`text-[11px] mt-1 block ${analysis.totalConflicts > 0 ? 'text-amber-700 font-medium' : 'text-slate-500'}`}>
                  {analysis.totalConflicts > 0
                    ? `${unresolvedConflictsCount} conflito(s) aguardando sua decisão.`
                    : 'Nenhuma divergência encontrada.'}
                </span>
              </div>
            </div>

            {/* Tabela de Contagens por Coleção */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <span>Detalhamento por Coleção de Dados</span>
                <button
                  type="button"
                  onClick={() => setShowAllCollections((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900"
                >
                  <span>{showAllCollections ? 'Recolher coleções vazias' : 'Ver todas as coleções'}</span>
                  {showAllCollections ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Coleção</th>
                      <th className="px-4 py-2.5 text-center">Navegador</th>
                      <th className="px-4 py-2.5 text-center">Servidor</th>
                      <th className="px-4 py-2.5 text-center text-indigo-700">A Enviar</th>
                      <th className="px-4 py-2.5 text-center text-emerald-700">Idênticos</th>
                      <th className="px-4 py-2.5 text-center text-amber-700">Conflitos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.collections
                      .filter((col) => showAllCollections || col.totalLocal > 0 || col.totalServer > 0)
                      .map((col) => (
                        <tr key={col.collectionId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {col.collectionLabel}
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                              ({col.firestoreCollection})
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-slate-700">{col.totalLocal}</td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-slate-500">{col.totalServer}</td>
                          <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-indigo-700">
                            {col.toSendCount > 0 ? `+${col.toSendCount}` : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-emerald-700">
                            {col.identicalCount > 0 ? col.identicalCount : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums">
                            {col.conflictCount > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                                {col.conflictCount}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LISTA DE CONFLITOS COM ESCOLHA OBRIGATÓRIA */}
            {analysis.allConflicts.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">Resolução de Conflitos Obrigatória</h4>
                      <p className="text-xs text-amber-800">
                        O mesmo registro existe no navegador e no servidor com valores diferentes. Escolha a versão desejada para cada item antes de prosseguir.
                      </p>
                    </div>
                  </div>

                  {/* Ações em massa para resolução de conflitos */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleBulkConflictChoice('manter_servidor')}
                      className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-[11px] font-semibold text-slate-800 transition-colors"
                    >
                      Manter todos do Servidor
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkConflictChoice('usar_local')}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold text-white transition-colors"
                    >
                      Usar todos deste Navegador
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {analysis.allConflicts.map((conflict) => {
                    const conflictKey = `${conflict.collectionId}:${conflict.id}`;
                    const currentChoice = conflictChoices[conflictKey];

                    return (
                      <div
                        key={conflictKey}
                        className={`rounded-xl border p-4 transition-colors ${
                          currentChoice
                            ? 'border-slate-200 bg-white shadow-2xs'
                            : 'border-amber-300 bg-amber-50/40 shadow-xs ring-1 ring-amber-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{conflict.collectionLabel}</span>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              ID: {conflict.id}
                            </span>
                          </div>

                          {/* Seletor de Decisão do Conflito */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleConflictChoice(conflictKey, 'manter_servidor')}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                currentChoice === 'manter_servidor'
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Check className={`h-3.5 w-3.5 ${currentChoice === 'manter_servidor' ? 'text-emerald-400' : 'text-slate-400'}`} />
                              <span>Manter o do Servidor</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleConflictChoice(conflictKey, 'usar_local')}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                currentChoice === 'usar_local'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Check className={`h-3.5 w-3.5 ${currentChoice === 'usar_local' ? 'text-white' : 'text-slate-400'}`} />
                              <span>Usar o deste Navegador</span>
                            </button>
                          </div>
                        </div>

                        {/* Comparação dos Campos Principais Lado a Lado */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-xs">
                          {/* Lado Local */}
                          <div className={`p-3 rounded-lg border ${currentChoice === 'usar_local' ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-100 bg-slate-50/60'}`}>
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-700 uppercase tracking-wider mb-2">
                              <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                              <span>Deste Navegador (Local)</span>
                            </div>
                            <div className="space-y-1">
                              {Object.entries(conflict.localSummary).map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-2">
                                  <span className="text-slate-500">{k}:</span>
                                  <span className="font-medium text-slate-900 text-right">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Lado Servidor */}
                          <div className={`p-3 rounded-lg border ${currentChoice === 'manter_servidor' ? 'border-slate-400 bg-slate-100/70' : 'border-slate-100 bg-slate-50/60'}`}>
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-700 uppercase tracking-wider mb-2">
                              <Cloud className="h-3.5 w-3.5 text-slate-500" />
                              <span>Do Servidor (Firestore)</span>
                            </div>
                            <div className="space-y-1">
                              {Object.entries(conflict.serverSummary).map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-2">
                                  <span className="text-slate-500">{k}:</span>
                                  <span className="font-medium text-slate-900 text-right">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BARRA DE PROGRESSO DURANTE O ENVIO EM LOTES */}
            {isExecuting && batchProgress && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                  <span>{batchProgress.message}</span>
                  <span className="tabular-nums font-mono">{batchProgress.percent}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-indigo-200 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                    style={{ width: `${batchProgress.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-indigo-700">
                  <span>Lote {batchProgress.currentBatch} de {batchProgress.totalBatches} (máx. 400 escritas por lote)</span>
                  <span>{batchProgress.processedItems} de {batchProgress.totalItemsToWrite} registros processados</span>
                </div>
              </div>
            )}

            {/* BOTÃO CONFIRMAR ENVIO */}
            {!isExecuting && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600 space-y-0.5">
                  <div className="font-bold text-slate-900">
                    Total para gravação no servidor: {totalItemsToSend} registros
                  </div>
                  {unresolvedConflictsCount > 0 ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Resolva os {unresolvedConflictsCount} conflitos pendentes acima para liberar o envio.
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Todos os conflitos resolvidos. Os dados deste navegador NÃO serão apagados.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleConfirmSync}
                  disabled={unresolvedConflictsCount > 0 || totalItemsToSend === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Upload className="h-4 w-4" />
                  <span>Confirmar envio ({totalItemsToSend} registros)</span>
                </button>
              </div>
            )}

            {/* RESUMO FINAL DE EXECUÇÃO */}
            {executionResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2.5 text-emerald-900 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>Sincronização com o servidor concluída!</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg bg-white border border-emerald-200 p-3">
                    <span className="text-slate-500 block">Registros gravados no servidor:</span>
                    <span className="text-xl font-bold text-emerald-700 tabular-nums">
                      {executionResult.successCount}
                    </span>
                  </div>

                  <div className="rounded-lg bg-white border border-emerald-200 p-3">
                    <span className="text-slate-500 block">Lotes processados:</span>
                    <span className="text-xl font-bold text-slate-800 tabular-nums">
                      {executionResult.totalBatches}
                    </span>
                  </div>

                  <div className={`rounded-lg bg-white border p-3 ${executionResult.errorCount > 0 ? 'border-rose-300' : 'border-emerald-200'}`}>
                    <span className="text-slate-500 block">Erros de gravação:</span>
                    <span className={`text-xl font-bold tabular-nums ${executionResult.errorCount > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                      {executionResult.errorCount}
                    </span>
                  </div>
                </div>

                {/* Lista de Erros por Registro se houver */}
                {executionResult.errors.length > 0 && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-2 text-xs text-rose-900">
                    <span className="font-bold block">Falhas individuais por registro:</span>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {executionResult.errors.map((e, idx) => (
                        <div key={idx} className="font-mono text-[11px] bg-white p-1.5 rounded border border-rose-100">
                          [{e.collection}] ID {e.id}: {e.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 rounded-lg bg-white/80 border border-emerald-200 text-xs text-emerald-900 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Conforme exigido, os dados deste navegador permanecem intactos no localStorage e NÃO foram apagados.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
