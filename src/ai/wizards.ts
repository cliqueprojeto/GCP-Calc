/**
 * Assistentes guiados que funcionam sem IA (offline): perguntas em sequência
 * que terminam em linhas de cálculo prontas para a nota.
 */
import { UNITS, DIMS, type Dim } from '../engine/units';
import type { Lang } from '../lib/types';

type L = Record<Lang, string>;

export interface WizardStep {
  id: string;
  q: L;
  input: 'number' | 'choice' | 'text';
  options?: (ans: Record<string, string>, lang: Lang) => { value: string; label: string }[];
  placeholder?: L;
  /** valor sugerido (já formatado no idioma) */
  def?: (dec: string) => string;
}

export interface Wizard {
  id: string;
  icon: string;
  title: L;
  /** o que o assistente calcula, em uma linha */
  desc: L;
  steps: WizardStep[];
  build(a: Record<string, string>, o: { lang: Lang; cur: string; dec: string }): string[];
}

const L = (pt: string, en: string, es: string): L => ({ pt, en, es });

/** Nome da variável no idioma escolhido. */
const v = (lang: Lang, pt: string, en: string, es: string) => ({ pt, en, es })[lang];
const pct = (s: string) => (s.trim().endsWith('%') ? s.trim() : s.trim() + '%');
const money = (s: string, cur: string) => (/^[\d.,\s]+$/.test(s.trim()) ? `${cur} ${s.trim()}` : s.trim());
const conv = (lang: Lang) => v(lang, 'em', 'in', 'en');

export const DIM_LABEL: Record<Dim, L> = {
  length: L('Comprimento', 'Length', 'Longitud'),
  mass: L('Massa / peso', 'Mass / weight', 'Masa / peso'),
  area: L('Área', 'Area', 'Área'),
  volume: L('Volume', 'Volume', 'Volumen'),
  time: L('Tempo', 'Time', 'Tiempo'),
  temp: L('Temperatura', 'Temperature', 'Temperatura'),
  data: L('Dados digitais', 'Digital data', 'Datos digitales'),
  datarate: L('Velocidade de internet', 'Internet speed', 'Velocidad de internet'),
  speed: L('Velocidade', 'Speed', 'Velocidad'),
  energy: L('Energia', 'Energy', 'Energía'),
  power: L('Potência', 'Power', 'Potencia'),
  pressure: L('Pressão', 'Pressure', 'Presión'),
  angle: L('Ângulo', 'Angle', 'Ángulo'),
  frequency: L('Frequência', 'Frequency', 'Frecuencia'),
  money: L('Moeda', 'Currency', 'Moneda'),
};

const unitOptions = (dim: string) =>
  UNITS.filter((u) => u.dim === dim).map((u) => ({ value: u.names.find((n) => !/\s/.test(n) && n.length > 1) ?? u.names[0], label: `${u.symbol} · ${u.names.find((n) => n.length > 3) ?? u.names[0]}` }));

