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
