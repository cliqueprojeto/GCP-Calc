import { describe, expect, it } from 'vitest';
import { evaluateDocument, parseNumber } from '../src/engine/evaluate';
import { canonicalLine, regroupAtCaret } from '../src/lib/autoformat';
import { defaultContext, formatValue, type EvalContext } from '../src/engine/value';

const rates = { BRL: 5, EUR: 0.9, GBP: 0.8, JPY: 150, BTC: 0.00001 };

function run(text: string, o: Partial<EvalContext> = {}) {
  const ctx = defaultContext({ rates, now: new Date(2026, 10, 26, 10, 0).getTime(), ...o });
  const doc = evaluateDocument(text, ctx);
  return doc.lines.map((l) =>
    l.value ? formatValue(l.value, { decimal: ctx.decimal, grouping: true, precision: 4, lang: ctx.lang, currencyPosition: 'before', tags: ctx.tags }) : l.error ? `!${l.error}` : '',
  );
}
const one = (text: string, o: Partial<EvalContext> = {}) => run(text, o)[0];

describe('números e separadores', () => {
  it('vírgula decimal (pt)', () => {
    expect(parseNumber('1.234,56', 'comma')).toBe(1234.56);
    expect(parseNumber('1,5', 'comma')).toBe(1.5);
    expect(parseNumber('1.500', 'comma')).toBe(1500);
    expect(parseNumber('1.5', 'comma')).toBe(1.5);
    expect(parseNumber('1.000.000', 'comma')).toBe(1e6);
  });
  it('ponto decimal (en)', () => {
    expect(parseNumber('1,234.56', 'dot')).toBe(1234.56);
    expect(parseNumber('1,500', 'dot')).toBe(1500);
    expect(parseNumber('2.5', 'dot')).toBe(2.5);
  });
  it('aritmética básica', () => {
    expect(one('2 + 3 * 4')).toBe('14');
    expect(one('(2 + 3) * 4')).toBe('20');
    expect(one('2^10')).toBe('1.024');
    expect(one('10 / 4')).toBe('2,5');
    expect(one('5!')).toBe('120');
    expect(one('3x4')).toBe('12');
    expect(one('3 x 4')).toBe('12');
    expect(one('-5 + 2')).toBe('-3');
    expect(one('10 mod 3')).toBe('1');
    expect(one('2(3+4)')).toBe('14');
    expect(one('3k + 500')).toBe('3.500');
    expect(one('2 mil')).toBe('2.000');
    expect(one('1,5 milhão')).toBe('1.500.000');
  });
  it('palavras são ignoradas', () => {
    expect(one('Aluguel 1.500 + condomínio 450')).toBe('1.950');
    expect(one('Mercado: 320,50')).toBe('320,5');
    expect(one('3 vezes 4')).toBe('12');
    expect(one('10 dividido por 4')).toBe('2,5');
    expect(one('apenas texto')).toBe('');
  });
});

describe('porcentagens', () => {
  it('operações', () => {
    expect(one('20% de 300')).toBe('60');
    expect(one('20% of 300')).toBe('60');
    expect(one('300 + 10%')).toBe('330');
    expect(one('300 - 10%')).toBe('270');
    expect(one('50 em % de 200')).toBe('25%');
    expect(one('50 as % of 200')).toBe('25%');
    expect(one('20% off 50')).toBe('40');
    expect(one('15%')).toBe('15%');
    expect(one('R$ 100 com 10%')).toBe('R$ 110,00');
  });
});

describe('unidades', () => {
  it('conversões', () => {
    expect(one('5 km em m')).toBe('5.000 m');
    expect(one('10 km to miles')).toBe('6,2137 mi');
    expect(one('1 polegada em cm')).toBe('2,54 cm');
    expect(one('100 °C em fahrenheit')).toBe('212 °F');
    expect(one('32 °F para c')).toBe('0 °C');
    expect(one('2 h em min')).toBe('120 min');
    expect(one('1 GB em MB')).toBe('1.000 MB');
    expect(one('2 xícaras em ml')).toBe('480 ml');
    expect(one('3 colheres de sopa em ml')).toBe('45 ml');
    expect(one('60 km/h em m/s')).toBe('16,6667 m/s');
    expect(one('5 in to cm')).toBe('12,7 cm');
  });
  it('aritmética com unidades', () => {
    expect(one('1 km + 500 m')).toBe('1,5 km');
    expect(one('3 m * 4 m')).toBe('12 m²');
    expect(one('100 km / 2 h')).toBe('50 km/h');
    expect(one('5 ft 3 in em cm')).toBe('160,02 cm');
    expect(one('1 h 30 min em min')).toBe('90 min');
  });
});

describe('moedas', () => {
  it('conversão com cotações', () => {
    expect(one('100 usd em brl')).toBe('R$ 500,00');
    expect(one('US$ 100 em reais')).toBe('R$ 500,00');
    expect(one('R$ 500 em dólares')).toBe('US$ 100,00');
    expect(one('€ 90 em USD')).toBe('US$ 100,00');
    expect(one('R$ 100 + US$ 10')).toBe('R$ 150,00');
    expect(one('R$ 1.500 + 200')).toBe('R$ 1.700,00');
    expect(one('100 reais')).toBe('R$ 100,00');
  });
  it('sem cotação', () => {
    expect(one('100 usd em ars')).toMatch(/^!norate/);
  });
  it('tags personalizadas', () => {
    const tags = [
      { id: '1', name: 'milhas', rate: 0.02, of: 'BRL' },
      { id: '2', name: 'verdinha', alias: 'USD' },
    ];
    expect(one('10000 milhas em reais', { tags })).toBe('R$ 200,00');
    expect(one('#verdinha 10 em brl', { tags })).toBe('R$ 50,00');
  });
});

