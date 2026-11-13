import React, { useRef } from 'react';
import {
  ProjetoComDetalhes,
  Projeto,
  ComponenteComOperacoes,
  ModeloComponente,
  ConfiguracoesSistema,
} from '../../types';
import { formatDateBR, formatHours } from '../../utils/formatters';
import { formatarPesoKg } from '../../utils/weightCalculator';
import { Modal } from './Modal';
import { Printer, Download, X, Layers, FileText } from 'lucide-react';

interface OperacaoFolhaImpressao {
  id?: string;
  sequencia: number;
  descricao: string;
  instrucoes?: string;
  centroCustoNome: string;
  horas_estimadas?: number;
  prazo_dias?: number;
  isTerceirizado: boolean;
  fornecedor?: string;
}

interface ItemFolhaImpressao {
  id?: string;
  codigo?: string;
  nome: string;
  quantidade: number;
  material: string;
  formato: string;
  dimensoes: string;
  peso_kg?: number;
  peso_calculado?: boolean;
  tratamento?: string;
  observacoes?: string;
  operacoes: OperacaoFolhaImpressao[];
}

export interface FolhaProcessosModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: 'projeto' | 'componente' | 'modelo';
  projeto?: ProjetoComDetalhes | Projeto;
  clienteNome?: string;
  componente?: ComponenteComOperacoes;
  componentes?: ComponenteComOperacoes[];
  modelo?: ModeloComponente;
  configEmpresa?: ConfiguracoesSistema | null;
}

