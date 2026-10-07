# SindiUFSB — site

Conteúdo do site da SindiUFSB — Seção Sindical do ANDES-SN
(`sindiufsb.org.br`), publicado pelo GitHub Pages.

- `posts/AAAA/MM/slug.md` — notícias, convocações, boletins. O `permalink` no
  cabeçalho de cada arquivo é o endereço público do post.
- `paginas/` — páginas fixas (Nossa história, estatuto, contato, diretoria…).
  Não são editadas pelo CMS: mudam por commit aqui.
- `imagens/` — imagens usadas nos posts.
- `documentos/` — PDFs enviados pelo CMS, com link nos posts (públicos).
- `dados/` — o que o CMS edita além dos posts: `categorias.json` e `capa.json`.

Tudo aqui é **público para sempre** (o histórico do git também): nada de CPF,
SIAPE ou dado de filiado. Rascunhos não moram aqui, e sim no CMS.

Os posts normalmente entram pelo CMS da diretoria, que faz o commit como
"CMS SindiUFSB". Também dá para escrever direto aqui: um `.md` em
`posts/AAAA/MM/` com `title`, `date`, `tags` e `permalink` no cabeçalho.

O conteúdo até setembro de 2026 veio do Blogger; ver `MIGRACAO.md`.

## Rodar localmente

```bash
npm install
npm start          # http://localhost:8080, recarrega ao salvar
npm run build      # _site/ + índice da busca (Pagefind)
```

A busca só funciona depois do `npm run build`: o índice é gerado a partir do
HTML pronto.

## Como o site é montado

- Eleventy 3 (`eleventy.config.js`); layouts em `_includes/`, dados fixos
  (menu, contatos, link da Minha SindiUFSB) em `_data/site.js`. O menu está
  em `_includes/menu.njk`.
- Minha SindiUFSB (`/minha-sindiufsb/`): `paginas/minha-sindiufsb.njk`,
  `assets/css/minha.css`, `assets/js/minha.js` e `assets/js/minha-servidor.js`.
  Página própria, sem o layout do site. Os dados vêm do projeto Apps Script da
  tesouraria (`Api.gs` no repositório `sindiufsb-tesouraria`), chamado por
  `fetch` sem cookie para não esbarrar no erro das várias contas Google
  (`apiMinhaSindiufsb` em `_data/site.js`). Só funções da lista fechada de lá
  respondem.
- Visual: cores e medidas no topo de `assets/css/site.css` (vermelho da casa
  `#b5141b`, próximo ao do ANDES-SN; largura máxima 1280 px). CSS e JS são
  chamados com `?v=<hash do conteúdo>` (filtro `versao`), para mudança de
  estilo chegar ao navegador sem esperar o cache de 10 minutos do Pages.
- Categorias: as etiquetas (`tags`) de cada post, traduzidas em
  `dados/categorias.json` (lido também pelo CMS). Post sem etiqueta conhecida cai em "Geral". Os links
  antigos `/search/label/NOME` redirecionam para `/categoria/slug/`.
- Minha progressão (porta da Minha SindiUFSB, 10/2026): ajuda o docente a
  pedir progressão e promoção na UFSB. `assets/js/progressao-regras.js`
  (contas), `assets/js/progressao-pdf.js` (o PDF único, montado no navegador
  com a pdf-lib de `assets/js/vendor/`) e `assets/js/progressao.js` (tela).
  As regras moram em `assets/progressao/`: `carreira-ufsb.json` (Lei 12.772
  na redação da Lei 15.141/2025, Resolução UFSB 17/2022) e
  `barema-ufsb-17-2022.json`, **gerado** da planilha oficial da PROGEPE por
  `node _config/barema.js` (o teste refaz a conversão e compara). Os
  comprovantes não saem do navegador. O aviso por e-mail é do Apps Script da
  tesouraria (`Progressao.gs`). O botão no menu aparece com `?porta=progressao`
  até a revisão de conteúdo.
  Rota opcional do Lattes (`assets/js/progressao-lattes.js`): o docente
  carrega o XML exportado do próprio Lattes, lido no navegador, e recebe
  SUGESTÕES pelo barema (regras em `assets/progressao/lattes-barema.json`),
  que confirma uma a uma; o que o Lattes não traz entra à mão. A fixture de
  teste é inventada (`testes/fixtures/lattes-ficticio.xml`): nenhum currículo
  real entra neste repositório.
- `paginas/ficha-de-filiacao.njk` + `assets/js/ficha.js`: formulário de
  filiação (centros de formação por campus em `CENTROS_POR_CAMPUS`),
  e os `name=` dos campos são o contrato com o back-end em Apps
  Script; não renomeie.
- Capa: carrossel com as fotos de `dados/capa.json` (ordem, legenda,
  recorte), editado pela aba Capa do CMS; `assets/js/capa.js` faz a troca.
- Próxima assembleia e próximo debate: cartões na página inicial montados em
  `_config/eventos.js` a partir do cabeçalho que o CMS grava nas convocações
  (`assembleia_data`, `salas`…) e debates (`debate_data`…), com link para o
  Google Agenda e arquivo `.ics` (`agenda.njk`). Somem quando o evento acaba
  (build diário e, no navegador, `assets/js/eventos.js`). O link da sala do
  debate nunca vem para cá.
- Destaque da página inicial: o post mais recente; com imagem, ela aparece ao
  lado; sem imagem, só o texto.
- Imagens quebradas nunca aparecem: no build, `_config/imagens.js` tira as
  `<img>` com `blob:`/`data:` ou arquivo local inexistente (avisa no log);
  no navegador, `assets/js/imagens.js` esconde as que falharem ao carregar.
- Testes: `npm test` (imagens, eventos, Minha SindiUFSB e Minha progressão).
- `/cms/indice-posts.json` (`indice-posts.njk`): lista de posts com título e
  etiquetas, lida pelo CMS.
- Publicação: `.github/workflows/publicar.yml` a cada push na `main`, e todo
  dia às 06h. O domínio (`www.sindiufsb.org.br`) vem das configurações do
  Pages; sem domínio, o prefixo do repositório entraria nos links sozinho.