describe('documento', () => {
  it('variáveis, total e anterior', () => {
    const r = run(['salario = 5.000', 'aluguel = 1.500', 'salario - aluguel', '', '10', '20', 'total', 'média', 'prev * 2'].join('\n'));
    expect(r[0]).toBe('5.000');
    expect(r[2]).toBe('3.500');
    expect(r[6]).toBe('30');
    expect(r[7]).toBe('15');
    expect(r[8]).toBe('30');
  });
  it('variáveis com espaço', () => {
    const r = run(['valor da hora = R$ 80', 'valor da hora * 160'].join('\n'));
    expect(r[1]).toBe('R$ 12.800,00');
  });
  it('funções do usuário', () => {
    const r = run(['f(x) = x^2 + 1', 'f(3)'].join('\n'));
    expect(r[1]).toBe('10');
  });
  it('funções embutidas', () => {
    expect(one('sqrt(16)')).toBe('4');
    expect(one('raiz(81)')).toBe('9');
    expect(one('sin(30)')).toBe('0,5');
    expect(one('round(3,14159; 2)')).toBe('3,14');
    expect(one('max(3; 9; 4)')).toBe('9');
    expect(one('pmt(1%; 12; R$ 10.000)')).toBe('R$ 888,49');
  });
  it('datas', () => {
    expect(one('25/12/2026 - hoje')).toBe('29 d');
    expect(run('hoje + 1 semana')[0]).toMatch(/03/);
  });
  it('formatos', () => {
    expect(one('255 em hex')).toBe('0xFF');
    expect(one('10 in bin')).toBe('0b1010');
    expect(one('0xFF + 1')).toBe('0x100');
  });
  it('cabeçalhos e comentários', () => {
    const r = run(['# Viagem', 'hotel 300 // por noite', '// nota'].join('\n'));
    expect(r).toEqual(['', '300', '']);
  });
  it('idioma inglês com ponto decimal', () => {
    expect(one('1,500.50 + 0.5', { decimal: 'dot', lang: 'en' })).toBe('1,501');
    expect(one('$20 in eur', { decimal: 'dot', lang: 'en' })).toBe('€18.00');
  });
});

import { TEMPLATES } from '../src/notes/templates';
import { welcomeNotes } from '../src/notes/welcome';
import { WIZARDS } from '../src/ai/wizards';
import { newDocState, evaluateLine } from '../src/engine/evaluate';

describe('conteúdo embutido sem erros', () => {
  const langs = ['pt', 'en', 'es'] as const;
  const ctxFor = (l: 'pt' | 'en' | 'es') => defaultContext({ rates, lang: l, decimal: l === 'en' ? 'dot' : 'comma', dateOrder: l === 'en' ? 'mdy' : 'dmy' });
  const errorsIn = (text: string, l: 'pt' | 'en' | 'es') => {
    const st = newDocState();
    const ctx = ctxFor(l);
    return text
      .split('\n')
      .map((line) => ({ line, r: evaluateLine(line, ctx, st) }))
      .filter((x) => x.r.kind === 'error')
      .map((x) => `${x.line} → ${x.r.error}`);
  };
  for (const l of langs) {
    it(`modelos (${l})`, () => {
      for (const tpl of TEMPLATES) expect(errorsIn(tpl.text[l], l), tpl.id).toEqual([]);
    });
    it(`boas-vindas (${l})`, () => {
      const n = welcomeNotes(l)[0];
      const text = n.blocks.filter((b) => b.type === 'calc').map((b) => (b as { text: string }).text).join('\n');
      expect(errorsIn(text, l)).toEqual([]);
    });
    it(`assistentes offline (${l})`, () => {
      const answers: Record<string, Record<string, string>> = {
        compound: { pv: '10000', pmt: '500', rate: '1', n: '12' },
        loan: { pv: '50000', rate: '1', n: '24' },
        split: { bill: '240', tip: '10', people: '4' },
        discount: { price: '200', kind: '-', p: '15' },
        change: { a: '80', b: '100' },
        rule3: { a: '2', b: '10', c: '5', kind: 'd' },
        units: { dim: 'length', from: 'km', to: 'mile', n: '5' },
        currency: { n: '100', from: 'USD', to: 'BRL' },
        trip: { dist: '450', cons: '12', price: '6', round: '2' },
        budget: { income: '6000' },
        hourly: { goal: '8000', costs: '500', hours: '6', days: '20' },
      };
      for (const w of WIZARDS) {
        const lines = w.build(answers[w.id], { lang: l, cur: 'R$', dec: l === 'en' ? '.' : ',' });
        expect(errorsIn(lines.join('\n'), l), w.id).toEqual([]);
      }
    });
  }
});

import { isTransient } from '../src/ai/assist';

