/**
 * Vocabulário de receitas e despesas (pt, en, es), com singular/plural, verbos e expressões.
 * Usado para colorir e classificar seções (#…), organizar blocos, ditados e pedidos à IA.
 * As palavras estão sem acento; a comparação ignora acentos e maiúsculas.
 */
export type Kind = 'income' | 'expense';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** expressões que decidem sozinhas (vêm antes das palavras soltas) */
const PHRASES: [string, Kind][] = [
  ['prestacao de servico', 'income'], ['prestacoes de servico', 'income'], ['servico prestado', 'income'], ['servicos prestados', 'income'],
  ['aluguel recebido', 'income'], ['alugueis recebidos', 'income'], ['pix recebido', 'income'], ['transferencia recebida', 'income'], ['pagamento recebido', 'income'], ['juros recebidos', 'income'],
  ['doacao recebida', 'income'], ['contas a receber', 'income'], ['a receber', 'income'], ['dinheiro que entrou', 'income'], ['entrada de dinheiro', 'income'],
  ['pix enviado', 'expense'], ['transferencia enviada', 'expense'], ['contas a pagar', 'expense'], ['a pagar', 'expense'], ['saida de dinheiro', 'expense'], ['juros pagos', 'expense'],
  ['payment received', 'income'], ['money in', 'income'], ['accounts receivable', 'income'], ['money out', 'expense'], ['accounts payable', 'expense'],
  ['cartao de credito', 'expense'], ['cartoes de credito', 'expense'], ['credit card', 'expense'], ['tarjeta de credito', 'expense'],
  ['pago recibido', 'income'], ['cuentas por cobrar', 'income'], ['cuentas por pagar', 'expense'],
];

/** começos de palavra (radicais): "receit" pega receita, receitas… */
const STEMS: Record<Kind, string[]> = {
  income: [
    // pt
    'receit', 'renda', 'rendiment', 'ganho', 'ganhei', 'ganha', 'recebi', 'recebe', 'recebiment', 'recebid', 'recebiv', 'entrada', 'entrou', 'venda', 'vendi', 'vendid', 'vendem',
    'lucro', 'lucrat', 'lucrei', 'faturament', 'faturei', 'salari', 'honorari', 'provento', 'freela', 'freelanc', 'cache', 'bonus', 'bonific', 'comissa', 'comissoe', 'gorjet',
    'premio', 'premiac', 'dividend', 'restituic', 'reembols', 'patrocin', 'captac', 'credito', 'creditad', 'deposito', 'aposentad', 'pensao', 'beneficio', 'superavit', 'royalt', 'mesada',
    // en
    'income', 'revenue', 'earning', 'earned', 'receiv', 'profit', 'salar', 'wage', 'commission', 'refund', 'reimburs', 'sponsor', 'inflow', 'payout', 'paycheck',
    // es
    'ingreso', 'ganancia', 'gane', 'cobro', 'cobre', 'cobranz', 'venta', 'sueldo', 'utilidad', 'aguinaldo', 'propina', 'reembolso',
  ],
  expense: [
    // pt
    'despes', 'gasto', 'gastei', 'gasta', 'compra', 'comprei', 'dispendi', 'debito', 'debitad', 'pagament', 'paguei', 'saida', 'saiu', 'custo', 'custei', 'conta', 'boleto',
    'divida', 'emprestim', 'financiament', 'parcela', 'prestacao', 'prestacoes', 'imposto', 'tribut', 'taxa', 'tarifa', 'multa', 'mensalidade', 'assinatura', 'aluguel', 'alugueis',
    'condominio', 'mercado', 'supermercado', 'feira', 'farmacia', 'remedio', 'combustiv', 'gasolina', 'transporte', 'alimentac', 'restaurante', 'lazer', 'manutenc', 'reforma',
    'perda', 'prejuizo', 'deficit', 'desembols', 'encargo', 'saque', 'sacado', 'gastos', 'obrigac', 'consumo',
    // en
    'expens', 'spend', 'spent', 'purchas', 'bought', 'debit', 'payment', 'outflow', 'installment', 'subscription', 'grocer', 'withdraw',
    // es
    'egreso', 'compre', 'pago', 'pague', 'costo', 'coste', 'factura', 'cuenta', 'deuda', 'prestamo', 'cuota', 'impuesto', 'tasa', 'alquiler', 'suscripcion', 'perdida', 'retiro', 'salida',
  ],
};

/** palavras curtas: só valem inteiras (para "tip" não pegar "tipo") */
const EXACT: Record<Kind, string[]> = {
  income: ['earn', 'earns', 'sale', 'sales', 'sold', 'tip', 'tips', 'grant', 'grants', 'pix'],
  expense: ['fatura', 'faturas', 'cost', 'costs', 'buy', 'bill', 'bills', 'paid', 'pay', 'fee', 'fees', 'tax', 'taxes', 'rent', 'loan', 'loans', 'loss', 'charge', 'charges'],
};

/** Receita ou despesa pelo texto (nome da seção, rótulo do lançamento ou frase falada). */
export function classifyTerm(text: string): Kind | undefined {
  const f = ' ' + fold(text).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  if (f.trim() === '') return undefined;
  for (const [p, k] of PHRASES) if (f.includes(' ' + p + ' ') || f.includes(' ' + p)) return k;
  const words = f.trim().split(' ');
  let inc = 0;
  let exp = 0;
  words.forEach((w, i) => {
    const weight = i === 0 ? 2 : 1; // a primeira palavra pesa mais ("Receitas de março", "Gastos fixos")
    if (EXACT.income.includes(w) || STEMS.income.some((s) => w.startsWith(s))) inc += weight;
    if (EXACT.expense.includes(w) || STEMS.expense.some((s) => w.startsWith(s))) exp += weight;
  });
  if (inc === exp) return undefined;
  return inc > exp ? 'income' : 'expense';
}
