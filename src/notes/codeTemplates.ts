/**
 * Modelos para programadores, no formato de lições curtas (estilo SoloLearn), mas como nota:
 * explicação em destaque, código que roda com ▶ e um desafio para praticar.
 */
import type { Block, Lang } from '../lib/types';

type B = Block extends infer T ? (T extends Block ? Omit<T, 'id'> : never) : never;
type L3 = Record<Lang, string>;

export interface CodeTemplate {
  id: string;
  icon: string;
  color: string;
  title: L3;
  desc: L3;
  blocks: (lang: Lang) => B[];
}

const tip = (text: string, color = '#6366f1', icon = 'Lightbulb'): B => ({ type: 'callout', text, color, icon });
const h = (text: string, level: 1 | 2 | 3 = 2): B => ({ type: 'heading', text, level });
const code = (lang: string, src: string, title?: string, stdin?: string): B => ({ type: 'code', lang, code: src, title, stdin });
const pick = (l: Lang, m: L3) => m[l];

export const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: 'py-basics',
    icon: 'Braces',
    color: '#3b82f6',
    title: { pt: 'Python: primeiros passos', en: 'Python: first steps', es: 'Python: primeros pasos' },
    desc: { pt: 'Variáveis, input, listas e laços — roda no celular, offline', en: 'Variables, input, lists and loops — runs on your phone, offline', es: 'Variables, input, listas y bucles — funciona en el móvil, sin conexión' },
    blocks: (l) => [
      tip(pick(l, { pt: 'Toque em ▶ Rodar (ou Ctrl+Enter) para executar. O que o programa pede com input() vem da caixa “Entrada”, uma linha por vez.', en: 'Tap ▶ Run (or Ctrl+Enter). Whatever the program asks with input() comes from the “Input” box, one line at a time.', es: 'Toca ▶ Ejecutar (o Ctrl+Enter). Lo que el programa pide con input() viene de la caja “Entrada”, una línea por vez.' })),
      h(pick(l, { pt: '1. Variáveis e texto', en: '1. Variables and text', es: '1. Variables y texto' })),
      code('python', 'nome = input("Como você se chama? ")\nidade = int(input("Idade? "))\nprint(f"Olá, {nome}! Daqui a 10 anos você terá {idade + 10}.")\n', undefined, 'Bruno\n30'),
      h(pick(l, { pt: '2. Listas e laços', en: '2. Lists and loops', es: '2. Listas y bucles' })),
      code('python', 'compras = {"arroz": 27.90, "café": 18.90, "pão": 12.50}\ntotal = 0\nfor item, preco in compras.items():\n    print(f"{item:<8} R$ {preco:>6.2f}")\n    total += preco\nprint("-" * 18)\nprint(f"{\'total\':<8} R$ {total:>6.2f}")\n'),
      tip(pick(l, { pt: 'Desafio: acrescente “leite” por R$ 4,99 e mostre também a média dos preços.', en: 'Challenge: add “milk” for $4.99 and also print the average price.', es: 'Desafío: agrega “leche” por € 1,20 y muestra también el precio promedio.' }), '#f59e0b', 'Target'),
      code('python', '# seu código aqui\n'),
    ],
  },
  {
    id: 'js-basics',
    icon: 'FileCode',
    color: '#eab308',
    title: { pt: 'JavaScript: fundamentos', en: 'JavaScript: fundamentals', es: 'JavaScript: fundamentos' },
    desc: { pt: 'Funções, arrays, objetos e async', en: 'Functions, arrays, objects and async', es: 'Funciones, arrays, objetos y async' },
    blocks: (l) => [
      tip(pick(l, { pt: 'console.log mostra no terminal. O último valor com return aparece com “←”.', en: 'console.log prints to the terminal. A final return value shows with “←”.', es: 'console.log imprime en el terminal. El valor final con return aparece con “←”.' })),
      h(pick(l, { pt: '1. Funções e arrays', en: '1. Functions and arrays', es: '1. Funciones y arrays' })),
      code('javascript', 'const precos = [27.9, 18.9, 12.5, 4.99];\nconst dobro = (x) => x * 2;\nconst caros = precos.filter((p) => p > 15);\nconsole.log("dobro:", precos.map(dobro));\nconsole.log("caros:", caros);\nreturn precos.reduce((s, p) => s + p, 0).toFixed(2);\n'),
      h(pick(l, { pt: '2. Objetos e async', en: '2. Objects and async', es: '2. Objetos y async' })),
      code('javascript', 'const espera = (ms) => new Promise((r) => setTimeout(r, ms));\nconst pessoa = { nome: "Ana", idade: 28 };\nconsole.log(`Olá, ${pessoa.nome}!`);\nawait espera(300);\nconsole.log("…300 ms depois", { ...pessoa, idade: pessoa.idade + 1 });\n'),
      tip(pick(l, { pt: 'Desafio: escreva uma função que conte quantas vogais tem uma frase.', en: 'Challenge: write a function that counts the vowels in a sentence.', es: 'Desafío: escribe una función que cuente las vocales de una frase.' }), '#f59e0b', 'Target'),
      code('javascript', 'function vogais(frase) {\n  // seu código aqui\n}\nconsole.log(vogais("Gestão Cultural Pro"));\n'),
    ],
  },
  {
    id: 'sql-practice',
    icon: 'Database',
    color: '#06b6d4',
    title: { pt: 'SQL na prática', en: 'SQL in practice', es: 'SQL en la práctica' },
    desc: { pt: 'Tabelas, filtros, agrupamentos e JOIN (SQLite)', en: 'Tables, filters, grouping and JOIN (SQLite)', es: 'Tablas, filtros, agrupaciones y JOIN (SQLite)' },
    blocks: (l) => [
      tip(pick(l, { pt: 'Cada bloco cria um banco SQLite novo na memória: monte as tabelas e consulte no mesmo bloco.', en: 'Each block creates a fresh in-memory SQLite database: create tables and query in the same block.', es: 'Cada bloque crea una base SQLite nueva en memoria: crea tablas y consulta en el mismo bloque.' })),
      code('sql', "CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT, cidade TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INT, valor REAL, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana','BH'),(2,'Bruno','SP'),(3,'Carla','BH');\nINSERT INTO pedidos VALUES (1,1,120,'2026-11-01'),(2,1,80,'2026-11-10'),(3,2,300,'2026-11-12'),(4,3,45,'2026-11-20');\n\n-- total por cliente\nSELECT c.nome, c.cidade, COUNT(p.id) AS pedidos, SUM(p.valor) AS total\nFROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id\nGROUP BY c.id ORDER BY total DESC;\n", pick(l, { pt: 'JOIN e GROUP BY', en: 'JOIN and GROUP BY', es: 'JOIN y GROUP BY' })),
      tip(pick(l, { pt: 'Desafio: liste só as cidades com faturamento acima de R$ 150 (dica: HAVING).', en: 'Challenge: list only cities with revenue above 150 (hint: HAVING).', es: 'Desafío: lista solo las ciudades con facturación mayor a 150 (pista: HAVING).' }), '#f59e0b', 'Target'),
    ],
  },
  {
    id: 'algorithms',
    icon: 'Workflow',
    color: '#8b5cf6',
    title: { pt: 'Algoritmos clássicos', en: 'Classic algorithms', es: 'Algoritmos clásicos' },
    desc: { pt: 'FizzBuzz, Fibonacci, busca binária e ordenação', en: 'FizzBuzz, Fibonacci, binary search and sorting', es: 'FizzBuzz, Fibonacci, búsqueda binaria y ordenación' },
    blocks: () => [
      code('python', 'for n in range(1, 16):\n    print("FizzBuzz" if n % 15 == 0 else "Fizz" if n % 3 == 0 else "Buzz" if n % 5 == 0 else n)\n', 'FizzBuzz'),
      code('python', 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint([fib(i) for i in range(12)])\n', 'Fibonacci'),
      code('javascript', 'function buscaBinaria(arr, alvo) {\n  let ini = 0, fim = arr.length - 1;\n  while (ini <= fim) {\n    const meio = (ini + fim) >> 1;\n    if (arr[meio] === alvo) return meio;\n    arr[meio] < alvo ? (ini = meio + 1) : (fim = meio - 1);\n  }\n  return -1;\n}\nconsole.log(buscaBinaria([1, 3, 5, 7, 9, 11], 7));\n', 'Busca binária'),
      code('python', 'def quicksort(xs):\n    if len(xs) <= 1:\n        return xs\n    p, *resto = xs\n    return quicksort([x for x in resto if x < p]) + [p] + quicksort([x for x in resto if x >= p])\n\nprint(quicksort([5, 2, 9, 1, 5, 6]))\n', 'Quicksort'),
    ],
  },
  {
    id: 'web-page',
    icon: 'PanelsTopLeft',
    color: '#ec4899',
    title: { pt: 'HTML e CSS: primeira página', en: 'HTML & CSS: first page', es: 'HTML y CSS: primera página' },
    desc: { pt: 'Monte e veja a página na hora, com console', en: 'Build and preview the page instantly, with console', es: 'Arma y ve la página al instante, con consola' },
    blocks: (l) => [
      tip(pick(l, { pt: '▶ Rodar mostra a página logo abaixo; console.log aparece no terminal.', en: '▶ Run shows the page right below; console.log goes to the terminal.', es: '▶ Ejecutar muestra la página debajo; console.log va al terminal.' })),
      code('html', '<main class="card">\n  <h1>Meu cartão</h1>\n  <p>Feito no GCP-Calc ✨</p>\n  <button onclick="curtir()">❤ Curtir <b id="n">0</b></button>\n</main>\n\n<style>\n  body { font-family: system-ui; background: #0f172a; display: grid; place-items: center; height: 100vh; margin: 0 }\n  .card { background: white; padding: 24px 32px; border-radius: 18px; text-align: center }\n  h1 { margin: 0 0 6px; color: #6366f1 }\n  button { border: 0; background: #ec4899; color: white; padding: 8px 16px; border-radius: 999px; cursor: pointer }\n</style>\n<script>\n  let n = 0;\n  function curtir() { document.getElementById("n").textContent = ++n; console.log("curtidas:", n); }\n</script>\n'),
    ],
  },
  {
    id: 'ts-types',
    icon: 'FileType',
    color: '#2563eb',
    title: { pt: 'TypeScript: tipos na prática', en: 'TypeScript: types in practice', es: 'TypeScript: tipos en la práctica' },
    desc: { pt: 'Interfaces, union types e generics', en: 'Interfaces, union types and generics', es: 'Interfaces, union types y generics' },
    blocks: () => [
      code('typescript', 'type Tipo = "receita" | "despesa";\ninterface Lancamento { nome: string; valor: number; tipo: Tipo }\n\nconst itens: Lancamento[] = [\n  { nome: "Salário", valor: 3000, tipo: "receita" },\n  { nome: "Aluguel", valor: 1200, tipo: "despesa" },\n  { nome: "Mercado", valor: 650, tipo: "despesa" },\n];\n\nfunction somar<T>(xs: T[], f: (x: T) => number): number {\n  return xs.reduce((s, x) => s + f(x), 0);\n}\nconst saldo = somar(itens, (i) => (i.tipo === "receita" ? i.valor : -i.valor));\nconsole.log(`Saldo: ${saldo}`);\n'),
    ],
  },
  {
    id: 'c-native',
    icon: 'Cpu',
    color: '#64748b',
    title: { pt: 'C, Go e Rust no computador', en: 'C, Go and Rust on desktop', es: 'C, Go y Rust en el ordenador' },
    desc: { pt: 'Usa os compiladores instalados (gcc, go, rustc)', en: 'Uses your installed compilers (gcc, go, rustc)', es: 'Usa los compiladores instalados (gcc, go, rustc)' },
    blocks: (l) => [
      tip(pick(l, { pt: 'Estas linguagens rodam com o compilador instalado no seu computador (Windows, macOS ou Linux). Se faltar algum, o terminal avisa qual instalar.', en: 'These languages run with the compiler installed on your computer. If one is missing, the terminal tells you what to install.', es: 'Estos lenguajes se ejecutan con el compilador instalado en tu ordenador. Si falta alguno, el terminal te dice cuál instalar.' }), '#64748b', 'Cpu'),
      code('c', '#include <stdio.h>\n\nint main(void) {\n    double precos[] = {27.9, 18.9, 12.5};\n    double total = 0;\n    for (int i = 0; i < 3; i++) total += precos[i];\n    printf("Total: %.2f\\n", total);\n    return 0;\n}\n', 'C'),
      code('go', 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfor i := 1; i <= 3; i++ {\n\t\tfmt.Printf("Go %d\\n", i)\n\t}\n}\n', 'Go'),
      code('rust', 'fn main() {\n    let v = vec![27.9, 18.9, 12.5];\n    let total: f64 = v.iter().sum();\n    println!("Total: {:.2}", total);\n}\n', 'Rust'),
    ],
  },
];