describe('IA: comando /ia e erros passageiros', () => {
  it('reconhece /ia como comando (sem resultado nem erro)', () => {
    const st = newDocState();
    const r = evaluateLine('/ia quanto investir por mês?', defaultContext({ rates }), st);
    expect(r.kind).toBe('command');
    expect(r.segments.map((s) => s.text).join('')).toBe('/ia quanto investir por mês?');
    expect(evaluateLine('  /AI how much?', defaultContext({ rates }), st).kind).toBe('command');
    expect(evaluateLine('10 / 2', defaultContext({ rates }), st).kind).toBe('value');
  });
  it('classifica sobrecarga do provedor como passageira', () => {
    expect(isTransient(new Error('503: This model is currently experiencing high demand. Spikes in demand are usually temporary.'))).toBe(true);
    expect(isTransient({ status: 529, message: 'overloaded' })).toBe(true);
    expect(isTransient(new Error('429: Too Many Requests'))).toBe(true);
    expect(isTransient(new Error('401: invalid x-api-key'))).toBe(false);
  });
});

describe('seções, moeda por contexto e formatação', () => {
  const example = [
    '#Receitas',
    'Bruno: R$ 4.000',
    'Flora: 2.000',
    'Total #Receitas: R$ 6.000,00',
    '#Despesas',
    'Verdemar: -R$ 100,00',
    'Unimed: - R$ 200,00',
    'Total #Receitas - #Despesas = R$ 5.700',
    'Sobra % = xxx %',
  ].join('\n');
  it('exemplo de receitas e despesas', () => {
    const r = run(example);
    expect(r[2]).toBe('R$ 2.000,00');
    expect(r[3]).toBe('R$ 6.000,00');
    expect(r[5]).toBe('-R$ 100,00');
    expect(r[6]).toBe('-R$ 200,00');
    expect(r[7]).toBe('R$ 5.700,00');
    expect(r[8]).toBe('95%');
  });
  it('receitas verdes, despesas vermelhas', () => {
    const doc = evaluateDocument(example, defaultContext({ rates }));
    expect(doc.lines[0].tone).toBe('income');
    expect(doc.lines[1].tone).toBe('income');
    expect(doc.lines[4].tone).toBe('expense');
    expect(doc.lines[6].tone).toBe('expense');
  });
  it('despesas positivas também são descontadas', () => {
    const r = run(['#Entradas', 'Salário: R$ 3.000', '#Gastos', 'Aluguel: 1.200', 'saldo = #Entradas - #Gastos', 'Total #Gastos'].join('\n'));
    expect(r[3]).toBe('R$ 1.200,00');
    expect(r[4]).toBe('R$ 1.800,00');
    expect(r[5]).toBe('R$ 1.200,00');
  });
  it('quantidades não viram moeda', () => {
    const r = run(['Hotel: R$ 300', 'pessoas: 2', 'dias: 4', 'Jantar: 150', 'total'].join('\n'));
    expect(r[1]).toBe('2');
    expect(r[2]).toBe('4');
    expect(r[3]).toBe('R$ 150,00');
    expect(r[4]).toBe('R$ 450,00');
  });
  it('título com tag de moeda não vira seção', () => {
    expect(run('#BRL 10')[0]).toBe('R$ 10,00');
  });
  it('separadores enquanto digita', () => {
    expect(regroupAtCaret('R$ 4000', 7, 'comma')).toEqual({ text: 'R$ 4.000', caret: 8 });
    expect(regroupAtCaret('R$ 4.0000', 9, 'comma')).toEqual({ text: 'R$ 40.000', caret: 9 });
    expect(regroupAtCaret('R$ 1234,5', 9, 'comma')).toEqual({ text: 'R$ 1.234,5', caret: 10 });
    expect(regroupAtCaret('$1234.5', 7, 'dot')).toEqual({ text: '$1,234.5', caret: 8 });
    expect(regroupAtCaret('R$ 400', 6, 'comma')).toBeNull();
    expect(regroupAtCaret('2026-11-26', 4, 'comma')).toBeNull();
  });
  it('forma canônica ao dar Enter', () => {
    const ctx = defaultContext({ rates });
    const fmt = { decimal: ctx.decimal, grouping: true, precision: 4, lang: ctx.lang, currencyPosition: 'before' as const, tags: [] };
    const lines = example.split('\n');
    const doc = evaluateDocument(example, ctx);
    const canon = lines.map((l, i) => canonicalLine(l, doc.lines[i], fmt) ?? l);
    expect(canon[1]).toBe('Bruno: R$ 4.000,00');
    expect(canon[2]).toBe('Flora: R$ 2.000,00');
    expect(canon[6]).toBe('Unimed: -R$ 200,00');
    expect(canon[7]).toBe('Total #Receitas - #Despesas = R$ 5.700,00');
    expect(canon[8]).toBe('Sobra % = 95%');
  });
});

describe('organizar', () => {
  it('separa receitas e despesas com totais e saldo', async () => {
    const { organizeText } = await import('../src/lib/organize');
    const ctx = defaultContext({ rates });
    const fmt = { decimal: ctx.decimal, grouping: true, precision: 4, lang: ctx.lang, currencyPosition: 'before' as const, tags: [] };
    const text = ['Salário: R$ 3.000', 'Aluguel: 1.200', 'Freela: 800', 'Mercado: -450', 'pessoas: 2', 'total'].join('\n');
    const org = organizeText(text, evaluateDocument(text, ctx).lines, fmt, 'pt');
    expect(org).toBe(
      ['pessoas: 2', '', '#Receitas', 'Salário: R$ 3.000,00', 'Freela: R$ 800,00', 'Total #Receitas', '', '#Despesas', 'Aluguel: R$ 1.200,00', 'Mercado: R$ 450,00', 'Total #Despesas', '', 'Saldo: #Receitas - #Despesas', 'Saldo %'].join('\n'),
    );
    const r = run(org);
    expect(r[5]).toBe('R$ 3.800,00');
    expect(r[10]).toBe('R$ 1.650,00');
    expect(r[12]).toBe('R$ 2.150,00');
    expect(r[13]).toBe('56,58%');
  });
  it('exemplo com #RECEITAS em maiúsculas', () => {
    const r = run(['#RECEITAS', 'Salário: R$ 3.000,00', '', '#Despesas', 'Médico: - R$ 2.000,00', '', '#RECEITAS - #Despesas = R$ 1.000,00', 'Sobra % = 66%'].join('\n'));
    expect(r[6]).toBe('R$ 1.000,00');
    expect(r[7]).toBe('33,33%');
  });
});

