# Changelog

## 1.11.1 — correção do microfone no Android

- **Corrigido:** tocar no microfone podia fechar o app no Android (“GCP-Calc apresenta falhas continuamente”). A tela de voz carregava de imediato o modelo de transcrição offline, que usa bastante memória, e em alguns celulares o Android fechava o app.
  - No celular, o modelo offline **não é mais pré-carregado** ao abrir a tela de voz: ele só carrega na hora de transcrever.
  - Com uma IA configurada, o celular usa a **IA primeiro** e o modelo offline só como alternativa.
  - Em celulares com **pouca memória** (menos de 4 GB), a transcrição offline fica desligada automaticamente.
  - Se mesmo assim faltar memória, o app **reabre sozinho** (em vez de fechar com erro), desliga a transcrição offline naquele aparelho e avisa — dá para religar na tela de voz.

## 1.11.0 — iPhone e iPad, teclado do sistema, microfone que você posiciona e Google Drive mais fácil

### iPhone e iPad
- **App web para iPhone e iPad**: abra <https://cliqueprojeto.github.io/GCP-Calc/> no Safari → **Compartilhar → Adicionar à Tela de Início**. Abre em tela cheia, funciona sem internet depois da primeira vez e se atualiza sozinho — sem App Store, sem conta da Apple, sem permissões especiais.
- **App nativo (.ipa)** para quem prefere instalar: cada versão traz o arquivo para iPhone/iPad, que pode ser instalado com Sideloadly ou AltStore usando o seu Apple ID gratuito.
- Guia completo em [docs/IOS.md](https://github.com/cliqueprojeto/GCP-Calc/blob/main/docs/IOS.md), incluindo como liberar o app no **Mac** na primeira abertura (em ** → Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**, ou com um comando no Terminal).

### Android: teclado e microfone
- O **teclado do sistema** (Google) passa a ser o padrão: o teclado de operadores do app não aparece mais por cima dele. Quem quiser pode religar em *Configurações → Geral → Teclado de operadores*.
- O **botão do microfone** fica **acima do teclado** e pode ser **arrastado para qualquer lugar da tela** — a posição fica guardada. Para voltar ao canto: *Configurações → Geral → Restaurar posição do microfone*.

### Google Drive mais fácil
- Novo bloco **Configurar o Google Drive** logo abaixo do botão Conectar, mostrando se já está pronto.
- **Importar JSON do Google**: escolha o arquivo `client_secret_….json` baixado do Google Cloud — nada de digitar Client ID e segredo (a digitação manual continua disponível).
- **Guia passo a passo** dentro do app, com links diretos para cada tela do Google Cloud, as armadilhas mais comuns (tipo “App para computador”, usuários de teste, publicar o app) e soluções para cada erro. O mesmo guia está em [docs/CLOUD-SETUP.md](https://github.com/cliqueprojeto/GCP-Calc/blob/main/docs/CLOUD-SETUP.md).

## 1.10.0 — emojis perfeitos, ditado sem duplicar, lembretes que entram na conta e subtotais

### Emojis no editor
- Emojis compostos aparecem inteiros: bandeiras (🇧🇷), famílias (👨‍👩‍👧), tons de pele (👍🏽), teclas (1️⃣) e símbolos com variação (❤️, 🏷️). Antes, fora dos rótulos, eles podiam aparecer “quebrados” (quadradinhos ou pedaços), principalmente no Linux e no Android.
- Linhas com bandeira no começo (`🇧🇷 Viagem: R$ 900`) também viram rótulo e variável.

### Ditado e organização sem itens repetidos
- O que já está no bloco não entra de novo: ao transcrever e inserir, só os itens novos são acrescentados, na seção certa, abaixo do último lançamento. O aviso mostra quantos já estavam no bloco.
- A IA recebe a instrução de devolver somente os itens novos do ditado.
- O **Organizar** não repete nada e, sem título, coloca compras e contas em despesas (só salário, vendas, cachê recebido etc. vão para receitas).

### Lembretes: pago, recebido e direto no bloco
- Cada lembrete é **Despesa (a pagar)** ou **Receita (a receber)** — dá para programar recebimentos (salário, cachê, cliente, aluguel recebido).
- Ao marcar **Pago** ou **Recebido**, o valor entra no bloco da nota ligada, na seção de despesas ou de receitas, e passa a contar nos totais, no saldo e nas fórmulas: `Internet novembro: R$ 120,00 // ✓ pago 27/11/2026`.
- Se o lembrete nasceu de uma linha da nota (`Luz: R$ 150 vence 10/12`), essa linha é marcada como paga em vez de ser duplicada.
- Painel com **A receber no mês** separado do que há **a pagar**; avisos próprios para recebimentos (“A receber hoje”, “Recebimento atrasado”).

### Subtotal e atalhos de totais
- **Subtotal** soma só o grupo — do título ou do subtotal anterior até ali —, para quebrar uma seção em partes; `Total #Seção` continua somando a seção inteira.
- Novos atalhos: `Total a pagar`, `Total a receber`, `Total pago`, `Total recebido`, `Subtotal #Receitas`, `Subtotal #Despesas`, `Lucro`, `Prejuízo`, `Superávit`, `Déficit`, `Saldo do mês`, `Resultado final` (também em inglês e espanhol).
- Todos aparecem no autocompletar e no menu “/”.

## 1.9.0 — previsto × realizado, importar planilhas e PDFs, totais mais inteligentes

### Previsto × Realizado
- Escreva o previsto e o realizado na mesma linha: `Cachê: R$ 5.000 | R$ 4.200` (ou `Cachê: previsto R$ 5.000 realizado R$ 4.200`). A linha mostra o realizado e um selo com o **% executado** — verde ao completar, vermelho quando estoura o previsto. Passe o mouse para ver o previsto e o saldo.
- Subseções: `## Equipe` dentro de `# Despesas` herda o tipo (despesa) e soma também na seção-mãe, como as rubricas e grupos de uma prestação de contas.
- Linhas prontas: `Previsto #Despesas`, `Realizado #Despesas`, `Saldo a executar #Equipe`, `% Executado`, `% A executar` e `Saldo`.
- **BI**: o bloco de relatório ganhou o modo **Previsto × Realizado**, com previsto, realizado, saldo e % executado por seção, subseção e lançamento, barras comparativas e o resultado (receitas − despesas).
- Novo modelo **Previsto × Realizado** com dados fictícios de exemplo (receitas por fonte e despesas por grupo de rubricas).

### Importar planilhas e documentos
- No **+** de qualquer nota: **Importar planilha / PDF** — Excel (.xlsx), CSV, TXT, Markdown e PDF.
- Reconhece etapas e grupos (Pré-produção, Produção, “Grupo 1 – Comunicação”…), o cabeçalho da tabela (despesa, quantidade, unidade, valor unitário, total, meta/realizado), ignora as linhas de total e resumo e junta as linhas quebradas dos PDFs.
- Gera seções `# Despesas` / `## Etapa`, lançamentos com quantidade × valor (`R$ 2.000 * 10 meses`), previsto | realizado quando houver as duas colunas, totais e saldo.
- Prévia calculada (e texto editável) antes de **inserir como bloco** ou **criar uma nova nota**.

### Totais e linguagem natural
- Receitas menos despesas em vários formatos: `#Receitas - #Despesas`, `#Receitas-#Despesas`, `#Receitas - # Despesas`, `#Total (#Receitas - #Despesas)`, `#Total #Receitas - #Despesas`, `#TOTAL` e simplesmente `Saldo`.
- `% Executado` e `% A executar` prontos, a partir das receitas e despesas.
- “Paguei um produtor 10 mil reais em 10 meses” vira `Produtor: R$ 10.000 * 10 meses` = R$ 100.000,00 (também “por 3 vezes”, “durante 6 meses”, “x 12”).
- Rótulos sem dois-pontos (“Incentivo de 100 mil reais”), lançamentos citados com `#` (`#Coordenador * 2`) em contas à parte que não mexem nos totais das seções.
- O autocompletar sugere os atalhos (Saldo, % Executado, % A executar, `Total #Seção`) e os lançamentos da nota com o valor.

### Celular
- O botão de anexar comprovante fica sempre visível ao lado dos valores, maior para o toque.

## 1.8.0 — fórmulas por voz e escrita natural, tutor de programação e transcrição offline mais robusta

### Fórmulas faladas e escritas em linguagem natural
- Um dicionário de pedidos de cálculo entende que a frase **é uma fórmula** (e não um lançamento) e a monta com as seções e variáveis da nota:
  - “faça agora o total de receitas menos despesas” → `Saldo: #Receitas - #Despesas`
  - “total das despesas” → `Total #Despesas` · “média dos gastos” → `Média: média #Gastos` · “qual o maior gasto” → `Maior: maior #Gastos`
  - “dez por cento das receitas” → `10% de #Receitas` · “aluguel vezes doze” → `aluguel * 12` · “divida o saldo por 2” → `saldo / 2`
  - “quanto sobra em porcentagem” → `Sobra em %: (#Receitas - #Despesas) em % de #Receitas`
- Entende sinônimos: “receitas” encontra `#Ganhos`, “despesas” encontra `#Gastos`.
- **Por voz**: lançamentos vão para a seção certa e as fórmulas para o fim do bloco, com prévia calculada antes de inserir.
- **Por escrita**: numa linha digitada com um pedido, o botão **ƒx** transforma a frase na fórmula.
- Novas contas: `média #Seção`, `maior #Seção` e `menor #Seção`.

### Tutor de programação (playground)
- **Explicar**: o código explicado linha a linha, na língua do app.
- **Corrigir o erro**: a causa em palavras simples e a correção para aplicar com um toque.
- **Desafio**: um exercício no seu nível, com enunciado, dica e código inicial, criado logo abaixo.
- **Verificar solução**: roda o seu código, compara com a saída esperada e dá um retorno encorajador.
- Usa a IA configurada (a Groq tem plano gratuito).

### Transcrição offline mais robusta
- O modelo Whisper começa a carregar assim que a tela de voz abre — quando você termina de falar, ele está pronto — e fica carregado durante o uso.
- O áudio do microfone vai direto para a transcrição, sem depender do decodificador de áudio do sistema.
- Progresso com tempo decorrido, aviso de que a primeira vez pode levar 1–2 minutos em alguns aparelhos e, se a transcrição offline não funcionar, uma mensagem clara com o motivo e a opção de usar a IA.

## 1.7.1 — Android com assinatura permanente

- **Android**: o app passa a ser assinado com a chave permanente do GCP-Calc. Instale esta versão uma última vez (desinstalando a anterior, depois de fazer backup das notas) — **a partir daqui, as próximas versões instalam por cima, sem perder nada**.
- Demais plataformas: mesma versão 1.7.0, recompilada.

## 1.7.0 — senha com digital, ditado nas seções certas e correções no Android

### Senha e segurança
- **Senha para abrir o app**, com **código de recuperação** gerado na criação (copiar ou salvar em arquivo) para entrar se esquecer a senha.
- Em **Configurações › Segurança**: pedir ou não a senha ao abrir, **bloquear de novo** depois de alguns minutos fora do app, trocar a senha, gerar novo código e remover a senha.
- **Desbloqueio com a digital** (ou o desbloqueio do celular) no Android.
- A senha nunca é guardada: só um hash PBKDF2 com sal.

### Receitas e despesas mais inteligentes
- Vocabulário ampliado em português, inglês e espanhol, com singular, plural e verbos:
  - **Despesas**: gastos, compras, dispêndios, débitos, pagamentos, custos, contas, boletos, saídas, cartão de crédito, “comprei/paguei/gastei”.
  - **Receitas**: ganhos, recebimentos, vendas, lucro, faturamento, salário, honorários, prestação de serviços, cachê, entradas, “recebi/vendi/ganhei”.
- Vale para as cores e totais das seções `#`, o Organizar, a transcrição e a IA.

### Ditado direto na seção certa
- Ao inserir uma anotação de voz, cada item vai para a **seção que já existe** no bloco — despesas na última linha de `#Despesas` (ou `#Gastos`, `#Compras`…), receitas em `#Receitas` (ou `#Ganhos`…) —, antes do total e sem criar seção repetida.
- “Um/uma” só vira número quando é valor (“um freela” não é mais “1”).

### Correções no Android
- **Permissões**: um único pedido, com o resultado vindo do próprio Android — a tela não reaparece mais e o app não fecha ao conceder.
- **Aviso de atualização** e barra superior cabem na tela em qualquer tamanho e orientação.
- **Anotação de voz**: botões de editar a transcrição e excluir sempre visíveis; tocar em qualquer bloco mostra as ferramentas dele.

## 1.6.0 — playground de código, comprovantes, transcrição offline e contas mais inteligentes

### Contas mais inteligentes (seções #)
- **Variáveis contam nas seções**: em `#receitas`, lançamentos com `=` (`salário = R$ 1.000,00`) entram na soma, como os com `:`. Antes, `total #receitas` dava 0.
- **Nome da seção com ou sem #**: `receitas - despesas`, `saldo = receitas - despesas`, `total #receitas - total #despesas` e `= #receitas - #despesas` dão o mesmo resultado.
- **`total` soma a seção inteira**, mesmo com linhas em branco no meio.
- Percentuais (`taxa = 10%`) e quantidades (`pessoas = 2`) ficam fora dos totais em dinheiro.

### Playground de código
- Novo bloco **Código (playground)**, como um compilador online dentro da nota: editor com cores, números de linha, indentação automática, fechamento de parênteses e aspas, comentar com Ctrl+/.
- **▶ Rodar** (Ctrl+Enter) com terminal, entrada (stdin), tempo de execução e erros claros.
- **Embutidos, offline e no celular**: Python (CPython completo via Pyodide), JavaScript, TypeScript, SQL (SQLite), HTML/CSS/JS com prévia e JSON.
- **No computador**: C, C++, Go, Rust, Java, Ruby, PHP, Bash e PowerShell, usando os compiladores instalados.
- **Lições de programação** (estilo SoloLearn): Python, JavaScript, SQL, algoritmos, HTML/CSS, TypeScript e C/Go/Rust — explicação, código que roda e desafio.
- Botão **Playground de código** na tela inicial.

### Comprovantes
- **Fotografe cupons e notas fiscais** pela câmera do celular, ou anexe fotos e PDFs dos arquivos no computador — vários de uma vez.
- Cada comprovante fica **ligado à linha da despesa** (clipe ao lado do valor), com miniaturas sob o bloco, visualizador ampliado, **baixar** e excluir.
- Os comprovantes entram nas exportações em PDF, Word e PowerPoint.

### Voz
- **Transcrição offline embutida**: Whisper (código aberto) roda dentro do app — sem internet e sem chave de IA —, com opção de **traduzir para o inglês**. A IA configurada continua como alternativa.
- Valores falados por extenso viram números (“vinte e sete reais e noventa centavos” → R$ 27,90).
- No celular, o botão de microfone saiu da frente da digitação: agora fica no **teclado de operadores**, junto com a **câmera**.

### Emojis
- Digite **`/`** numa linha para enfeitar com emojis e símbolos (busca em português, inglês e espanhol). A conta continua funcionando: `🛒 Arroz: R$ 27,90` é variável e item da seção.

### Outros
- Permissão de **câmera** pedida junto com microfone e notificações no primeiro uso (Android).
- Menus do autocompletar e do “/” sempre por cima dos outros blocos.

## 1.5.0 — anotações por voz, lembretes e notificações

### Anotações por voz
- **Fale e o app anota**: toque no microfone (botão flutuante no celular ou na barra de cada bloco de cálculo) e diga, por exemplo, “comprei arroz por 27,90, café 18 e paguei a luz 150”.
- **Transcrição** pela IA que você já configurou — OpenAI, Groq (tem plano gratuito), Gemini ou Mistral — ou ditado ao vivo quando o aparelho oferece.
- **Vira cálculo**: o que foi dito se transforma em linhas (`Arroz: R$ 27,90`, `Café: R$ 18,00`…) com prévia dos resultados. Com IA, a conversão é mais esperta; sem IA, o app converte no próprio aparelho.
- **Inserir** ou **inserir e organizar** (receitas e despesas, totais e saldo).
- O **áudio pode ficar salvo na nota**, com player e transcrição, para ouvir de novo ou converter depois.

### Lembretes e notificações
- **Lembretes** de contas e compromissos: valor, data, hora, repetição (semanal, mensal, anual) e aviso com antecedência.
- **Notificações do sistema**: no Android ficam agendadas e chegam mesmo com o app fechado; no Windows, macOS e Linux aparecem com o app aberto (e os atrasados são avisados ao abrir).
- **Central de notificações** no sino da barra superior, com **contador de não lidas**, lidas e **arquivadas**, “marcar todas como lidas” e “marcar como pago” direto no aviso.
- **Página Lembretes**: calendário do mês, atrasados, hoje, próximos 7 dias, total a pagar no mês e concluídos.
- **Marcar como pago** passa lembretes repetidos para o próximo vencimento; dá para adiar 1 dia ou 1 semana e arquivar.
- **Vencimentos nas notas**: escreva `Luz: R$ 150 vence 10/12` ou `Aluguel: R$ 1.800 vence dia 5` (todo mês). O valor continua sendo calculado e um sino ao lado do resultado cria o lembrete com um toque.
- Lembretes e notificações sincronizam pelo Google Drive.

### Permissões
- No **primeiro uso**, o app explica e pede de uma vez **microfone e notificações** (no Android, pela janela do próprio sistema) e guarda a escolha.
- Nova seção **Configurações › Permissões**, com a situação de cada uma e o botão para pedir de novo.

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
