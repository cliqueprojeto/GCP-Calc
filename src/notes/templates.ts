import type { Lang } from '../lib/types';

export interface Template {
  id: string;
  icon: string;
  color: string;
  title: Record<Lang, string>;
  desc: Record<Lang, string>;
  text: Record<Lang, string>;
  chart?: 'bar' | 'pie' | 'donut' | 'hbar';
}

const j = (...l: string[]) => l.join('\n');

export const TEMPLATES: Template[] = [
  {
    id: 'budget',
    icon: 'Wallet',
    color: '#10b981',
    chart: 'donut',
    title: { pt: 'Orçamento do mês', en: 'Monthly budget', es: 'Presupuesto del mes' },
    desc: { pt: 'Receitas, despesas fixas e quanto sobra', en: 'Income, fixed costs and what is left', es: 'Ingresos, gastos fijos y lo que sobra' },
    text: {
      pt: j('# Receitas', 'salario = R$ 6.800', 'extra = R$ 900', 'renda = salario + extra', '', '# Despesas', 'Moradia: R$ 2.100', 'Mercado: R$ 1.150', 'Transporte: R$ 420', 'Saúde: R$ 380', 'Lazer: R$ 450', 'Assinaturas: R$ 129,70', 'despesas = total', '', 'sobra = renda - despesas', 'sobra em % de renda'),
      en: j('# Income', 'salary = $6,800', 'extra = $900', 'income = salary + extra', '', '# Expenses', 'Housing: $2,100', 'Groceries: $1,150', 'Transport: $420', 'Health: $380', 'Leisure: $450', 'Subscriptions: $129.70', 'expenses = total', '', 'left = income - expenses', 'left as % of income'),
      es: j('# Ingresos', 'sueldo = € 2.800', 'extra = € 300', 'ingreso = sueldo + extra', '', '# Gastos', 'Vivienda: € 900', 'Supermercado: € 420', 'Transporte: € 90', 'Salud: € 60', 'Ocio: € 150', 'Suscripciones: € 39,90', 'gastos = total', '', 'sobra = ingreso - gastos', 'sobra en % de ingreso'),
    },
  },
  {
    id: 'trip',
    icon: 'Plane',
    color: '#06b6d4',
    chart: 'bar',
    title: { pt: 'Viagem internacional', en: 'International trip', es: 'Viaje internacional' },
    desc: { pt: 'Custos em várias moedas convertidos ao vivo', en: 'Costs in several currencies, converted live', es: 'Costos en varias monedas convertidos en vivo' },
    text: {
      pt: j('# Viagem a Lisboa', 'dias = 8', 'Passagem: R$ 4.380', 'Hotel: € 95 * dias', 'Alimentação: € 45 * dias', 'Passeios: € 260', 'Seguro: US$ 68', 'custo total = total em BRL', '', '# Por pessoa', 'pessoas = 2', 'custo total / pessoas'),
      en: j('# Trip to Lisbon', 'days = 8', 'Flights: $1,280', 'Hotel: €95 * days', 'Food: €45 * days', 'Tours: €260', 'Insurance: $68', 'trip cost = total in USD', '', '# Per person', 'people = 2', 'trip cost / people'),
      es: j('# Viaje a Lisboa', 'dias = 8', 'Vuelos: € 780', 'Hotel: € 95 * dias', 'Comida: € 45 * dias', 'Paseos: € 260', 'Seguro: US$ 68', 'costo total = total en EUR', '', '# Por persona', 'personas = 2', 'costo total / personas'),
    },
  },
  {
    id: 'cultural',
    icon: 'Theater',
    color: '#ec4899',
    chart: 'pie',
    title: { pt: 'Orçamento de projeto cultural', en: 'Cultural project budget', es: 'Presupuesto de proyecto cultural' },
    desc: { pt: 'Rubricas, limites percentuais e contrapartida', en: 'Budget lines, percentage caps and matching', es: 'Rubros, límites porcentuales y contrapartida' },
    text: {
      pt: j('# Projeto cultural', 'Pré-produção: R$ 18.000', 'Produção: R$ 96.000', 'Divulgação: R$ 22.000', 'Custos administrativos: R$ 14.000', 'Captação: R$ 12.000', 'projeto = total', '', '# Conferência de limites', 'Divulgação em % de projeto', 'Custos administrativos em % de projeto', '// limite de divulgação 20% e administrativos 15% (verifique o edital)', 'teto divulgação = 20% de projeto', 'teto administrativo = 15% de projeto'),
      en: j('# Cultural project', 'Pre-production: $18,000', 'Production: $96,000', 'Marketing: $22,000', 'Administrative: $14,000', 'Fundraising: $12,000', 'project = total', '', '# Checking caps', 'Marketing as % of project', 'Administrative as % of project', 'marketing cap = 20% of project', 'admin cap = 15% of project'),
      es: j('# Proyecto cultural', 'Preproducción: € 18.000', 'Producción: € 96.000', 'Difusión: € 22.000', 'Administración: € 14.000', 'Captación: € 12.000', 'proyecto = total', '', '# Control de límites', 'Difusión en % de proyecto', 'Administración en % de proyecto', 'tope difusion = 20% de proyecto', 'tope administracion = 15% de proyecto'),
    },
  },
  {
    id: 'freelance',
    icon: 'Briefcase',
    color: '#8b5cf6',
    title: { pt: 'Proposta de freelance', en: 'Freelance quote', es: 'Presupuesto freelance' },
    desc: { pt: 'Horas, valor/hora, impostos e desconto', en: 'Hours, rate, taxes and discount', es: 'Horas, tarifa, impuestos y descuento' },
    text: {
      pt: j('# Proposta', 'valor da hora = R$ 120', 'Design: 32 h', 'Desenvolvimento: 60 h', 'Reuniões: 8 h', 'horas = total', 'subtotal = horas / 1 h * valor da hora', '// horas ÷ 1 h vira o número de horas', 'imposto = 6%', 'com imposto = subtotal + imposto', 'final = com imposto - 5%'),
      en: j('# Quote', 'hourly rate = $95', 'Design: 32 h', 'Development: 60 h', 'Meetings: 8 h', 'hours = total', 'subtotal = hours / 1 h * hourly rate', 'tax = 6%', 'with tax = subtotal + tax', 'final = with tax - 5%'),
      es: j('# Presupuesto', 'valor hora = € 45', 'Diseño: 32 h', 'Desarrollo: 60 h', 'Reuniones: 8 h', 'horas = total', 'subtotal = horas / 1 h * valor hora', 'impuesto = 6%', 'con impuesto = subtotal + impuesto', 'final = con impuesto - 5%'),
    },
  },
  {
    id: 'recipe',
    icon: 'ChefHat',
    color: '#f59e0b',
    title: { pt: 'Receita escalável', en: 'Scalable recipe', es: 'Receta escalable' },
    desc: { pt: 'Ajuste porções e converta medidas', en: 'Scale servings and convert measures', es: 'Ajusta porciones y convierte medidas' },
    text: {
      pt: j('# Bolo de cenoura', 'porções = 12', 'base = 8', 'fator = porções / base', '', 'Farinha: 2 xícaras * fator em ml', 'Açúcar: 1,5 xícaras * fator em ml', 'Óleo: 120 ml * fator', 'Ovos: 3 * fator', 'Forno: 180 °C em fahrenheit', 'Tempo: 40 min'),
      en: j('# Carrot cake', 'servings = 12', 'base = 8', 'factor = servings / base', '', 'Flour: 2 cups * factor in ml', 'Sugar: 1.5 cups * factor in ml', 'Oil: 120 ml * factor', 'Eggs: 3 * factor', 'Oven: 350 °F in celsius', 'Time: 40 min'),
      es: j('# Pastel de zanahoria', 'porciones = 12', 'base = 8', 'factor = porciones / base', '', 'Harina: 2 tazas * factor en ml', 'Azúcar: 1,5 tazas * factor en ml', 'Aceite: 120 ml * factor', 'Huevos: 3 * factor', 'Horno: 180 °C en fahrenheit', 'Tiempo: 40 min'),
    },
  },
  {
    id: 'invest',
    icon: 'TrendingUp',
    color: '#22c55e',
    title: { pt: 'Investimentos', en: 'Investments', es: 'Inversiones' },
    desc: { pt: 'Juros compostos com aportes mensais', en: 'Compound interest with monthly deposits', es: 'Interés compuesto con aportes mensuales' },
    text: {
      pt: j('# Reserva', 'inicial = R$ 5.000', 'aporte = R$ 800', 'taxa = 0,9%', 'meses = 60', 'montante = fv(taxa; meses; aporte; inicial)', 'investido = inicial + aporte * meses', 'rendimento = montante - investido', 'rendimento em % de investido'),
      en: j('# Savings', 'initial = $5,000', 'deposit = $800', 'rate = 0.6%', 'months = 60', 'amount = fv(rate; months; deposit; initial)', 'invested = initial + deposit * months', 'earnings = amount - invested', 'earnings as % of invested'),
      es: j('# Ahorro', 'inicial = € 5.000', 'aporte = € 300', 'tasa = 0,5%', 'meses = 60', 'monto = fv(tasa; meses; aporte; inicial)', 'invertido = inicial + aporte * meses', 'rendimiento = monto - invertido', 'rendimiento en % de invertido'),
    },
  },
  {
    id: 'renovation',
    icon: 'Hammer',
    color: '#f97316',
    chart: 'hbar',
    title: { pt: 'Reforma e obra', en: 'Home renovation', es: 'Reforma y obra' },
    desc: { pt: 'Áreas em m², materiais e mão de obra', en: 'Areas, materials and labor', es: 'Áreas en m², materiales y mano de obra' },
    text: {
      pt: j('# Sala', 'area = 4,2 m * 5,5 m', 'Piso: area * R$ 89 + 10%', 'Rodapé: (4,2 + 5,5) * 2 * R$ 18', 'Pintura: 3 * R$ 320', 'Mão de obra: area * R$ 65', 'total'),
      en: j('# Living room', 'area = 14 ft * 18 ft', 'Floor: area in m2 * $25 + 10%', 'Paint: 3 * $65', 'Labor: area in m2 * $30', 'total'),
      es: j('# Salón', 'area = 4,2 m * 5,5 m', 'Suelo: area * € 32 + 10%', 'Zócalo: (4,2 + 5,5) * 2 * € 7', 'Pintura: 3 * € 60', 'Mano de obra: area * € 25', 'total'),
    },
  },
  {
    id: 'convert',
    icon: 'Ruler',
    color: '#3b82f6',
    title: { pt: 'Conversões rápidas', en: 'Quick conversions', es: 'Conversiones rápidas' },
    desc: { pt: 'Moedas, medidas, dados e temperatura', en: 'Currency, measures, data and temperature', es: 'Monedas, medidas, datos y temperatura' },
    text: {
      pt: j('# Moedas', '1 USD em BRL', '1 EUR em BRL', '1 BTC em BRL', '', '# Medidas', '1 milha em km', '1 polegada em cm', '1 libra em kg', '1 galão em litros', '', '# Digital', '500 Mbps * 1 h em GB', '4 GB em MB', '', '# Clima', '30 °C em fahrenheit'),
      en: j('# Currency', '1 USD in EUR', '1 GBP in USD', '1 BTC in USD', '', '# Measures', '1 mile in km', '1 inch in cm', '1 pound in kg', '1 gallon in liters', '', '# Digital', '500 Mbps * 1 h in GB', '4 GB in MB', '', '# Weather', '86 °F in celsius'),
      es: j('# Monedas', '1 USD en EUR', '1 EUR en USD', '1 BTC en EUR', '', '# Medidas', '1 milla en km', '1 pulgada en cm', '1 libra en kg', '1 galón en litros', '', '# Digital', '500 Mbps * 1 h en GB', '4 GB en MB', '', '# Clima', '30 °C en fahrenheit'),
    },
  },
];