describe('relatório comparativo', () => {
  it('alinha seções e lançamentos entre notas e calcula a variação', async () => {
    const { compareRows, noteFigures, deltaTone } = await import('../src/lib/compare');
    const ctx = defaultContext({ rates });
    const fmt = { decimal: ctx.decimal, grouping: true, precision: 4, lang: ctx.lang, currencyPosition: 'before' as const, tags: [] };
    const note = (id: string, text: string) => ({ id, title: id, icon: 'Wallet', color: '#000', created: 0, updated: 0, blocks: [{ id: id + 'b', type: 'calc' as const, text }] });
    const a = note('out', '#Receitas\nSalário: R$ 3.000\n#Despesas\nMercado: -R$ 800');
    const b = note('nov', '#Receitas\nSalário: R$ 3.300\n#Despesas\nMercado: -R$ 950');
    const rows = compareRows([noteFigures(a, ctx, fmt), noteFigures(b, ctx, fmt)], ctx);
    const rec = rows.find((r) => r.key === 'receitas' && r.kind === 'section')!;
    expect(formatValue(rec.delta!, fmt)).toBe('R$ 300,00');
    expect(rec.pct).toBeCloseTo(0.1);
    expect(deltaTone(rec)).toBe('income');
    const merc = rows.find((r) => r.key === 'mercado')!;
    expect(deltaTone(merc)).toBe('expense');
  });
});

describe('despesas com e sem sinal', () => {
  it('soma pelo tamanho quando a seção mistura sinais', () => {
    const r = run(['#Receitas', 'Salário: R$ 1.000', '#Despesas', 'Mercado: R$ 300', 'Farmácia: -R$ 100', 'Luz: R$ 50', 'Total #Despesas', '#Receitas - #Despesas'].join('\n'));
    expect(r[6]).toBe('R$ 450,00');
    expect(r[7]).toBe('R$ 550,00');
  });
});

describe('vencimentos nas linhas', () => {
  it('entende "vence 10/12" e "vence dia 5" sem atrapalhar o valor', () => {
    const ctx = defaultContext({ rates, now: new Date(2026, 10, 26, 10, 0).getTime() });
    const doc = evaluateDocument(['Luz: R$ 150 vence 10/12', 'Aluguel: R$ 1.800 vence dia 5', 'Escola: 900 vencimento 05/01'].join('\n'), ctx);
    expect(formatValue(doc.lines[0].value!, { decimal: 'comma', grouping: true, precision: 2, lang: 'pt', currencyPosition: 'before', tags: [] })).toBe('R$ 150,00');
    expect(new Date(doc.lines[0].due!.at).toDateString()).toBe(new Date(2026, 11, 10).toDateString());
    expect(doc.lines[1].due!.monthly).toBe(true);
    expect(new Date(doc.lines[1].due!.at).toDateString()).toBe(new Date(2026, 11, 5).toDateString());
    expect(new Date(doc.lines[2].due!.at).getFullYear()).toBe(2027);
    const fmt = { decimal: ctx.decimal, grouping: true, precision: 4, lang: ctx.lang, currencyPosition: 'before' as const, tags: [] };
    expect(canonicalLine('Luz: R$ 150 vence 10/12', doc.lines[0], fmt)).toBe('Luz: R$ 150,00 vence 10/12');
  });
});

describe('ditado', () => {
  it('converte o que foi dito em linhas de cálculo', async () => {
    const { dictationToLines } = await import('../src/lib/dictation');
    const lines = dictationToLines('Comprei arroz por 27,90, feijão 8 reais e 49 centavos e paguei a luz 150. Gasolina 200 reais', 'pt', { decimal: 'comma', symbol: 'R$' });
    expect(lines).toEqual(['Arroz: R$ 27,90', 'Feijão: R$ 8,49', 'Luz: R$ 150', 'Gasolina: R$ 200']);
    expect(run(lines.join('\n'))).toEqual(['R$ 27,90', 'R$ 8,49', 'R$ 150,00', 'R$ 200,00']);
    expect(dictationToLines('2 pacotes de café 18,90', 'pt', { decimal: 'comma', symbol: 'R$' })).toEqual(['Café: 2 * R$ 18,90']);
  });
});