export const FolhaProcessosModal: React.FC<FolhaProcessosModalProps> = ({
  isOpen,
  onClose,
  tipo,
  projeto,
  clienteNome,
  componente,
  componentes,
  modelo,
  configEmpresa,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const dataEmissao = formatDateBR(new Date().toISOString());
  const revisaoPadrao = 'Rev. 00';

  // Dados da empresa padrão ou configurada
  const empresaNome = configEmpresa?.empresa_nome || 'TOOLSHOP FERRAMENTARIA & USINAGEM LTDA';
  const empresaCnpj = configEmpresa?.empresa_cnpj || '12.345.678/0001-90';
  const empresaEndereco =
    configEmpresa?.empresa_endereco ||
    'Rua das Indústrias, 1000 - Distrito Industrial - Joinville/SC';
  const empresaTelefone = configEmpresa?.empresa_telefone || '(47) 3456-7890';
  const empresaLogo = configEmpresa?.empresa_logo;

  // Lista de itens a serem impressos: ou componentes do projeto ou o modelo da biblioteca
  const itensParaImprimir: ItemFolhaImpressao[] = (() => {
    if (tipo === 'modelo' && modelo) {
      return [
        {
          id: modelo.id,
          codigo: modelo.codigo,
          nome: modelo.nome,
          quantidade: 1,
          material: modelo.material,
          formato: modelo.formato || 'BLOCO',
          dimensoes: modelo.dimensoes || '—',
          peso_kg: modelo.peso_kg,
          peso_calculado: modelo.peso_calculado,
          tratamento: modelo.tratamento,
          observacoes: modelo.observacoes,
          operacoes: modelo.operacoes.map((op) => ({
            id: op.id,
            sequencia: op.sequencia,
            descricao: op.descricao,
            instrucoes: op.instrucoes,
            centroCustoNome: op.categoria || op.tipo_maquina || 'Posto Interno',
            horas_estimadas: op.horas_estimadas,
            prazo_dias: op.prazo_dias,
            isTerceirizado: Boolean(op.fornecedor || op.prazo_dias),
            fornecedor: op.fornecedor,
          })),
        },
      ];
    }

    const listaComponentes =
      componentes ||
      (componente
        ? [componente]
        : projeto && 'componentes' in (projeto as any)
        ? (projeto as any).componentes
        : []);

    if (listaComponentes && listaComponentes.length > 0) {
      // Filtra apenas peças fabricadas na ferramentaria
      const compsFabricados = listaComponentes.filter(
        (c: ComponenteComOperacoes) => !c.tipo || c.tipo === 'fabricado'
      );
      return compsFabricados.map((comp: ComponenteComOperacoes) => ({
        id: comp.id,
        codigo: comp.codigo,
        nome: comp.nome,
        quantidade: comp.quantidade || 1,
        material: comp.material,
        formato: comp.formato || 'BLOCO',
        dimensoes: comp.dimensoes || '—',
        peso_kg: comp.peso_kg,
        peso_calculado: comp.peso_calculado,
        tratamento: comp.tratamento,
        observacoes: comp.observacoes,
        operacoes: comp.operacoes.map((op) => {
          const cc = op.centro_custo || op.maquina;
          const isTerceiro = cc?.origem === 'terceirizado' || Boolean(op.prazo_dias);
          return {
            id: op.id,
            sequencia: op.sequencia,
            descricao: op.descricao,
            instrucoes: op.instrucoes,
            centroCustoNome: cc?.nome || cc?.categoria || 'Centro de Custo',
            horas_estimadas: op.horas_estimadas,
            prazo_dias: op.prazo_dias ?? cc?.prazo_padrao_dias,
            isTerceirizado: isTerceiro,
            fornecedor: op.fornecedor || cc?.fornecedor_nome,
          };
        }),
      }));
    }

    return [];
  })();

  const handlePrint = () => {
    window.print();
  };

  const modalTitle =
    tipo === 'modelo'
      ? `Folha de Processos (Modelo): ${modelo?.codigo || ''}`
      : tipo === 'componente'
      ? `Folha de Processos: ${itensParaImprimir[0]?.codigo ? `${itensParaImprimir[0].codigo} - ` : ''}${itensParaImprimir[0]?.nome || ''}`
      : `Folhas de Processos do Projeto: ${projeto?.codigo || ''} (${itensParaImprimir.length} itens)`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth="5xl"
      footer={
        <div className="flex items-center justify-between w-full print:hidden">
          <div className="text-xs text-slate-500">
            Formato: <strong>A4 Retrato (Preto e Branco)</strong> • {itensParaImprimir.length}{' '}
            {itensParaImprimir.length === 1 ? 'folha de componente' : 'folhas de componentes'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-colors"
            >
              <Printer className="h-4 w-4 text-amber-400" />
              <span>Imprimir / Salvar em PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      }
    >
      {/* Estilos CSS específicos para impressão perfeita em folha A4 Retrato */}
      <style>{`
        @media print {
          /* Oculta tudo na tela fora da área do documento */
          body * {
            visibility: hidden;
          }
          #folha-processos-print-area, #folha-processos-print-area * {
            visibility: visible;
          }
          #folha-processos-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 10mm 10mm;
          }
          .folha-pagina {
            page-break-after: always;
            break-after: page;
          }
          .folha-pagina:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          .task-row-group {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Conteúdo Imprimível */}
      <div
        id="folha-processos-print-area"
        ref={printAreaRef}
        className="text-black bg-white max-h-[75vh] overflow-y-auto pr-1 print:max-h-none print:overflow-visible font-sans select-text"
      >
        {itensParaImprimir.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            Nenhum componente fabricado disponível para emissão da Folha de Processos.
          </div>
        ) : (
          itensParaImprimir.map((item, itemIdx) => {
            const totalPaginasComponente = 1; // Para exibição uniforme
            const codigoNomeComp = item.codigo
              ? `${item.codigo} - ${item.nome.toUpperCase()}`
              : item.nome.toUpperCase();

            return (
              <div
                key={item.id || itemIdx}
                className="folha-pagina border border-black p-4 mb-6 print:mb-0 print:border-none print:p-0 bg-white"
              >
                {/* =========================================================================
                    1. CABEÇALHO TÉCNICO (EMPRESA + DADOS DO PROJETO E COMPONENTE)
                ========================================================================= */}
                <div className="border-2 border-black mb-2 text-xs">
                  {/* Linha Superior: Logo + Dados da Empresa + Título Principal */}
                  <div className="flex items-stretch border-b-2 border-black">
                    {/* Bloco 1: Logotipo ou Ícone da Empresa */}
                    <div className="w-44 border-r-2 border-black p-2 flex items-center justify-center shrink-0">
                      {empresaLogo ? (
                        <img
                          src={empresaLogo}
                          alt="Logo"
                          className="max-h-14 max-w-[160px] object-contain"
                        />
                      ) : (
                        <div className="text-center font-bold text-xs uppercase tracking-wider text-black">
                          {empresaNome.split(' ')[0] || 'TOOLSHOP'}
                        </div>
                      )}
                    </div>

                    {/* Bloco 2: Dados Cadastrais da Empresa */}
                    <div className="flex-1 p-2 border-r-2 border-black flex flex-col justify-center text-[10px] leading-tight">
                      <strong className="text-xs uppercase font-extrabold tracking-wide">
                        {empresaNome}
                      </strong>
                      <span className="font-mono mt-0.5">CNPJ: {empresaCnpj}</span>
                      <span>{empresaEndereco}</span>
                      <span>Tel: {empresaTelefone}</span>
                    </div>

                    {/* Bloco 3: Título do Documento e Revisão */}
                    <div className="w-56 p-2 flex flex-col justify-center items-center text-center shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-700">
                        PLANO DE FABRICAÇÃO
                      </span>
                      <h1 className="text-base font-black tracking-tight uppercase">
                        FOLHA DE PROCESSOS
                      </h1>
                      <div className="mt-1 flex items-center gap-3 text-[10px] font-mono font-bold">
                        <span>Emissão: {dataEmissao}</span>
                        <span>•</span>
                        <span>{revisaoPadrao}</span>
                      </div>
                    </div>
                  </div>

                  {/* Linha de Dados do Projeto e Componente */}
                  <div className="grid grid-cols-12 divide-x border-b border-black text-[11px] bg-slate-50 print:bg-transparent">
                    <div className="col-span-3 p-1.5">
                      <span className="block text-[9px] font-bold text-slate-600 uppercase">
                        Cód. Orçamento:
                      </span>
                      <strong className="font-mono font-bold">
                        {tipo === 'modelo' ? '—' : projeto?.orcamento_codigo || '—'}
                      </strong>
                    </div>

                    <div className="col-span-5 p-1.5">
                      <span className="block text-[9px] font-bold text-slate-600 uppercase">
                        Cliente:
                      </span>
                      <strong className="truncate block">
                        {tipo === 'modelo'
                          ? 'MODELO TÉCNICO (BIBLIOTECA)'
                          : clienteNome || (projeto as ProjetoComDetalhes)?.cliente?.nome || '—'}
                      </strong>
                    </div>

                    <div className="col-span-2 p-1.5">
                      <span className="block text-[9px] font-bold text-slate-600 uppercase">
                        O.S. / Projeto:
                      </span>
                      <strong className="font-mono font-bold">
                        {tipo === 'modelo' ? item.codigo : projeto?.codigo || '—'}
                      </strong>
                    </div>

                    <div className="col-span-2 p-1.5 text-right">
                      <span className="block text-[9px] font-bold text-slate-600 uppercase">
                        Prazo de Entrega:
                      </span>
                      <strong className="font-mono font-bold">
                        {tipo === 'modelo'
                          ? 'PADRÃO'
                          : projeto?.prazo
                          ? formatDateBR(projeto.prazo)
                          : '—'}
                      </strong>
                    </div>
                  </div>

                  {/* Segunda Linha: Descrição do Projeto, Peça e Planejador */}
                  <div className="grid grid-cols-12 divide-x text-[11px]">
                    <div className="col-span-6 p-1.5">
                      <span className="block text-[9px] font-bold text-slate-600 uppercase">
                        Descrição do Projeto:
                      </span>
                      <strong className="block truncate">
                        {tipo === 'modelo' ? 'ROTEIRO TÉCNICO PADRÃO' : projeto?.descricao || '—'}
                      </strong>
                    </div>

                    <div className="col-span-4 p-1.5">
                      <span className="block text-[9px] font-bold text-slate-600 uppercase">
                        Componente / Peça:
                      </span>
                      <strong className="block font-bold truncate">{codigoNomeComp}</strong>
                    </div>

                    <div className="col-span-2 p-1.5 text-right">
                      <span className="block text-[9px] font-bold text-slate-600 uppercase">
                        Quantidade:
                      </span>
                      <strong className="font-mono font-bold text-xs">
                        {item.quantidade || 1} un.
                      </strong>
                    </div>
                  </div>

                  {/* Terceira Linha: Planejador */}
                  <div className="border-t border-black px-2 py-1 flex items-center justify-between text-[10px] font-medium bg-slate-50 print:bg-transparent">
                    <div>
                      <span className="text-slate-600 font-bold uppercase mr-1">Planejador:</span>
                      <strong className="text-black">
                        {tipo === 'modelo' ? 'ENGENHARIA DE PROCESSOS' : projeto?.planejador || '—'}
                      </strong>
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono">
                      <span>Status da Folha: </span>
                      <strong className="text-black uppercase">Liberada para Produção</strong>
                    </div>
                  </div>
                </div>

                {/* =========================================================================
                    2. LINHA DE MATERIAL, BRUTO E TRATAMENTO (ANTES DAS TAREFAS)
                ========================================================================= */}
                <div className="border-2 border-black bg-slate-100 print:bg-transparent p-2 mb-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-600 mr-1.5">
                        Especificação do Material:
                      </span>
                      <strong className="font-bold text-black uppercase">{item.material}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-600 mr-1.5">
                        Formato & Dimensões Bruto:
                      </span>
                      <strong className="font-mono font-bold text-black uppercase">
                        {item.formato ? `${item.formato} - ` : ''}
                        {item.dimensoes || '—'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-600 mr-1.5">
                        Peso Bruto:
                      </span>
                      <strong className="font-mono font-bold text-black">
                        {formatarPesoKg(item.peso_kg, item.peso_calculado)}
                      </strong>
                    </div>
                  </div>

                  {/* Tratamento / Observações Técnicas do Bruto */}
                  {(item.tratamento || item.observacoes) && (
                    <div className="mt-1 pt-1 border-t border-black text-[11px] flex flex-wrap gap-x-4">
                      {item.tratamento && (
                        <span>
                          <strong className="text-slate-700">Tratamento:</strong> {item.tratamento}
                        </span>
                      )}
                      {item.observacoes && (
                        <span className="italic">
                          <strong className="text-slate-700 not-italic">Obs:</strong>{' '}
                          {item.observacoes}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* =========================================================================
                    3. TABELA DE TAREFAS / ROTEIRO TÉCNICO
                ========================================================================= */}
                <div className="overflow-visible mb-2">
                  <table className="w-full border-collapse border-2 border-black text-xs">
                    <thead className="bg-slate-200 print:bg-transparent font-bold text-black text-[10px] uppercase border-b-2 border-black">
                      <tr className="border-b border-black">
                        <th className="py-1 px-1.5 w-12 text-center border-r border-black">Tarefa</th>
                        <th className="py-1 px-2 border-r border-black">
                          Descrição (Centro de Custo - Operação)
                        </th>
                        <th className="py-1 px-2 w-32 border-r border-black">Centro de Custo</th>
                        <th className="py-1 px-1.5 w-16 text-right border-r border-black">Horas Est.</th>
                        <th className="py-1 px-2 w-28 text-center border-r border-black">Operador</th>
                        <th className="py-1 px-2 w-20 text-center border-r border-black">Data</th>
                        <th className="py-1 px-1.5 w-16 text-center border-r border-black">Horas Reais</th>
                        <th className="py-1 px-2 w-14 text-center">Visto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black text-black">
                      {item.operacoes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-4 text-center italic text-slate-500">
                            Nenhuma operação cadastrada no roteiro desta peça.
                          </td>
                        </tr>
                      ) : (
                        item.operacoes.map((op, opIdx) => {
                          const descricaoFormatada = `${op.centroCustoNome} - ${op.descricao}`;

                          return (
                            <React.Fragment key={op.id || opIdx}>
                              {/* Linha Principal da Tarefa */}
                              <tr className="task-row-group border-t border-black hover:bg-slate-50 print:hover:bg-transparent">
                                {/* Tarefa / Seq */}
                                <td className="py-1.5 px-1.5 text-center font-mono font-bold text-black border-r border-black align-top">
                                  {op.sequencia}
                                </td>

                                {/* Descrição no formato: <Centro de Custo> - <descrição da operação> */}
                                <td className="py-1.5 px-2 font-medium text-black border-r border-black align-top">
                                  <div className="font-bold text-[11px] leading-tight">
                                    {descricaoFormatada}
                                  </div>
                                </td>

                                {/* Centro de Custo */}
                                <td className="py-1.5 px-2 border-r border-black align-top font-semibold text-[11px]">
                                  {op.centroCustoNome}
                                </td>

                                {/* Horas Estimadas (ou Prazo em dias para terceirizados) */}
                                <td className="py-1.5 px-1.5 text-right font-mono font-bold border-r border-black align-top">
                                  {op.isTerceirizado
                                    ? `${op.prazo_dias ?? 5}d`
                                    : formatHours(op.horas_estimadas)}
                                </td>

                                {/* Operador: Terceiro ou Campo em branco para preenchimento manual */}
                                <td className="py-1.5 px-2 text-center border-r border-black align-top text-[10px]">
                                  {op.isTerceirizado ? (
                                    <span className="font-bold text-black uppercase">
                                      (Terceiro: {op.fornecedor || 'Especializado'})
                                    </span>
                                  ) : (
                                    /* Espaço em branco para assinatura/nome manual do operador */
                                    <span className="block border-b border-dotted border-black h-4 w-full" />
                                  )}
                                </td>

                                {/* Data: em branco para preenchimento manual */}
                                <td className="py-1.5 px-1 text-center font-mono text-[10px] border-r border-black align-top">
                                  <span className="block border-b border-dotted border-black h-4 w-full text-slate-400">
                                    &nbsp;
                                  </span>
                                </td>

                                {/* Horas Reais: traço para terceirizado, em branco para internas */}
                                <td className="py-1.5 px-1 text-center font-mono text-[10px] border-r border-black align-top">
                                  {op.isTerceirizado ? (
                                    <span>—</span>
                                  ) : (
                                    <span className="block border-b border-dotted border-black h-4 w-full" />
                                  )}
                                </td>

                                {/* Visto do Líder / Operador: em branco para visto manual */}
                                <td className="py-1.5 px-1 text-center font-mono text-[10px] align-top">
                                  <span className="block border-b border-dotted border-black h-4 w-full" />
                                </td>
                              </tr>

                              {/* Linha de Instruções de Execução da Operação (abaixo de cada tarefa, largura total) */}
                              {op.instrucoes && (
                                <tr className="task-row-group border-b border-black bg-slate-50/70 print:bg-transparent">
                                  <td
                                    colSpan={8}
                                    className="py-1.5 px-3 border-t border-dashed border-black align-top"
                                  >
                                    <div className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap select-text text-black">
                                      <span className="font-bold uppercase tracking-wider block text-[9px] text-slate-700 mb-0.5 print:text-black">
                                        Instruções de Execução (Plano de Fabricação):
                                      </span>
                                      {op.instrucoes}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* =========================================================================
                    4. RODAPÉ DA FOLHA: OBSERVAÇÕES, ASSINATURA DA CHEFIA E NUMERAÇÃO
                ========================================================================= */}
                <div className="border-2 border-black p-2 text-xs">
                  {/* Área para observações manuscritas de fábrica */}
                  <div className="min-h-[38px] border-b border-black pb-1 mb-2">
                    <span className="text-[9px] uppercase font-bold text-slate-700 block">
                      Observações Gerais do Processo / Ocorrências de Chão de Fábrica:
                    </span>
                    <div className="border-b border-dotted border-slate-400 h-4 mt-1" />
                  </div>

                  {/* Visto da Chefia e Numeração de Página */}
                  <div className="flex flex-wrap items-center justify-between text-[10px] pt-0.5">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="font-bold uppercase mr-1">Visto da Chefia / Qualidade:</span>
                        <span className="inline-block border-b border-black w-48 text-center font-mono">
                          &nbsp;
                        </span>
                      </div>
                      <div>
                        <span className="font-bold uppercase mr-1">Data:</span>
                        <span className="inline-block border-b border-black w-24 text-center font-mono">
                          &nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;
                        </span>
                      </div>
                    </div>

                    <div className="font-mono font-bold text-[10px]">
                      Página {itemIdx + 1} de {itensParaImprimir.length}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
};
