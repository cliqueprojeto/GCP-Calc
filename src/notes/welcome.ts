import { uid } from '../lib/platform';
import type { Block, Lang, Note } from '../lib/types';

const calc = (text: string): Block => ({ id: uid(), type: 'calc', text });

function lang(l: 'auto' | Lang): Lang {
  if (l !== 'auto') return l;
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'pt').toLowerCase();
  return n.startsWith('pt') ? 'pt' : n.startsWith('es') ? 'es' : 'en';
}

const WELCOME: Record<Lang, { title: string; blocks: Block[] }> = {
  pt: {
    title: 'Bem-vindo ao GCP-Calc',
    blocks: [
      { id: uid(), type: 'callout', icon: 'Sparkles', color: '#8b5cf6', text: 'Escreva do jeito que você pensa. Os resultados aparecem à direita, linha a linha. Clique num resultado para copiar.' },
      calc(
        [
          '# O básico',
          'Aluguel: R$ 1.850',
          'Condomínio: R$ 620',
          'Internet: R$ 99,90',
          'total',
          '',
          '# Porcentagens',
          'R$ 250 - 15%',
          '20% de 1.200',
          '45 em % de 180',
          '',
          '# Variáveis',
          'salario = R$ 7.500',
          'gastos = R$ 4.230',
          'sobra = salario - gastos',
          'sobra em % de salario',
        ].join('\n'),
      ),
      { id: uid(), type: 'chart', kind: 'donut', source: '', title: 'Para onde vai o dinheiro' },
      calc(
        [
          '# Moedas ao vivo',
          'US$ 120 em reais',
          '€ 49,90 em BRL',
          '0,01 BTC em USD',
          '',
          '# Unidades',
          '5 km em milhas',
          '180 cm em pés',
          '3 xícaras em ml',
          '100 °C em fahrenheit',
          '1,5 TB em GB',
          '90 km/h em m/s',
          '',
          '# Datas e funções',
          'hoje + 45 dias',
          '25/12/2026 - hoje',
          'raiz(144) + 2^10',
          'parcela = pmt(1,2%; 24; R$ 15.000)',
          '255 em hex',
          '',
          '// Dica: Ctrl+K abre a busca rápida e ✦ Assistente guia cálculos passo a passo.',
        ].join('\n'),
      ),
    ],
  },
  en: {
    title: 'Welcome to GCP-Calc',
    blocks: [
      { id: uid(), type: 'callout', icon: 'Sparkles', color: '#8b5cf6', text: 'Write the way you think. Results appear on the right, line by line. Click a result to copy it.' },
      calc(['# The basics', 'Rent: $1,850', 'Utilities: $320', 'Internet: $59.90', 'total', '', '# Percentages', '$250 - 15%', '20% of 1,200', '45 as % of 180', '', '# Variables', 'salary = $7,500', 'expenses = $4,230', 'left = salary - expenses', 'left as % of salary'].join('\n')),
      { id: uid(), type: 'chart', kind: 'donut', source: '', title: 'Where the money goes' },
      calc(
        [
          '# Live currencies',
          '$120 in EUR',
          '€49.90 in USD',
          '0.01 BTC in USD',
          '',
          '# Units',
          '5 km in miles',
          '180 cm in feet',
          '3 cups in ml',
          '100 °C in fahrenheit',
          '1.5 TB in GB',
          '60 mph in km/h',
          '',
          '# Dates and functions',
          'today + 45 days',
          '12/25/2026 - today',
          'sqrt(144) + 2^10',
          'payment = pmt(1.2%; 24; $15,000)',
          '255 in hex',
          '',
          '// Tip: Ctrl+K opens quick search and ✦ Assistant guides calculations step by step.',
        ].join('\n'),
      ),
    ],
  },
  es: {
    title: 'Bienvenido a GCP-Calc',
    blocks: [
      { id: uid(), type: 'callout', icon: 'Sparkles', color: '#8b5cf6', text: 'Escribe como piensas. Los resultados aparecen a la derecha, línea por línea. Haz clic en un resultado para copiarlo.' },
      calc(['# Lo básico', 'Alquiler: € 950', 'Luz y agua: € 120', 'Internet: € 35,90', 'total', '', '# Porcentajes', '€ 250 - 15%', '20% de 1.200', '45 en % de 180', '', '# Variables', 'sueldo = € 2.500', 'gastos = € 1.430', 'ahorro = sueldo - gastos', 'ahorro en % de sueldo'].join('\n')),
      { id: uid(), type: 'chart', kind: 'donut', source: '', title: 'A dónde va el dinero' },
      calc(
        [
          '# Monedas en vivo',
          'US$ 120 en euros',
          '€ 49,90 en USD',
          '0,01 BTC en USD',
          '',
          '# Unidades',
          '5 km en millas',
          '180 cm en pies',
          '3 tazas en ml',
          '100 °C en fahrenheit',
          '1,5 TB en GB',
          '',
          '# Fechas y funciones',
          'hoy + 45 días',
          '25/12/2026 - hoy',
          'raiz(144) + 2^10',
          'cuota = pmt(1,2%; 24; € 15.000)',
          '255 en hex',
          '',
          '// Consejo: Ctrl+K abre la búsqueda rápida y ✦ Asistente guía los cálculos paso a paso.',
        ].join('\n'),
      ),
    ],
  },
};

export function welcomeNotes(l: 'auto' | Lang): Note[] {
  const w = WELCOME[lang(l)];
  const t = Date.now();
  // o gráfico usa o primeiro bloco de cálculo como fonte
  const blocks = w.blocks.map((b) => ({ ...b }));
  const src = blocks.find((b) => b.type === 'calc')!;
  for (const b of blocks) if (b.type === 'chart') b.source = src.id;
  return [{ id: uid(), title: w.title, icon: 'Sparkles', color: '#8b5cf6', pinned: true, created: t, updated: t, blocks }];
}