describe('seções sem rigidez', () => {
  it('variáveis com "=" contam na seção, nomes sem # e total da seção inteira', () => {
    const r = run(['#receitas', 'moeda = R$ 3,00', 'salário = R$ 1.000,00', 'verdemar= R$ 200,00', 'total #receitas', '', '#despesas', 'Arroz: R$ 3,00', '', 'Arroz: R$ 10,00', 'total', '', 'total #receitas - total #despesas', 'total: #receitas-#despesas', '= #receitas - #despesas', 'receitas - despesas', 'sobra = receitas - despesas', 'pessoas = 2', 'sobra / pessoas'].join('\n'));
    expect(r[4]).toBe('R$ 1.203,00');
    expect(r[10]).toBe('R$ 13,00');
    expect(r[12]).toBe('R$ 1.190,00');
    expect(r[13]).toBe('R$ 1.190,00');
    expect(r[14]).toBe('R$ 1.190,00');
    expect(r[15]).toBe('R$ 1.190,00');
    expect(r[16]).toBe('R$ 1.190,00');
    expect(r[18]).toBe('R$ 595,00');
  });
  it('percentuais e quantidades não entram no total da seção', () => {
    const r = run(['#Viagem', 'Hotel: R$ 900', 'dias = 3', 'taxa = 10%', 'Passeio: R$ 300', 'total'].join('\n'));
    expect(r[5]).toBe('R$ 1.200,00');
  });
});

describe('emojis nas linhas', () => {
  it('enfeitam sem quebrar a conta', () => {
    const r = run(['# 💰 Receitas', '💼 Salário: R$ 3.000', '🎁 bonus = R$ 500', '#🛒Mercado', '🍚 Arroz: R$ 30', '☕ Café: 18', 'total', '', '✅ Saldo: Receitas - Mercado', 'Salário + bonus', '⭐ Arroz * 2'].join('\n'));
    expect(r[1]).toBe('R$ 3.000,00');
    expect(r[2]).toBe('R$ 500,00');
    expect(r[5]).toBe('R$ 18,00');
    expect(r[6]).toBe('R$ 48,00');
    expect(r[8]).toBe('R$ 3.452,00');
    expect(r[9]).toBe('R$ 3.500,00');
    expect(r[10]).toBe('R$ 60,00');
  });
});

describe('números por extenso no ditado', () => {
  it('converte valores falados', async () => {
    const { dictationToLines, wordsToNumbers } = await import('../src/lib/dictation');
    expect(wordsToNumbers('vinte e sete reais e noventa centavos')).toBe('27 reais e 90 centavos');
    expect(wordsToNumbers('mil e duzentos')).toBe('1200');
    expect(wordsToNumbers('cento e cinquenta')).toBe('150');
    expect(wordsToNumbers('twenty-seven dollars')).toBe('27 dollars');
    expect(dictationToLines('Comprei arroz por vinte e sete reais e noventa centavos, café dezoito reais e paguei a luz de cento e cinquenta reais', 'pt', { decimal: 'comma', symbol: 'R$' })).toEqual(['Arroz: R$ 27,90', 'Café: R$ 18', 'Luz: R$ 150']);
  });
});

describe('vocabulário de receitas e despesas', () => {
  it('reconhece sinônimos, plural e verbos', async () => {
    const { classifyTerm } = await import('../src/engine/vocab');
    for (const w of ['Receitas', 'receita', 'Ganhos', 'Recebimentos', 'Vendas', 'Lucro', 'Prestação de serviços', 'Faturamento', 'Salário', 'Honorários', 'Entradas', 'recebi do cliente', 'Income', 'Revenue', 'Sales', 'Ingresos', 'Ventas', 'Cachê', 'Aluguel recebido'])
      expect([w, classifyTerm(w)]).toEqual([w, 'income']);
    for (const w of ['Despesas', 'despesa', 'Compras', 'Gastos', 'Dispêndios', 'Débitos', 'Pagamentos', 'Saídas', 'Custos', 'Contas', 'Boletos', 'paguei a luz', 'comprei pão', 'Cartão de crédito', 'Expenses', 'Bills', 'Gastos fijos', 'Egresos', 'Mercado'])
      expect([w, classifyTerm(w)]).toEqual([w, 'expense']);
    expect(classifyTerm('Tipo de material')).toBeUndefined();
    expect(classifyTerm('Viagem')).toBeUndefined();
  });
  it('colore as seções com os sinônimos', () => {
    const doc = evaluateDocument(['#Ganhos', 'Freela: R$ 800', '#Compras', 'Pão: R$ 12'].join('\n'), defaultContext({ rates }));
    expect(doc.lines[0].tone).toBe('income');
    expect(doc.lines[2].tone).toBe('expense');
  });
});

describe('inserção nas seções existentes', () => {
  it('ditado vai para a última linha da seção certa, antes do total', async () => {
    const { insertIntoSections } = await import('../src/lib/smartInsert');
    const { dictationItems } = await import('../src/lib/dictation');
    const text = ['#Receitas', 'Salário: R$ 3.000', 'total', '', '#Despesas', 'Aluguel: R$ 1.200', 'Luz: R$ 150', 'Total #Despesas', '', 'Saldo: receitas - despesas'].join('\n');
    const ctx = defaultContext({ rates });
    const items = dictationItems('Comprei pão por 12,50 e paguei a internet 99,90. Recebi 800 de um freela', 'pt', { decimal: 'comma', symbol: 'R$' });
    const r = insertIntoSections(text, evaluateDocument(text, ctx).lines, items);
    expect(r.text.split('\n')).toEqual(['#Receitas', 'Salário: R$ 3.000', 'Freela: R$ 800', 'total', '', '#Despesas', 'Aluguel: R$ 1.200', 'Luz: R$ 150', 'Pão: R$ 12,50', 'Internet: R$ 99,90', 'Total #Despesas', '', 'Saldo: receitas - despesas']);
    const vals = run(r.text);
    expect(vals[3]).toBe('R$ 3.800,00');
    expect(vals[10]).toBe('R$ 1.462,40');
    expect(vals[12]).toBe('R$ 2.337,60');
  });
  it('linhas da IA com títulos e totais não duplicam a seção', async () => {
    const { insertIntoSections } = await import('../src/lib/smartInsert');
    const text = ['#Gastos', 'Mercado: R$ 300', 'total'].join('\n');
    const r = insertIntoSections(text, evaluateDocument(text, defaultContext({ rates })).lines, ['#Despesas', 'Farmácia: R$ 45', 'Total #Despesas'].map((line) => ({ line })));
    expect(r.text.split('\n')).toEqual(['#Gastos', 'Mercado: R$ 300', 'Farmácia: R$ 45', 'total']);
  });
});

