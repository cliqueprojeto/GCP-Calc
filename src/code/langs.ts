/** Linguagens do playground: como colorir, como rodar e um exemplo para começar. */
export type CodeLang = 'javascript' | 'typescript' | 'python' | 'sql' | 'html' | 'json' | 'bash' | 'powershell' | 'c' | 'cpp' | 'go' | 'rust' | 'java' | 'ruby' | 'php';

export interface LangMeta {
  id: CodeLang;
  name: string;
  /** gramática do Prism */
  prism: string;
  /** onde roda: embutido em todos os aparelhos ou com o compilador instalado no computador */
  runtime: 'js' | 'python' | 'sql' | 'html' | 'json' | 'native';
  comment: string;
  indent: string;
  hello: string;
}

export const LANGS: LangMeta[] = [
  { id: 'python', name: 'Python', prism: 'python', runtime: 'python', comment: '#', indent: '    ', hello: 'nome = input() or "mundo"\nprint(f"Olá, {nome}!")\n\nfor i in range(1, 6):\n    print(i, "→", i ** 2)\n' },
  { id: 'javascript', name: 'JavaScript', prism: 'javascript', runtime: 'js', comment: '//', indent: '  ', hello: 'const nomes = ["Ana", "Bruno", "Carla"];\nfor (const n of nomes) console.log(`Olá, ${n}!`);\n\nconst dobro = (x) => x * 2;\nconsole.log([1, 2, 3].map(dobro));\n' },
  { id: 'typescript', name: 'TypeScript', prism: 'typescript', runtime: 'js', comment: '//', indent: '  ', hello: 'interface Item { nome: string; preco: number }\n\nconst itens: Item[] = [\n  { nome: "Café", preco: 18.9 },\n  { nome: "Pão", preco: 12.5 },\n];\nconst total = itens.reduce((s, i) => s + i.preco, 0);\nconsole.log(`Total: R$ ${total.toFixed(2)}`);\n' },
  { id: 'sql', name: 'SQL (SQLite)', prism: 'sql', runtime: 'sql', comment: '--', indent: '  ', hello: "CREATE TABLE gastos (item TEXT, valor REAL, tipo TEXT);\nINSERT INTO gastos VALUES\n  ('Aluguel', 1800, 'casa'), ('Mercado', 950, 'casa'), ('Cinema', 60, 'lazer');\n\nSELECT tipo, COUNT(*) AS itens, SUM(valor) AS total\nFROM gastos GROUP BY tipo ORDER BY total DESC;\n" },
  { id: 'html', name: 'HTML/CSS/JS', prism: 'markup', runtime: 'html', comment: '<!--', indent: '  ', hello: '<h1>Olá!</h1>\n<button onclick="contar()">Clique</button> <span id="n">0</span>\n\n<style>\n  body { font-family: system-ui; padding: 16px }\n  h1 { color: #10b981 }\n</style>\n<script>\n  let n = 0;\n  function contar() { document.getElementById("n").textContent = ++n; console.log("cliques:", n); }\n</script>\n' },
  { id: 'json', name: 'JSON', prism: 'json', runtime: 'json', comment: '', indent: '  ', hello: '{\n  "nome": "GCP-Calc",\n  "versao": 1.6,\n  "recursos": ["notas", "código", "lembretes"]\n}\n' },
  { id: 'bash', name: 'Bash / Shell', prism: 'bash', runtime: 'native', comment: '#', indent: '  ', hello: 'echo "Olá do terminal!"\nfor i in 1 2 3; do\n  echo "linha $i"\ndone\ndate\n' },
  { id: 'powershell', name: 'PowerShell', prism: 'powershell', runtime: 'native', comment: '#', indent: '    ', hello: 'Write-Output "Olá do PowerShell!"\n1..3 | ForEach-Object { "linha $_" }\nGet-Date\n' },
  { id: 'c', name: 'C', prism: 'c', runtime: 'native', comment: '//', indent: '    ', hello: '#include <stdio.h>\n\nint main(void) {\n    for (int i = 1; i <= 5; i++)\n        printf("%d ao quadrado = %d\\n", i, i * i);\n    return 0;\n}\n' },
  { id: 'cpp', name: 'C++', prism: 'cpp', runtime: 'native', comment: '//', indent: '    ', hello: '#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> v{3, 1, 2};\n    for (int x : v) std::cout << x * 10 << "\\n";\n}\n' },
  { id: 'go', name: 'Go', prism: 'go', runtime: 'native', comment: '//', indent: '\t', hello: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfor i := 1; i <= 3; i++ {\n\t\tfmt.Println("Olá", i)\n\t}\n}\n' },
  { id: 'rust', name: 'Rust', prism: 'rust', runtime: 'native', comment: '//', indent: '    ', hello: 'fn main() {\n    let v = vec![1, 2, 3];\n    let total: i32 = v.iter().sum();\n    println!("total = {}", total);\n}\n' },
  { id: 'java', name: 'Java', prism: 'java', runtime: 'native', comment: '//', indent: '    ', hello: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Olá do Java!");\n    }\n}\n' },
  { id: 'ruby', name: 'Ruby', prism: 'ruby', runtime: 'native', comment: '#', indent: '  ', hello: '%w[Ana Bruno Carla].each { |n| puts "Olá, #{n}!" }\n' },
  { id: 'php', name: 'PHP', prism: 'php', runtime: 'native', comment: '//', indent: '    ', hello: '<?php\n$itens = ["café" => 18.9, "pão" => 12.5];\nforeach ($itens as $n => $p) echo "$n: R$ " . number_format($p, 2, ",", ".") . "\\n";\n' },
];

export const langMeta = (id: string) => LANGS.find((l) => l.id === id) ?? LANGS[0];
