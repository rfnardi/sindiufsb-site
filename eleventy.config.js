import { HtmlBasePlugin } from '@11ty/eleventy';
import { feedPlugin } from '@11ty/eleventy-plugin-rss';
import categorias from './_data/categorias.js';

const FUSO = 'America/Bahia';

export default function (config) {
  // O conteúdo migrado é texto, não template: "{{" num post não pode virar
  // código. Os .njk continuam sendo templates.
  config.setTemplateFormats(['md', 'njk', 'html']);

  config.addPassthroughCopy('imagens');
  config.addPassthroughCopy('assets');
  config.ignores.add('README.md');
  config.ignores.add('MIGRACAO.md');
  config.ignores.add('rascunhos/**');

  // Enquanto o site mora em usuario.github.io/repositorio/, o Action passa o
  // prefixo; com o domínio próprio, fica "/". O plugin reescreve os links
  // absolutos dos posts (/imagens/…, /2024/…) na hora do build.
  config.addPlugin(HtmlBasePlugin);

  config.addCollection('posts', (api) =>
    api.getFilteredByGlob('posts/**/*.md')
      .filter((p) => !p.data.draft)
      .sort((a, b) => b.date - a.date));

  // Etiquetas do Blogger viram categorias; "CAPA" era só marcador do slider.
  config.addCollection('categorias', (api) => {
    const posts = api.getFilteredByGlob('posts/**/*.md').filter((p) => !p.data.draft);
    return categorias.lista
      .map((c) => ({
        ...c,
        posts: posts
          .filter((p) => categorias.doPost(p.data.tags).some((x) => x.slug === c.slug))
          .sort((a, b) => b.date - a.date),
      }))
      .filter((c) => c.posts.length);
  });

  config.addCollection('etiquetasBlogger', (api) =>
    categorias.lista.filter((c) => c.etiqueta));

  config.addFilter('categoriasDoPost', (tags) => categorias.doPost(tags));

  config.addFilter('dataLonga', (d) =>
    new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSO })
      .format(new Date(d)));
  config.addFilter('dataCurta', (d) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: FUSO })
      .format(new Date(d)).replace(/\./g, '').replace(/ de /g, ' '));
  config.addFilter('dataIso', (d) => new Date(d).toISOString());

  // Resumo para os cards: o começo do texto, sem HTML, cortado numa palavra.
  config.addFilter('resumo', (html, max = 180) => {
    const texto = String(html || '')
      .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
    if (texto.length <= max) return texto;
    return texto.slice(0, texto.lastIndexOf(' ', max)).replace(/[,;:.\s]+$/, '') + '…';
  });

  config.addFilter('primeiraImagem', (html) => {
    const m = String(html || '').match(/<img[^>]+src="([^"]+)"/i);
    return m ? m[1] : null;
  });

  config.addFilter('encodeUrl', (s) => encodeURIComponent(s));

  config.addPlugin(feedPlugin, {
    type: 'atom',
    outputPath: '/feed.xml',
    collection: { name: 'posts', limit: 20 },
    metadata: {
      language: 'pt-BR',
      title: 'SindiUFSB — Seção Sindical do ANDES-SN',
      subtitle: 'Notícias, convocações e boletins do sindicato docente da UFSB.',
      base: 'https://www.sindiufsb.org.br/',
      author: { name: 'SindiUFSB' },
    },
  });

  return {
    markdownTemplateEngine: false,
    htmlTemplateEngine: false,
    dir: { input: '.', includes: '_includes', data: '_data', output: '_site' },
  };
}