describe('fórmulas faladas', () => {
  const known = { sections: [{ name: 'Ganhos', tone: 'income' as const }, { name: 'Gastos', tone: 'expense' as const }], vars: ['aluguel', 'saldo', 'valor da hora'] };
  it('entende o pedido e escreve a fórmula com as seções da nota', async () => {
    const { buildFormula } = await import('../src/lib/voiceFormulas');
    const f = (s: string) => buildFormula(s, known, 'pt');
    expect(f('Faça agora o total de receitas menos despesas')).toBe('Saldo: #Ganhos - #Gastos');
    expect(f('quanto sobrou')).toBe('Saldo: #Ganhos - #Gastos');
    expect(f('total das despesas')).toBe('Total #Gastos');
    expect(f('média dos gastos')).toBe('Média: média #Gastos');
    expect(f('qual o maior gasto')).toBe('Maior: maior #Gastos');
    expect(f('dez por cento das receitas')).toBe('Resultado: 10% de #Ganhos');
    expect(f('aluguel vezes doze')).toBe('Resultado: aluguel * 12');
    expect(f('divida o saldo por 2')).toBe('Resultado: saldo / 2');
    expect(f('quanto sobra em porcentagem')).toBe('Sobra em %: (#Ganhos - #Gastos) em % de #Ganhos');
    expect(f('valor da hora vezes 40')).toBe('Resultado: valor da hora * 40');
    expect(f('comprei pão por 12')).toBeNull();
  });
  it('as fórmulas calculam na nota', async () => {
    const { buildFormula } = await import('../src/lib/voiceFormulas');
    const base = ['#Ganhos', 'Salário: R$ 3.000', '#Gastos', 'Aluguel: R$ 1.200', 'Mercado: R$ 300'];
    const lines = ['Faça agora o total de receitas menos despesas', 'média dos gastos', 'quanto sobra em porcentagem', 'dez por cento das receitas'].map((s) => buildFormula(s, known, 'pt')!);
    const r = run([...base, ...lines].join('\n'));
    expect(r.slice(5)).toEqual(['R$ 1.500,00', 'R$ 750,00', '50%', 'R$ 300,00']);
  });
});

describe('totais e saldo em vários formatos', () => {
  const base = ['#Receitas', 'incentivo de 100 mil reais', 'doação de 10 mil reais', '', '#Despesas', 'Coordenador de 10 mil reais vezes 6 meses', 'Produtor de 3 mil reais em 4 meses', ''];
  it('todas as formas de receitas menos despesas', () => {
    const forms = ['#Total (#Receitas - #Despesas)', '#Total #Receitas - #Despesas', '#Receitas - # Despesas', '#Receitas-#Despesas', '#TOTAL', 'Saldo', 'Total: #Receitas - #Despesas', 'Total #Receitas - Total #Despesas', 'receitas - despesas'];
    const r = run([...base, ...forms].join('\n'));
    expect(r[5]).toBe('R$ 60.000,00');
    expect(r[6]).toBe('R$ 12.000,00');
    for (let i = 0; i < forms.length; i++) expect([forms[i], r[base.length + i]]).toEqual([forms[i], 'R$ 38.000,00']);
  });
  it('% executado e % a executar', () => {
    const r = run([...base, '% Executado', '% A executar'].join('\n'));
    expect(r[base.length]).toBe('65,45%');
    expect(r[base.length + 1]).toBe('34,55%');
  });
  it('rótulos implícitos e lançamentos com #, contas à parte não mexem na seção', () => {
    const r = run([...base, 'Incentivo - Coordenador', '#Incentivo - #Coordenador', 'produtor * 2', 'Subtotal #Despesas', 'Total #Receitas'].join('\n'));
    expect(r.slice(base.length)).toEqual(['R$ 40.000,00', 'R$ 40.000,00', 'R$ 24.000,00', 'R$ 72.000,00', 'R$ 110.000,00']);
  });
});

describe('ditado com multiplicação', () => {
  it('"em 10 meses", "por 3 vezes" viram multiplicação', async () => {
    const { dictationItems } = await import('../src/lib/dictation');
    const items = dictationItems('Paguei um Produtor o valor de 10 mil reais em 10 meses. Recebi um incentivo de 100 mil reais. Coordenador 2 mil reais por 6 meses', 'pt', { decimal: 'comma', symbol: 'R$' });
    expect(items.map((x) => x.line)).toEqual(['Produtor: R$ 10.000 * 10 meses', 'Incentivo: R$ 100.000', 'Coordenador: R$ 2.000 * 6 meses']);
    expect(items.map((x) => x.tone)).toEqual(['expense', 'income', 'expense']);
    expect(run(items.map((x) => x.line).join('\n'))).toEqual(['R$ 100.000,00', 'R$ 100.000,00', 'R$ 12.000,00']);
  });
});