export const WIZARDS: Wizard[] = [
  {
    id: 'compound',
    icon: 'TrendingUp',
    title: L('Juros compostos', 'Compound interest', 'Interés compuesto'),
    desc: L('Quanto rende um investimento com aportes mensais', 'How much an investment with monthly deposits yields', 'Cuánto rinde una inversión con aportes mensuales'),
    steps: [
      { id: 'pv', q: L('Quanto você vai investir?', 'How much will you invest?', '¿Cuánto vas a invertir?'), input: 'number', placeholder: L('10.000', '10,000', '10.000') },
      { id: 'pmt', q: L('Aporte mensal (0 se não houver)', 'Monthly contribution (0 if none)', 'Aporte mensual (0 si no hay)'), input: 'number', def: () => '0' },
      { id: 'rate', q: L('Taxa de juros ao mês (%)', 'Monthly interest rate (%)', 'Tasa de interés mensual (%)'), input: 'number', placeholder: L('1', '1', '1') },
      {
        id: 'n',
        q: L('Por quanto tempo?', 'For how long?', '¿Por cuánto tiempo?'),
        input: 'choice',
        options: (_a, lang) =>
          ['6', '12', '24', '36', '60', '120'].map((m) => ({ value: m, label: `${m} ${v(lang, 'meses', 'months', 'meses')}` })),
      },
    ],
    build: (a, { lang, cur }) => [
      `# ${v(lang, 'Juros compostos', 'Compound interest', 'Interés compuesto')}`,
      `${v(lang, 'capital', 'principal', 'capital')} = ${money(a.pv, cur)}`,
      `${v(lang, 'aporte', 'contribution', 'aporte')} = ${money(a.pmt || '0', cur)}`,
      `${v(lang, 'taxa', 'rate', 'tasa')} = ${pct(a.rate)}`,
      `${v(lang, 'meses', 'months', 'meses')} = ${a.n}`,
      `${v(lang, 'montante', 'final amount', 'monto final')} = fv(${v(lang, 'taxa', 'rate', 'tasa')}; ${v(lang, 'meses', 'months', 'meses')}; ${v(lang, 'aporte', 'contribution', 'aporte')}; ${v(lang, 'capital', 'principal', 'capital')})`,
      `${v(lang, 'investido', 'invested', 'invertido')} = ${v(lang, 'capital', 'principal', 'capital')} + ${v(lang, 'aporte', 'contribution', 'aporte')} * ${v(lang, 'meses', 'months', 'meses')}`,
      `${v(lang, 'rendimento', 'earnings', 'rendimiento')} = ${v(lang, 'montante', 'final amount', 'monto final')} - ${v(lang, 'investido', 'invested', 'invertido')}`,
    ],
  },
  {
    id: 'loan',
    icon: 'Landmark',
    title: L('Financiamento (parcelas fixas)', 'Loan (fixed installments)', 'Préstamo (cuotas fijas)'),
    desc: L('Valor da parcela, total pago e juros (Tabela Price)', 'Installment, total paid and interest (fixed payments)', 'Cuota, total pagado e intereses (cuota fija)'),
    steps: [
      { id: 'pv', q: L('Valor financiado', 'Amount financed', 'Monto financiado'), input: 'number', placeholder: L('50.000', '50,000', '50.000') },
      { id: 'rate', q: L('Juros ao mês (%)', 'Monthly interest (%)', 'Interés mensual (%)'), input: 'number', placeholder: L('1,49', '1.49', '1,49') },
      {
        id: 'n',
        q: L('Quantas parcelas?', 'How many installments?', '¿Cuántas cuotas?'),
        input: 'choice',
        options: () => ['12', '24', '36', '48', '60', '72', '120', '360'].map((m) => ({ value: m, label: m + 'x' })),
      },
    ],
    build: (a, { lang, cur }) => {
      const P = v(lang, 'parcela', 'installment', 'cuota');
      const V = v(lang, 'valor', 'amount', 'monto');
      const T = v(lang, 'taxa', 'rate', 'tasa');
      const N = v(lang, 'parcelas', 'installments', 'cuotas');
      return [
        `# ${v(lang, 'Financiamento', 'Loan', 'Préstamo')} (Price)`,
        `${V} = ${money(a.pv, cur)}`,
        `${T} = ${pct(a.rate)}`,
        `${N} = ${a.n}`,
        `${P} = pmt(${T}; ${N}; ${V})`,
        `${v(lang, 'total pago', 'total paid', 'total pagado')} = ${P} * ${N}`,
        `${v(lang, 'juros pagos', 'interest paid', 'intereses pagados')} = ${v(lang, 'total pago', 'total paid', 'total pagado')} - ${V}`,
        `${v(lang, 'juros pagos', 'interest paid', 'intereses pagados')} ${conv(lang)} % ${v(lang, 'de', 'of', 'de')} ${V}`,
      ];
    },
  },
  {
    id: 'split',
    icon: 'Users',
    title: L('Dividir a conta', 'Split the bill', 'Dividir la cuenta'),
    desc: L('Conta com gorjeta dividida entre pessoas', 'Bill with tip split among people', 'Cuenta con propina dividida entre personas'),
    steps: [
      { id: 'bill', q: L('Valor da conta', 'Bill amount', 'Monto de la cuenta'), input: 'number', placeholder: L('240', '240', '240') },
      {
        id: 'tip',
        q: L('Gorjeta / serviço', 'Tip / service', 'Propina / servicio'),
        input: 'choice',
        options: () => ['0', '10', '12', '15', '18', '20'].map((x) => ({ value: x, label: x + '%' })),
      },
      { id: 'people', q: L('Quantas pessoas?', 'How many people?', '¿Cuántas personas?'), input: 'number', def: () => '2' },
    ],
    build: (a, { lang, cur }) => {
      const C = v(lang, 'conta', 'bill', 'cuenta');
      const G = v(lang, 'gorjeta', 'tip', 'propina');
      const T = v(lang, 'com gorjeta', 'with tip', 'con propina');
      const N = v(lang, 'pessoas', 'people', 'personas');
      return [`# ${v(lang, 'Dividir a conta', 'Split the bill', 'Dividir la cuenta')}`, `${C} = ${money(a.bill, cur)}`, `${G} = ${pct(a.tip)}`, `${N} = ${a.people}`, `${T} = ${C} + ${G}`, `${v(lang, 'cada um', 'each', 'cada uno')} = ${T} / ${N}`];
    },
  },
  {
    id: 'discount',
    icon: 'BadgePercent',
    title: L('Desconto e acréscimo', 'Discount & markup', 'Descuento y recargo'),
    desc: L('Preço final com desconto ou acréscimo em %', 'Final price with a % discount or markup', 'Precio final con descuento o recargo en %'),
    steps: [
      { id: 'price', q: L('Preço original', 'Original price', 'Precio original'), input: 'number' },
      {
        id: 'kind',
        q: L('O que aplicar?', 'What to apply?', '¿Qué aplicar?'),
        input: 'choice',
        options: (_a, lang) => [
          { value: '-', label: v(lang, 'Desconto', 'Discount', 'Descuento') },
          { value: '+', label: v(lang, 'Acréscimo', 'Markup', 'Recargo') },
        ],
      },
      { id: 'p', q: L('Quantos %?', 'How many %?', '¿Cuántos %?'), input: 'number', placeholder: L('15', '15', '15') },
    ],
    build: (a, { lang, cur }) => {
      const P = v(lang, 'preço', 'price', 'precio');
      const D = a.kind === '-' ? v(lang, 'desconto', 'discount', 'descuento') : v(lang, 'acréscimo', 'markup', 'recargo');
      return [`# ${a.kind === '-' ? v(lang, 'Desconto', 'Discount', 'Descuento') : v(lang, 'Acréscimo', 'Markup', 'Recargo')}`, `${P} = ${money(a.price, cur)}`, `${D} = ${pct(a.p)}`, `${v(lang, 'final', 'final', 'final')} = ${P} ${a.kind} ${D}`, `${v(lang, 'diferença', 'difference', 'diferencia')} = ${D} * ${P}`];
    },
  },
  {
    id: 'change',
    icon: 'ArrowUpDown',
    title: L('Variação percentual', 'Percent change', 'Variación porcentual'),
    desc: L('Quanto um valor subiu ou caiu, em %', 'How much a value went up or down, in %', 'Cuánto subió o bajó un valor, en %'),
    steps: [
      { id: 'a', q: L('Valor inicial', 'Initial value', 'Valor inicial'), input: 'number' },
      { id: 'b', q: L('Valor final', 'Final value', 'Valor final'), input: 'number' },
    ],
    build: (a, { lang }) => {
      const A = v(lang, 'valor inicial', 'initial value', 'valor inicial');
      const B = v(lang, 'valor final', 'final value', 'valor final');
      return [`# ${v(lang, 'Variação', 'Change', 'Variación')}`, `${A} = ${a.a}`, `${B} = ${a.b}`, `${v(lang, 'diferença', 'difference', 'diferencia')} = ${B} - ${A}`, `(${B} - ${A}) / ${A} ${conv(lang)} %`];
    },
  },
  {
    id: 'rule3',
    icon: 'Scale',
    title: L('Regra de três', 'Rule of three', 'Regla de tres'),
    desc: L('Proporção direta ou inversa entre valores', 'Direct or inverse proportion between values', 'Proporción directa o inversa entre valores'),
    steps: [
      { id: 'a', q: L('Se A…', 'If A…', 'Si A…'), input: 'number' },
      { id: 'b', q: L('…corresponde a B…', '…corresponds to B…', '…corresponde a B…'), input: 'number' },
      { id: 'c', q: L('…então C corresponde a quanto?', '…then C corresponds to?', '…entonces C corresponde a?'), input: 'number' },
      {
        id: 'kind',
        q: L('As grandezas são…', 'The quantities are…', 'Las magnitudes son…'),
        input: 'choice',
        options: (_a, lang) => [
          { value: 'd', label: v(lang, 'Diretamente proporcionais', 'Directly proportional', 'Directamente proporcionales') },
          { value: 'i', label: v(lang, 'Inversamente proporcionais', 'Inversely proportional', 'Inversamente proporcionales') },
        ],
      },
    ],
    build: (a, { lang }) => [`# ${v(lang, 'Regra de três', 'Rule of three', 'Regla de tres')}`, `// ${a.a} → ${a.b}  ·  ${a.c} → x`, a.kind === 'i' ? `x = ${a.a} * ${a.b} / ${a.c}` : `x = ${a.b} * ${a.c} / ${a.a}`],
  },
  {
    id: 'units',
    icon: 'Ruler',
    title: L('Converter unidades', 'Convert units', 'Convertir unidades'),
    desc: L('Comprimento, peso, volume, temperatura, dados…', 'Length, weight, volume, temperature, data…', 'Longitud, peso, volumen, temperatura, datos…'),
    steps: [
      {
        id: 'dim',
        q: L('Que tipo de medida?', 'What kind of measure?', '¿Qué tipo de medida?'),
        input: 'choice',
        options: (_a, lang) => DIMS.map((d) => ({ value: d, label: DIM_LABEL[d][lang] })),
      },
      { id: 'from', q: L('De qual unidade?', 'From which unit?', '¿De qué unidad?'), input: 'choice', options: (a) => unitOptions(a.dim) },
      { id: 'to', q: L('Para qual unidade?', 'To which unit?', '¿A qué unidad?'), input: 'choice', options: (a) => unitOptions(a.dim).filter((o) => o.value !== a.from) },
      { id: 'n', q: L('Qual valor?', 'Which value?', '¿Qué valor?'), input: 'number', def: () => '1' },
    ],
    build: (a, { lang }) => [`${a.n} ${a.from} ${conv(lang)} ${a.to}`],
  },
  {
    id: 'currency',
    icon: 'Coins',
    title: L('Converter moedas', 'Convert currencies', 'Convertir monedas'),
    desc: L('Moedas e criptomoedas com cotação ao vivo', 'Currencies and crypto at live rates', 'Monedas y criptomonedas con cotización en vivo'),
    steps: [
      { id: 'n', q: L('Qual valor?', 'Which amount?', '¿Qué monto?'), input: 'number', def: () => '100' },
      { id: 'from', q: L('De qual moeda?', 'From which currency?', '¿De qué moneda?'), input: 'choice', options: () => ['USD', 'EUR', 'BRL', 'GBP', 'ARS', 'JPY', 'BTC'].map((c) => ({ value: c, label: c })) },
      { id: 'to', q: L('Para qual moeda?', 'To which currency?', '¿A qué moneda?'), input: 'choice', options: (a) => ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'JPY', 'BTC'].filter((c) => c !== a.from).map((c) => ({ value: c, label: c })) },
    ],
    build: (a, { lang }) => [`${a.n} ${a.from} ${conv(lang)} ${a.to}`],
  },
  {
    id: 'trip',
    icon: 'Fuel',
    title: L('Combustível da viagem', 'Trip fuel cost', 'Combustible del viaje'),
    desc: L('Litros e custo do combustível da viagem', 'Liters and fuel cost of a trip', 'Litros y costo del combustible del viaje'),
    steps: [
      { id: 'dist', q: L('Distância (km)', 'Distance (km)', 'Distancia (km)'), input: 'number', placeholder: L('450', '450', '450') },
      { id: 'cons', q: L('Consumo do carro (km por litro)', 'Car consumption (km per liter)', 'Consumo del auto (km por litro)'), input: 'number', placeholder: L('12', '12', '12') },
      { id: 'price', q: L('Preço do litro', 'Price per liter', 'Precio por litro'), input: 'number', placeholder: L('6,29', '1.89', '1,65') },
      {
        id: 'round',
        q: L('Ida e volta?', 'Round trip?', '¿Ida y vuelta?'),
        input: 'choice',
        options: (_a, lang) => [
          { value: '2', label: v(lang, 'Sim', 'Yes', 'Sí') },
          { value: '1', label: v(lang, 'Só ida', 'One way', 'Solo ida') },
        ],
      },
    ],
    build: (a, { lang, cur }) => {
      const D = v(lang, 'distancia', 'distance', 'distancia');
      const C = v(lang, 'consumo', 'consumption', 'consumo');
      const P = v(lang, 'preco do litro', 'price per liter', 'precio del litro');
      const Li = v(lang, 'litros', 'liters', 'litros');
      return [`# ${v(lang, 'Viagem', 'Trip', 'Viaje')}`, `${D} = ${a.dist} * ${a.round}`, `${C} = ${a.cons}`, `${P} = ${money(a.price, cur)}`, `${Li} = ${D} / ${C}`, `${v(lang, 'custo', 'cost', 'costo')} = ${Li} * ${P}`];
    },
  },
  {
    id: 'budget',
    icon: 'Wallet',
    title: L('Orçamento 50/30/20', '50/30/20 budget', 'Presupuesto 50/30/20'),
    desc: L('Divide a renda em essenciais, desejos e investimentos', 'Splits income into needs, wants and savings', 'Divide el ingreso en esenciales, deseos y ahorro'),
    steps: [{ id: 'income', q: L('Renda líquida mensal', 'Monthly net income', 'Ingreso neto mensual'), input: 'number', placeholder: L('6.000', '6,000', '6.000') }],
    build: (a, { lang, cur }) => {
      const R = v(lang, 'renda', 'income', 'ingreso');
      return [
        `# ${v(lang, 'Orçamento do mês', 'Monthly budget', 'Presupuesto del mes')}`,
        `${R} = ${money(a.income, cur)}`,
        `${v(lang, 'Essenciais', 'Needs', 'Esenciales')}: 50% ${v(lang, 'de', 'of', 'de')} ${R}`,
        `${v(lang, 'Desejos', 'Wants', 'Deseos')}: 30% ${v(lang, 'de', 'of', 'de')} ${R}`,
        `${v(lang, 'Investimentos', 'Savings', 'Ahorro')}: 20% ${v(lang, 'de', 'of', 'de')} ${R}`,
      ];
    },
  },
  {
    id: 'hourly',
    icon: 'Clock',
    title: L('Valor da hora (freelancer)', 'Hourly rate (freelancer)', 'Valor por hora (freelancer)'),
    desc: L('Quanto cobrar por hora para atingir sua meta', 'How much to charge per hour to reach your goal', 'Cuánto cobrar por hora para alcanzar tu meta'),
    steps: [
      { id: 'goal', q: L('Quanto quer ganhar por mês?', 'Monthly income goal?', '¿Cuánto quieres ganar al mes?'), input: 'number' },
      { id: 'costs', q: L('Custos mensais (impostos, ferramentas…)', 'Monthly costs (taxes, tools…)', 'Costos mensuales (impuestos, herramientas…)'), input: 'number', def: () => '0' },
      { id: 'hours', q: L('Horas trabalhadas por dia', 'Hours worked per day', 'Horas trabajadas por día'), input: 'number', def: () => '6' },
      { id: 'days', q: L('Dias por mês', 'Days per month', 'Días por mes'), input: 'number', def: () => '20' },
    ],
    build: (a, { lang, cur }) => {
      const M = v(lang, 'meta', 'goal', 'meta');
      const C = v(lang, 'custos', 'costs', 'costos');
      const H = v(lang, 'horas no mes', 'hours per month', 'horas al mes');
      return [`# ${v(lang, 'Valor da hora', 'Hourly rate', 'Valor por hora')}`, `${M} = ${money(a.goal, cur)}`, `${C} = ${money(a.costs || '0', cur)}`, `${H} = ${a.hours} * ${a.days}`, `${v(lang, 'valor da hora', 'hourly rate', 'valor por hora')} = (${M} + ${C}) / ${H}`];
    },
  },
];
