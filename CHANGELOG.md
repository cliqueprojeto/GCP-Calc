# Changelog

## 1.4.0 — seções, moeda automática, modelos compartilháveis e relatórios

### Cálculo como num editor de código
- **Seções com `#`**: `#Receitas` abre uma seção e tudo abaixo dela entra na soma até a próxima `#`. Em qualquer conta, `#Receitas` vale a soma da seção: `Total #Receitas`, `#Receitas - #Despesas` (despesas lançadas como negativas ou positivas são descontadas) e `Sobra %` (sobra em % das receitas).
- **Moeda pelo contexto**: `Flora: 2.000` numa seção em reais vira **R$ 2.000,00**. Quantidades (`pessoas: 2`, `dias: 8`) continuam números e ficam fora das somas.
- **Separadores automáticos**: ao digitar um valor em dinheiro, o ponto ou a vírgula de milhar entra sozinho, conforme o idioma e a configuração.
- **Enter formata a linha**: `R$ 4000` vira `R$ 4.000,00`, negativos ficam `-R$ 100,00` e contas com `=` ou `:` no fim recebem o resultado.
- **Autocompletar**: variáveis (com o valor), `#seções`, funções e palavras-chave enquanto você digita (↑↓, Enter/Tab, Esc).
- **Receitas em verde, despesas em vermelho**, no texto e nos resultados.
- **Organizar**: um botão no bloco separa os lançamentos em receitas e despesas, coloca a moeda, soma cada seção e calcula saldo e saldo %, com prévia antes × depois e revisão opcional pela IA.

### Modelos
- **Crie seus modelos** a partir de qualquer nota, com nome, descrição, ícone e cor.
- **Compartilhe e importe**: código de texto (`GCPCALC1:…`) ou arquivo `.gcptpl`, com prévia antes de adicionar. Os modelos sincronizam pelo Google Drive.
- **Novos modelos prontos**: Lista de compras, Gastos com pets, Dividir a conta, Viagem de carro, Churrasco e festa, Parcelado ou à vista?, Meta de economia e Volta às aulas. O Orçamento do mês agora usa seções.

### Relatórios comparativos (BI)
- Novo bloco **Relatório comparativo**: compara notas salvas lado a lado (ex.: orçamento do mês passado × este mês), com totais das seções, lançamentos e saldo, variação em valor e %, barras por coluna e cores de melhora/piora. Entra nas exportações.

### Visual
- **Novo ícone**: cupom fiscal com selo de calculadora dourado sobre fundo esmeralda, diferente dos outros apps da série.
- Barra de ferramentas do bloco redesenhada (uma pílula só, sem botões soltos sobre a borda).
- Percentuais com até 2 casas.

### Corrigido
- **Cursor preciso** ao tocar ou clicar no texto, inclusive no fim de títulos `#` (o texto colorido tinha negrito e tamanho maior que o texto editável), no computador e no Android.

## 1.3.0 — exportações com o visual da tela

### Novo
- **Imagem PNG (igual à tela)**: uma "foto" exata da nota — tema, fontes, cores da sintaxe e gráficos — sem barras, botões, menus nem o cursor do editor.
- **PDF (igual à tela)**: o mesmo visual da tela, paginado em A4 sem cortar blocos ao meio.

### Melhorado
- **PDF com texto selecionável** agora segue o tema atual: fundo, cartões, coluna de resultados, cores da sintaxe, rodapé Σ e gráficos idênticos aos da tela.
- **Word e PowerPoint** no mesmo estilo da tela e continuam editáveis: cor da página/slide do tema, blocos como cartões, resultados na cor do tema e, no PowerPoint, gráficos nativos com as cores, rótulos e grade da tela.
- Os gráficos exportados usam a mesma paleta e o mesmo desenho da tela (barras arredondadas, valores em cima, legenda com %).

### Corrigido
- Modelo "Viagem internacional": o custo por pessoa agora divide o total da viagem.

## 1.2.0 — IA direto na nota

### Comando `/ia`
- Em qualquer bloco de cálculo, digite `/ia` seguido da pergunta e aperte **Enter**: a IA escreve as linhas do cálculo ali mesmo, já calculadas (ex.: `/ia quanto devo investir por mês para dobrar R$ 500?`).
- Se faltar um dado essencial, o assistente abre com a pergunta da IA em botões e, ao responder, o cálculo entra na nota.

### Assistente mais claro
- A tela inicial explica as duas formas de usar: **perguntar à IA** (com exemplos clicáveis) ou escolher um **assistente guiado** (sem IA, funciona offline).
- Cada assistente guiado mostra uma descrição do que calcula.