describe('previsto × realizado', () => {
  const doc = [
    '# Receitas',
    'Patrocínio: R$ 50.000 | R$ 50.000',
    'Bilheteria: previsto R$ 10.000 realizado R$ 6.000',
    '',
    '# Despesas',
    '## Equipe',
    'Coordenação: R$ 20.000 | R$ 20.000',
    'Produção: R$ 12.000 | R$ 13.500',
    '## Divulgação',
    'Impressos: R$ 3.000 | R$ 1.500',
    '',
    'Previsto #Equipe',
    'Realizado #Equipe',
    'Saldo a executar #Equipe',
    '% Executado #Equipe',
    'Previsto despesas',
    'Realizado despesas',
    '% Executado',
    '% A executar',
    'Saldo',
  ].join('\n');
  it('linhas mostram o realizado e guardam o previsto', () => {
    const ctx = defaultContext({ rates, now: 0 });
    const d = evaluateDocument(doc, ctx);
    expect(d.lines[1].planned?.n).toBe(50000);
    expect(d.lines[2].planned?.n).toBe(10000);
    expect(d.lines[2].value?.n).toBe(6000);
    expect(d.lines[7].planned?.n).toBe(12000);
    expect(run(doc + '\nTotal #Despesas\nTotal #Equipe').slice(-2)).toEqual(['R$ 35.000,00', 'R$ 33.500,00']);
  });
  it('agregados por seção e por tipo', () => {
    const r = run(doc);
    expect(r.slice(11)).toEqual(['R$ 32.000,00', 'R$ 33.500,00', '-R$ 1.500,00', '104,69%', 'R$ 35.000,00', 'R$ 35.000,00', '100%', '0%', 'R$ 21.000,00']);
  });
});

describe('modelo previsto × realizado', () => {
  it('calcula sem erros nas três línguas', async () => {
    const { TEMPLATES } = await import('../src/notes/templates');
    const tpl = TEMPLATES.find((x) => x.id === 'pvr')!;
    for (const lang of ['pt', 'en', 'es'] as const) {
      const o = lang === 'pt' ? {} : { lang, decimal: lang === 'en' ? ('dot' as const) : ('comma' as const) };
      const r = run(tpl.text[lang], o);
      expect(r.filter((x) => x.startsWith('!'))).toEqual([]);
      expect(r.slice(-6)).toEqual(
        lang === 'en'
          ? ['$195,600.00', '$180,200.00', '$15,400.00', '92.13%', '7.87%', '$44,640.00']
          : lang === 'es'
            ? ['€ 195.600,00', '€ 180.200,00', '€ 15.400,00', '92,13%', '7,87%', '€ 44.640,00']
            : ['R$ 195.600,00', 'R$ 180.200,00', 'R$ 15.400,00', '92,13%', '7,87%', 'R$ 44.640,00'],
      );
    }
  });
});

describe('emojis inteiros no destaque', () => {
  it('nenhum pedaço corta um emoji (bandeiras, famílias, variações)', () => {
    const lines = ['🛒 arroz 27,90 + 🍞 8', '🇧🇷 Viagem: R$ 900', '👨‍👩‍👧 Família: R$ 50', '❤️ 10 + 5 ✅', '# 🏷️ Etiquetas', '1️⃣ Primeiro: R$ 3', '👍🏽 ok 2 * 3'];
    const ctx = defaultContext({ rates, now: 0 });
    const d = evaluateDocument(lines.join('\n'), ctx);
    d.lines.forEach((l, i) => {
      expect(l.segments.map((s) => s.text).join('')).toBe(lines[i]);
      for (const s of l.segments) expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s.text)).toBe(false);
      // fronteiras entre pedaços caem sempre entre grafemas
      const bounds = new Set([...new (Intl as unknown as { Segmenter: new (l: string, o: object) => { segment(s: string): Iterable<{ index: number }> } }).Segmenter('pt', { granularity: 'grapheme' }).segment(lines[i])].map((g) => g.index));
      let at = 0;
      for (const s of l.segments) {
        expect(bounds.has(at) || at === lines[i].length, `${lines[i]} @${at}`).toBe(true);
        at += s.text.length;
      }
    });
    expect(d.lines[1].label).toBe('Viagem');
    expect(d.lines[2].label).toBe('Família');
  });
});

describe('ditado sem duplicar', () => {
  it('a IA devolve a nota inteira: só o item novo entra, uma vez', async () => {
    const { insertIntoSections } = await import('../src/lib/smartInsert');
    const ctx = defaultContext({ rates, now: 0 });
    let text = '#Despesas\nArroz: R$ 27,90\nCafé: R$ 18,00\nTotal #Despesas';
    const ai = ['#Despesas', 'Arroz: R$ 27,90', 'Café: R$ 18', 'Pão: R$ 8,00', 'Total #Despesas'].map((line) => ({ line }));
    const r1 = insertIntoSections(text, evaluateDocument(text, ctx).lines, ai);
    expect(r1.text).toBe('#Despesas\nArroz: R$ 27,90\nCafé: R$ 18,00\nPão: R$ 8,00\nTotal #Despesas');
    expect(r1.skipped).toBe(2);
    text = r1.text;
    const r2 = insertIntoSections(text, evaluateDocument(text, ctx).lines, [...ai, { line: '🥛 Leite: R$ 6' }]);
    expect(r2.text).toBe('#Despesas\nArroz: R$ 27,90\nCafé: R$ 18,00\nPão: R$ 8,00\n🥛 Leite: R$ 6\nTotal #Despesas');
  });
});

