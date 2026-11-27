import { describe, expect, it } from 'vitest';
import { cellNumber, gridToText, parseCsv, parseText, pdfRows } from '../src/lib/importer';

const o = { symbol: 'R$', decimal: 'comma' as const, lang: 'pt' as const };

describe('importar planilhas e documentos', () => {
  it('lê números em vários formatos', () => {
    expect(cellNumber('R$ 1.234,56')).toBe(1234.56);
    expect(cellNumber('1,234.56', 'dot')).toBe(1234.56);
    expect(cellNumber('2000')).toBe(2000);
    expect(cellNumber('1.500')).toBe(1500);
    expect(cellNumber('Coordenação')).toBeUndefined();
  });
  it('planilha com etapas, cabeçalho, itens e totais', () => {
    const csv = [
      'PLANILHA ORÇAMENTÁRIA;;;;;;',
      'PRÉ-PRODUÇÃO;PRÉ-PRODUÇÃO;PRÉ-PRODUÇÃO;PRÉ-PRODUÇÃO;PRÉ-PRODUÇÃO;PRÉ-PRODUÇÃO;PRÉ-PRODUÇÃO',
      'ORDEM;DESPESA;DETALHAMENTO;UNIDADE;QTDE.;VALOR UNITÁRIO;VALOR TOTAL',
      '1;Coordenação (geral);Planejamento;mês;6;1500;9000',
      '2;Pesquisa/roteiro;Texto;Serviço;1;2500;2500',
      'TOTAL PRÉ-PRODUÇÃO;;;;;;11500',
      'DIVULGAÇÃO;DIVULGAÇÃO;DIVULGAÇÃO;DIVULGAÇÃO;DIVULGAÇÃO;DIVULGAÇÃO;DIVULGAÇÃO',
      'ORDEM;DESPESA;DETALHAMENTO;UNIDADE;QTDE.;VALOR UNITÁRIO;VALOR TOTAL',
      '3;Cartazes;Impressos;unidade;200;3,50;700',
      'TOTAL DIVULGAÇÃO;;;;;;700',
      'RESUMO FINANCEIRO;;;;;;',
      'A - Valor total;;;;;;12200',
    ].join('\n');
    const r = gridToText(parseCsv(csv), o);
    expect(r.text.split('\n')).toEqual([
      '# Despesas',
      '## Pré-produção',
      'Coordenação: R$ 1.500 * 6 meses',
      'Pesquisa e roteiro: R$ 2.500',
      '## Divulgação',
      'Cartazes: 200 * R$ 3,50',
      '',
      'Total #Despesas',
    ]);
    expect(r.total).toBe(12200);
  });
  it('previsto e realizado viram "previsto | realizado"', () => {
    const md = ['## Receitas', '| Fonte | Meta | Realizado |', '|---|---|---|', '| Patrocínio | R$ 10.000,00 | R$ 8.000,00 |', '', '## Equipe', '| Rubrica | Meta | Realizado |', '|---|---|---|', '| Cachê | R$ 3.000,00 | R$ 3.200,00 |'].join('\n');
    const r = gridToText(parseText(md), o);
    expect(r.planned).toBe(true);
    expect(r.text).toContain('Patrocínio: R$ 10.000 | R$ 8.000');
    expect(r.text).toContain('Cachê: R$ 3.000 | R$ 3.200');
    expect(r.text).toContain('% Executado');
  });
  it('PDF: junta pedaços em células, linhas quebradas e grupos', () => {
    const it = (s: string, x: number, y: number) => ({ s, x, y, w: s.length * 5, h: 10 });
    const grid = pdfRows([
      it('Grupo 1 - Comunicação | R$ 900,00', 40, 700),
      it('Item', 40, 680), it('Despesa', 80, 680), it('Qtd.', 300, 680), it('Unit.', 360, 680), it('Total', 440, 680),
      it('1.1', 40, 660), it('Produção de conteúdo digital,', 80, 660), it('1', 300, 660), it('R$ 500,00', 360, 660), it('R$ 500,00', 440, 660),
      it('multimídia e audiovisual', 80, 648),
      it('1.2', 40, 630), it('Design', 80, 630), it('2', 300, 630), it('R$ 200,00', 360, 630), it('R$ 400,00', 440, 630),
    ]);
    const r = gridToText(grid, o);
    expect(r.text.split('\n')).toEqual(['# Despesas', '## Comunicação', 'Produção de conteúdo digital, multimídia e audiovisual: R$ 500', 'Design: 2 * R$ 200', '', 'Total #Despesas']);
  });
});