### IA mais confiável
- Quando o provedor responde "sobrecarregado" (erros 503, 429, 529), o app tenta de novo sozinho e, se necessário, usa outro modelo do mesmo provedor ou outro provedor configurado.
- Mensagem de erro mais clara, com o que fazer.

## 1.1.0 — exportação premium

Agora cada nota pode ser exportada (menu **⋯ → Exportar**) com todos os elementos gráficos:

- **PDF** com texto selecionável: fontes embutidas, sintaxe colorida, resultados alinhados, totais destacados, gráficos, destaques, metas, cotações, imagens e adesivos, com numeração de páginas.
- **Word (.docx) editável**: cada bloco de cálculo vira uma tabela (expressão colorida | resultado); destaques, metas e cotações como tabelas sombreadas; gráficos e imagens como figuras.
- **PowerPoint (.pptx) editável**: capa, um slide por seção com tabela nativa e **gráficos nativos do PowerPoint** (dá para editar dados e estilo), destaques, metas e cotações como formas.
- **Excel (.xlsx) organizado de forma inteligente**:
  - cada linha vira um registro com seção, descrição (rótulo, variável ou o texto da linha), expressão original, valor, unidade e tipo;
  - valores com formato de moeda, porcentagem ou data;
  - `total` e `média` viram fórmulas `SUM`/`AVERAGE`;
  - variáveis e rótulos viram **nomes definidos**, e expressões simples viram **fórmulas vivas** (ex.: `=renda-despesas`), conferidas com o resultado do app;
  - metas com "% atingido" calculado e tabela de dados de cada gráfico ao lado, pronta para inserir um gráfico;
  - filtros, painel congelado e impressão ajustada à página.
- **Excel com todas as notas**: uma aba por nota e uma aba de resumo com links.

## 1.0.1

### Visual mais limpo

- Novo ícone do aplicativo em cores sólidas, sem gradiente e sem a estrela de brilho.
- Botões, barras de progresso, divisores, selos e fundos agora usam cores sólidas — sem gradientes fortes nem brilhos de fundo.
- Ícones de brilho e de varinha mágica substituídos por ícones neutros (calculadora, lista de passos, lâmpada). A nota de boas-vindas já instalada é ajustada automaticamente.

### Cálculos

- Resultados com até 4 casas decimais por padrão (ex.: `5 km em milhas` → `3,1069 mi`). Ajustável em Configurações → Cálculo.

## 1.0.0

Calculadora em notas para Linux, Windows, macOS e Android.

### Destaques

- Cálculos em linguagem natural em **português, inglês e espanhol**, com separadores decimais do seu idioma.
- **Moedas e criptomoedas ao vivo**, atualizadas ao abrir o app e quando você pedir, e **tags personalizadas** (apelidos e moedas próprias).
- **Conversor de unidades** com 14 grandezas e unidades compostas.
- Porcentagens, variáveis, rótulos, funções próprias, `total`/`média`/`prev`, datas, financiamento (`pmt`), investimentos (`fv`), hexadecimal e binário.
- Notas com **nome, cor e ícone** (1.500+ ícones e emojis), pastas, fixadas, lixeira e busca rápida (`Ctrl+K`).
- **Elementos gráficos**: gráficos dos próprios cálculos, metas com progresso, painel de cotações, destaques, imagens, adesivos, títulos e divisores.
- **Assistente passo a passo** com botões contextuais — 11 assistentes offline e IA opcional (Anthropic, OpenAI, Gemini, Mistral, Groq, DeepSeek, xAI, OpenRouter, Ollama…).
- Temas premium, **paletas de editores de código no estilo Omarchy** e **cores da sintaxe configuráveis** por tema.
- **Backup e sincronização criptografados no Google Drive** e backup em arquivo `.gcpcalc`.
- **Atualizações direto das releases do GitHub**, com conferência de SHA-256.

### Downloads

| Sistema | Arquivo |
|---|---|
| Debian/Ubuntu | `gcp-calc_1.0.0_amd64.deb` |
| Fedora/openSUSE | `gcp-calc-1.0.0-1.x86_64.rpm` |
| Arch/BigLinux/Omarchy | `gcp-calc-bin-1.0.0-1-x86_64.pkg.tar.zst` |
| Windows | `GCP-Calc-1.0.0-Windows-x64-Setup.exe` |
| macOS Apple Silicon | `GCP-Calc-1.0.0-macOS-arm64.dmg` |
| macOS Intel | `GCP-Calc-1.0.0-macOS-x86_64.dmg` |
| Android | `GCP-Calc-1.0.0-Android.apk` |

Desenvolvido por **Bruno Albertini** | [Gestão Cultural Pro](https://gestaoculturalpro.com.br)
