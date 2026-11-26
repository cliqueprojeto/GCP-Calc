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
      pt: j('#Receitas', 'Salário: R$ 6.800,00', 'Extra: R$ 900,00', 'Total #Receitas', '', '#Despesas', 'Moradia: R$ 2.100,00', 'Mercado: R$ 1.150,00', 'Transporte: R$ 420,00', 'Saúde: R$ 380,00', 'Lazer: R$ 450,00', 'Assinaturas: R$ 129,70', 'Total #Despesas', '', 'Sobra: #Receitas - #Despesas', 'Sobra %'),
      en: j('#Income', 'Salary: $6,800.00', 'Extra: $900.00', 'Total #Income', '', '#Expenses', 'Housing: $2,100.00', 'Groceries: $1,150.00', 'Transport: $420.00', 'Health: $380.00', 'Leisure: $450.00', 'Subscriptions: $129.70', 'Total #Expenses', '', 'Balance: #Income - #Expenses', 'Balance %'),
      es: j('#Ingresos', 'Sueldo: € 2.800,00', 'Extra: € 300,00', 'Total #Ingresos', '', '#Gastos', 'Vivienda: € 900,00', 'Supermercado: € 420,00', 'Transporte: € 90,00', 'Salud: € 60,00', 'Ocio: € 150,00', 'Suscripciones: € 39,90', 'Total #Gastos', '', 'Saldo: #Ingresos - #Gastos', 'Saldo %'),
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
    id: 'shopping',
    icon: 'ShoppingCart',
    color: '#22c55e',
    chart: 'donut',
    title: { pt: 'Lista de compras', en: 'Shopping list', es: 'Lista de compras' },
    desc: { pt: 'Itens por seção, quantidade × preço e quanto sobra do orçamento', en: 'Items by aisle, quantity × price and what is left of the budget', es: 'Artículos por sección, cantidad × precio y lo que sobra' },
    text: {
      pt: j('#Mercearia', 'Arroz: 2 * R$ 27,90', 'Feijão: 3 * R$ 8,49', 'Café: R$ 18,90', 'Azeite: R$ 39,90', '', '#Hortifruti', 'Banana: 2 * R$ 6,99', 'Tomate: R$ 12,40', 'Alface: 2 * R$ 3,50', '', '#Limpeza', 'Sabão em pó: R$ 22,50', 'Detergente: 4 * R$ 2,79', '', '# Resumo', 'Compras: #Mercearia + #Hortifruti + #Limpeza', 'Orçamento: R$ 400,00', 'Sobra: Orçamento - Compras'),
      en: j('#Pantry', 'Rice: 2 * $4.90', 'Beans: 3 * $1.79', 'Coffee: $8.90', 'Olive oil: $12.90', '', '#Produce', 'Bananas: 2 * $1.29', 'Tomatoes: $3.40', 'Lettuce: 2 * $1.50', '', '#Cleaning', 'Detergent: $9.50', 'Dish soap: 4 * $1.79', '', '# Summary', 'Groceries: #Pantry + #Produce + #Cleaning', 'Budget: $80.00', 'Left: Budget - Groceries'),
      es: j('#Despensa', 'Arroz: 2 * € 1,90', 'Legumbres: 3 * € 1,29', 'Café: € 4,90', 'Aceite: € 8,90', '', '#Fruteria', 'Plátanos: 2 * € 1,99', 'Tomates: € 2,40', 'Lechuga: 2 * € 0,90', '', '#Limpieza', 'Detergente: € 6,50', 'Lavavajillas: 4 * € 1,29', '', '# Resumen', 'Compra: #Despensa + #Fruteria + #Limpieza', 'Presupuesto: € 60,00', 'Sobra: Presupuesto - Compra'),
    },
  },
  {
    id: 'pets',
    icon: 'PawPrint',
    color: '#f59e0b',
    chart: 'pie',
    title: { pt: 'Gastos com pets', en: 'Pet expenses', es: 'Gastos de mascotas' },
    desc: { pt: 'Ração, banho, saúde: por mês, por ano e por dia', en: 'Food, grooming, health: per month, year and day', es: 'Comida, baño, salud: por mes, año y día' },
    text: {
      pt: j('#Mensal', 'Ração: R$ 189,90', 'Petiscos: R$ 45,00', 'Banho e tosa: 2 * R$ 70,00', 'Antipulgas: R$ 89,00', 'Total #Mensal', '', '#Anual', 'Vacinas: R$ 320,00', 'Veterinário: 2 * R$ 180,00', 'Total #Anual', '', '# Resumo', 'por ano = #Mensal * 12 + #Anual', 'por mês = por ano / 12', 'por dia = por ano / 365'),
      en: j('#Monthly', 'Food: $54.90', 'Treats: $15.00', 'Grooming: 2 * $35.00', 'Flea control: $24.00', 'Total #Monthly', '', '#Yearly', 'Vaccines: $120.00', 'Vet visits: 2 * $75.00', 'Total #Yearly', '', '# Summary', 'per year = #Monthly * 12 + #Yearly', 'per month = per year / 12', 'per day = per year / 365'),
      es: j('#Mensual', 'Pienso: € 49,90', 'Premios: € 12,00', 'Peluquería: 2 * € 30,00', 'Antipulgas: € 22,00', 'Total #Mensual', '', '#Anual', 'Vacunas: € 90,00', 'Veterinario: 2 * € 60,00', 'Total #Anual', '', '# Resumen', 'por año = #Mensual * 12 + #Anual', 'por mes = por año / 12', 'por dia = por año / 365'),
    },
  },
  {
    id: 'split',
    icon: 'ReceiptText',
    color: '#ef4444',
    title: { pt: 'Dividir a conta', en: 'Split the bill', es: 'Dividir la cuenta' },
    desc: { pt: 'Consumo, taxa de serviço e quanto cada um paga', en: 'Items, service charge and what each person pays', es: 'Consumo, servicio y cuánto paga cada uno' },
    text: {
      pt: j('# Restaurante', 'Pratos: R$ 189,00', 'Bebidas: R$ 76,00', 'Sobremesas: R$ 42,00', 'consumo = total', 'serviço = 10% de consumo', 'conta = consumo + serviço', 'pessoas = 4', 'por pessoa = conta / pessoas'),
      en: j('# Restaurant', 'Mains: $96.00', 'Drinks: $38.00', 'Desserts: $21.00', 'food = total', 'tip = 18% of food', 'bill = food + tip', 'people = 4', 'per person = bill / people'),
      es: j('# Restaurante', 'Platos: € 72,00', 'Bebidas: € 28,00', 'Postres: € 16,00', 'consumo = total', 'servicio = 10% de consumo', 'cuenta = consumo + servicio', 'personas = 4', 'por persona = cuenta / personas'),
    },
  },
  {
    id: 'car',
    icon: 'Fuel',
    color: '#0ea5e9',
    title: { pt: 'Viagem de carro', en: 'Road trip', es: 'Viaje en coche' },
    desc: { pt: 'Combustível pela distância, pedágios e rateio', en: 'Fuel by distance, tolls and sharing', es: 'Combustible por distancia, peajes y reparto' },
    text: {
      pt: j('# Viagem de carro', 'distância = 430 km', 'consumo = 12', '// km por litro', 'litros = distância / 1 km / consumo', 'preço do litro = R$ 6,29', 'Combustível: litros * preço do litro', 'Pedágios: R$ 74,60', 'Estacionamento: R$ 40,00', 'ida = Combustível + Pedágios + Estacionamento', 'ida e volta = ida * 2', 'pessoas = 3', 'por pessoa = ida e volta / pessoas'),
      en: j('# Road trip', 'distance = 270 mi', 'mpg = 30', 'gallons = distance / 1 mi / mpg', 'gas price = $3.45', 'Fuel: gallons * gas price', 'Tolls: $18.50', 'Parking: $25.00', 'one way = Fuel + Tolls + Parking', 'round trip = one way * 2', 'people = 3', 'per person = round trip / people'),
      es: j('# Viaje en coche', 'distancia = 430 km', 'consumo = 16', '// km por litro', 'litros = distancia / 1 km / consumo', 'precio litro = € 1,65', 'Combustible: litros * precio litro', 'Peajes: € 32,00', 'Aparcamiento: € 18,00', 'ida = Combustible + Peajes + Aparcamiento', 'ida y vuelta = ida * 2', 'personas = 3', 'por persona = ida y vuelta / personas'),
    },
  },
  {
    id: 'bbq',
    icon: 'Flame',
    color: '#dc2626',
    chart: 'bar',
    title: { pt: 'Churrasco e festa', en: 'BBQ & party', es: 'Asado y fiesta' },
    desc: { pt: 'Quantidade de carne por pessoa, bebidas e rateio', en: 'Meat per person, drinks and cost per guest', es: 'Carne por persona, bebidas y reparto' },
    text: {
      pt: j('# Convidados', 'adultos = 12', 'crianças = 4', 'carne = (adultos * 400 g + crianças * 200 g) em kg', '', '#Compras', 'Carne: carne / 1 kg * R$ 52,90', 'Linguiça: 2 * R$ 24,90', 'Carvão: 2 * R$ 22,00', 'Bebidas: adultos * R$ 18,00', 'Extras: R$ 60,00', 'Total #Compras', '', 'por adulto = #Compras / adultos'),
      en: j('# Guests', 'adults = 12', 'kids = 4', 'meat = (adults * 0.9 lb + kids * 0.45 lb) in lb', '', '#Shopping', 'Meat: meat / 1 lb * $8.90', 'Sausages: 2 * $7.50', 'Charcoal: 2 * $12.00', 'Drinks: adults * $6.00', 'Extras: $25.00', 'Total #Shopping', '', 'per adult = #Shopping / adults'),
      es: j('# Invitados', 'adultos = 12', 'niños = 4', 'carne = (adultos * 400 g + niños * 200 g) en kg', '', '#Compras', 'Carne: carne / 1 kg * € 14,90', 'Chorizos: 2 * € 6,50', 'Carbón: 2 * € 7,00', 'Bebidas: adultos * € 5,00', 'Extras: € 20,00', 'Total #Compras', '', 'por adulto = #Compras / adultos'),
    },
  },
  {
    id: 'installments',
    icon: 'CreditCard',
    color: '#6366f1',
    title: { pt: 'Parcelado ou à vista?', en: 'Installments or cash?', es: '¿A plazos o al contado?' },
    desc: { pt: 'Compare desconto à vista com parcelas com juros', en: 'Compare a cash discount with paying in installments', es: 'Compara el descuento al contado con cuotas con interés' },
    text: {
      pt: j('# Compra', 'preço = R$ 3.600,00', 'com desconto = preço - 8%', 'parcelas = 12', 'juros = 1,99%', 'parcela = pmt(juros; parcelas; preço)', 'parcelado = parcela * parcelas', 'diferença = parcelado - com desconto', 'diferença em % de com desconto'),
      en: j('# Purchase', 'price = $1,200.00', 'with discount = price - 8%', 'months = 12', 'interest = 1.99%', 'installment = pmt(interest; months; price)', 'financed = installment * months', 'difference = financed - with discount', 'difference as % of with discount'),
      es: j('# Compra', 'precio = € 900,00', 'con descuento = precio - 8%', 'cuotas = 12', 'interes = 1,99%', 'cuota = pmt(interes; cuotas; precio)', 'financiado = cuota * cuotas', 'diferencia = financiado - con descuento', 'diferencia en % de con descuento'),
    },
  },
  {
    id: 'goal',
    icon: 'PiggyBank',
    color: '#ec4899',
    title: { pt: 'Meta de economia', en: 'Savings goal', es: 'Meta de ahorro' },
    desc: { pt: 'Quanto guardar por mês e por semana para chegar lá', en: 'How much to save per month and week to get there', es: 'Cuánto ahorrar por mes y por semana para lograrlo' },
    text: {
      pt: j('# Meta: viagem de férias', 'meta = R$ 12.000,00', 'já guardado = R$ 2.500,00', 'falta = meta - já guardado', 'meses = 10', 'por mês = falta / meses', 'por semana = por mês / 4,33', 'progresso = já guardado em % de meta'),
      en: j('# Goal: vacation', 'goal = $6,000.00', 'saved = $1,250.00', 'missing = goal - saved', 'months = 10', 'per month = missing / months', 'per week = per month / 4.33', 'progress = saved as % of goal'),
      es: j('# Meta: vacaciones', 'meta = € 4.000,00', 'ahorrado = € 800,00', 'falta = meta - ahorrado', 'meses = 10', 'por mes = falta / meses', 'por semana = por mes / 4,33', 'progreso = ahorrado en % de meta'),
    },
  },
  {
    id: 'school',
    icon: 'Backpack',
    color: '#14b8a6',
    chart: 'hbar',
    title: { pt: 'Volta às aulas', en: 'Back to school', es: 'Vuelta al cole' },
    desc: { pt: 'Material, livros e uniforme para um ou mais filhos', en: 'Supplies, books and uniforms for one or more kids', es: 'Material, libros y uniforme para uno o más hijos' },
    text: {
      pt: j('#Material', 'Cadernos: 8 * R$ 24,90', 'Lápis e canetas: R$ 46,00', 'Mochila: R$ 189,00', 'Livros: R$ 420,00', 'Uniforme: 3 * R$ 59,00', 'Total #Material', '', 'filhos = 2', 'para todos = #Material * filhos', 'cada parcela = para todos / 5'),
      en: j('#Supplies', 'Notebooks: 8 * $3.90', 'Pens and pencils: $14.00', 'Backpack: $45.00', 'Books: $120.00', 'Uniform: 3 * $22.00', 'Total #Supplies', '', 'kids = 2', 'for all = #Supplies * kids', 'each payment = for all / 5'),
      es: j('#Material', 'Cuadernos: 8 * € 2,90', 'Lápices y bolígrafos: € 12,00', 'Mochila: € 39,00', 'Libros: € 110,00', 'Uniforme: 3 * € 19,00', 'Total #Material', '', 'hijos = 2', 'para todos = #Material * hijos', 'cada pago = para todos / 5'),
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
