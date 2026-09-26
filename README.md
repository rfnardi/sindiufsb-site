# SindiUFSB — site

Conteúdo do site da SindiUFSB — Seção Sindical do ANDES-SN
(`sindiufsb.org.br`), publicado pelo GitHub Pages.

- `posts/AAAA/MM/slug.md` — notícias, convocações, boletins. O `permalink` no
  cabeçalho de cada arquivo é o endereço público do post.
- `paginas/` — páginas fixas (estatuto, contato, diretoria…).
- `imagens/` — imagens usadas nos posts.

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
  (menu, contatos) em `_data/site.js`.
- Categorias: as etiquetas (`tags`) de cada post, traduzidas em
  `dados/categorias.json` (lido também pelo CMS). Post sem etiqueta conhecida cai em "Geral". Os links
  antigos `/search/label/NOME` redirecionam para `/categoria/slug/`.
- `paginas/ficha-de-filiacao.njk` + `assets/js/ficha.js`: formulário de
  filiação (centros de formação por campus em `CENTROS_POR_CAMPUS`),
  e os `name=` dos campos são o contrato com o back-end em Apps
  Script; não renomeie.
- Capa: carrossel com as fotos de `dados/capa.json` (ordem, legenda,
  recorte), editado pela aba Capa do CMS; `assets/js/capa.js` faz a troca.
- Imagens quebradas nunca aparecem: no build, `_config/imagens.js` tira as
  `<img>` com `blob:`/`data:` ou arquivo local inexistente (avisa no log);
  no navegador, `assets/js/imagens.js` esconde as que falharem ao carregar.
  Testes: `npm test`.
- Publicação: `.github/workflows/publicar.yml` a cada push na `main`, e todo
  dia às 06h. Enquanto não houver domínio próprio, o prefixo do repositório
  entra nos links automaticamente.