describe('subtotal por grupo e atalhos de totais', () => {
  it('subtotal soma só o grupo; total a pagar/receber; lucro', () => {
    const t = '#Receitas\nSalário: R$ 3.000\nFreela: R$ 500\nSubtotal\n#Despesas\nAluguel: R$ 1.000\nLuz: R$ 100\nSubtotal\nMercado: R$ 500\nSubtotal\nTotal #Despesas\nSubtotal #Despesas\nTotal a pagar\nTotal a receber\nLucro\nPrejuízo';
    const r = run(t);
    expect([r[3], r[7], r[9], r[10], r[11], r[12], r[13], r[14], r[15]]).toEqual(['R$ 3.500,00', 'R$ 1.100,00', 'R$ 500,00', 'R$ 1.600,00', 'R$ 1.600,00', 'R$ 1.600,00', 'R$ 3.500,00', 'R$ 1.900,00', 'R$ 1.900,00']);
  });
});

describe('números por extenso e operações em linguagem natural', () => {
  const v = (l: string, o: Partial<EvalContext> = {}) => evaluateDocument(l, defaultContext({ rates, now: 0, ...o })).lines[0];
  it('português: as quatro operações, misturando números e palavras', () => {
    const cases: [string, number][] = [
      ['Seis dividido por 2', 3], ['seis dividido por dois', 3], ['6 dividido por dois', 3], ['doze dividido em 3', 4],
      ['vinte e sete mais 3', 30], ['10 mais cinco', 15], ['um mais um', 2], ['dois mil e trezentos mais 200', 2500],
      ['cem menos 1', 99], ['vinte menos três', 17], ['três vezes 4', 12], ['3 vezes quatro', 12],
      ['dez multiplicado por 2,5', 25], ['cento e vinte vezes dois', 240], ['mil e quinhentos dividido por 3', 500],
      ['quinze sobre 3', 5], ['quatro elevado a dois', 16], ['vinte por cento de 300', 60], ['20% sobre 300', 60],
      ['dois terços de 90', 60], ['2/3 de 90', 60], ['metade de 90', 45], ['meio', 0.5],
    ];
    for (const [l, n] of cases) {
      const r = v(l);
      expect(r.value?.n, l).toBeCloseTo(n);
      expect(r.label, l).toBeUndefined();
    }
  });
  it('não confunde artigo nem rótulo', () => {
    expect(v('Paguei um café de 5').label).toBe('Paguei um café');
    expect(v('Seis: 6').label).toBe('Seis');
    expect(one('10 mil reais')).toBe('R$ 10.000,00');
    expect(one('R$ 100 dividido por quatro')).toBe('R$ 25,00');
  });
  it('inglês e espanhol', () => {
    expect(v('six divided by two', { lang: 'en', decimal: 'dot' }).value?.n).toBe(3);
    expect(v('one hundred and five minus 5', { lang: 'en', decimal: 'dot' }).value?.n).toBe(100);
    expect(v('twenty percent of 300', { lang: 'en', decimal: 'dot' }).value?.n).toBe(60);
    expect(v('seis dividido por dos', { lang: 'es' }).value?.n).toBe(3);
    expect(v('veintitrés menos tres', { lang: 'es' }).value?.n).toBe(20);
    expect(v('cien por ciento de 40', { lang: 'es' }).value?.n).toBe(40);
  });
});

describe('ditado num bloco sem seções', () => {
  it('cria #Receitas/#Despesas com os itens e o total', async () => {
    const { insertIntoSections } = await import('../src/lib/smartInsert');
    const { dictationItems } = await import('../src/lib/dictation');
    const ctx = defaultContext({ rates, now: 0 });
    const items = dictationItems('recebi o salário de 3000 reais, comprei arroz por 27,90 e paguei a luz 150', 'pt', { decimal: 'comma', symbol: 'R$' });
    const r = insertIntoSections('', [], items);
    expect(r.text.split('\n')).toEqual(['#Receitas', 'Salário: R$ 3.000', 'Total #Receitas', '', '#Despesas', 'Arroz: R$ 27,90', 'Luz: R$ 150', 'Total #Despesas']);
    const res = run(r.text);
    expect(res[2]).toBe('R$ 3.000,00');
    expect(res[7]).toBe('R$ 177,90');
    // com nomes que a nota já usa
    const r2 = insertIntoSections('Anotações do mês', evaluateDocument('Anotações do mês', ctx).lines, items, { income: 'Ganhos', expense: 'Gastos' });
    expect(r2.text).toContain('#Gastos\nArroz: R$ 27,90\nLuz: R$ 150\nTotal #Gastos');
    // seção que já existe recebe os itens (sem criar outra)
    const base = '#Despesas\nAluguel: R$ 1.000\nTotal #Despesas';
    const r3 = insertIntoSections(base, evaluateDocument(base, ctx).lines, items);
    expect(r3.text.match(/#Despesas/g)?.length).toBe(2);
    expect(r3.text).toContain('Aluguel: R$ 1.000\nArroz: R$ 27,90\nLuz: R$ 150\nTotal #Despesas');
    expect(r3.text).toContain('#Receitas\nSalário: R$ 3.000\nTotal #Receitas');
  });
});
