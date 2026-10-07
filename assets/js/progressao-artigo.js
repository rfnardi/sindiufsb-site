// Porta "Minha progressão": a primeira página de um artigo, pelo DOI.
//
// Pedido da tesouraria (07/10/2026): para artigo, o sistema traz sozinho a
// folha com título e autores, que é o comprovante. Tudo no navegador:
//   1. o OpenAlex (catálogo aberto, sem chave) diz onde há PDF de acesso
//      aberto do DOI;
//   2. o navegador baixa o PDF direto do site da revista ou do repositório;
//   3. a pdf-lib recorta a primeira página (ou as duas primeiras, para PDF
//      com capa de repositório).
// Sai da máquina só o DOI, que é público. Quando não dá — artigo sem versão
// aberta, editora que bloqueia, site que não deixa o navegador copiar —, a
// resposta diz por quê, e o docente anexa à mão. Nunca se finge comprovante.
//
// Conferido em 07/10/2026 com quatro artigos reais: três vieram, um foi
// bloqueado pela editora (403).
window.ProgressaoArtigo = (function () {
  var OPENALEX = 'https://api.openalex.org/works/doi:';

  function normalizarDoi(d) {
    return String(d || '').trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
      .replace(/^doi:\s*/i, '');
  }

  function host(url) {
    var m = /^https?:\/\/([^\/:?#]+)/i.exec(url);
    return m ? m[1].replace(/^www\./, '') : url;
  }

  function ehPdf(b) {
    var ini = '';
    for (var i = 0; i < Math.min(b.length, 1024); i++) ini += String.fromCharCode(b[i]);
    return ini.indexOf('%PDF') > -1;
  }

  /**
   * As URLs de PDF que o OpenAlex conhece, sem repetir: primeiro a versão
   * PUBLICADA, que mostra a revista; depois o resto, na ordem do OpenAlex. No
   * teste real (07/10/2026) os três artigos que vieram eram do arXiv — título
   * e autores, mas pré-publicação.
   */
  function urlsDePdf(obra) {
    var todos = [], vistos = {};
    var poe = function (loc) {
      if (!loc || !loc.pdf_url || vistos[loc.pdf_url]) return;
      vistos[loc.pdf_url] = 1;
      todos.push({ url: loc.pdf_url, publicada: loc.version === 'publishedVersion' });
    };
    poe(obra.best_oa_location);
    (obra.locations || []).forEach(poe);
    return todos.filter(function (x) { return x.publicada; })
                .concat(todos.filter(function (x) { return !x.publicada; }));
  }

  function recortar(PDFLib, bytes, paginas) {
    return PDFLib.PDFDocument.load(bytes).catch(function () {
      // PDF com senha de dono (impede editar, não ler): a cópia da página
      // ainda é possível ignorando a criptografia
      return PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    }).then(function (orig) {
      return PDFLib.PDFDocument.create().then(function (novo) {
        var n = Math.min(paginas, orig.getPageCount()), idx = [];
        for (var i = 0; i < n; i++) idx.push(i);
        return novo.copyPages(orig, idx).then(function (ps) {
          ps.forEach(function (p) { novo.addPage(p); });
          return novo.save().then(function (b) { return { bytes: b, paginasDoOriginal: orig.getPageCount() }; });
        });
      });
    });
  }

  function tentar(urls, i, op, ultimo) {
    if (i >= urls.length) return Promise.resolve({ erro: true, motivo: ultimo });
    var url = urls[i].url, publicada = urls[i].publicada;
    var proxima = function (motivo) { return tentar(urls, i + 1, op, motivo); };
    return op.fetch(url).then(function (r) {
      if (r.status === 401 || r.status === 403) return proxima('A editora bloqueou o download (' + host(url) + ').');
      if (!r.ok) return proxima('O endereço do PDF respondeu com erro ' + r.status + ' (' + host(url) + ').');
      return r.arrayBuffer().then(function (ab) {
        var b = new Uint8Array(ab);
        if (!ehPdf(b)) return proxima('O endereço não devolveu um PDF (' + host(url) + '): talvez peça login.');
        return recortar(op.PDFLib, b, op.paginas || 1).then(function (rec) {
          return { bytes: rec.bytes, paginasDoOriginal: rec.paginasDoOriginal, fonte: host(url), url: url,
                   publicada: publicada,
                   aviso: publicada ? '' : 'Esta não é a versão publicada (é pré-publicação ou manuscrito): '
                     + 'confira se mostra a revista. A CPADD pode pedir a primeira página da versão publicada.' };
        }, function () { return proxima('O PDF de ' + host(url) + ' não pôde ser lido.'); });
      });
    }, function () {
      return proxima('O site ' + host(url) + ' não deixa o navegador copiar o PDF. Baixe e anexe a primeira página.');
    });
  }

  /**
   * doi + { fetch, PDFLib, paginas } -> Promise de
   * { bytes, fonte, url, paginasDoOriginal, publicada, aviso } ou { erro: true, motivo }.
   */
  function buscarPrimeiraPagina(doi, op) {
    var d = normalizarDoi(doi);
    if (!d) return Promise.resolve({ erro: true, motivo: 'Sem DOI: anexe a primeira página do artigo.' });
    return op.fetch(OPENALEX + encodeURIComponent(d)).then(function (r) {
      if (!r.ok) {
        return { erro: true, motivo: r.status === 404
          ? 'O catálogo OpenAlex não encontrou este DOI. Confira o DOI ou anexe a primeira página.'
          : 'O catálogo OpenAlex não respondeu (erro ' + r.status + '). Tente mais tarde.' };
      }
      return r.json().then(function (obra) {
        var urls = urlsDePdf(obra || {});
        if (!urls.length) {
          return { erro: true, motivo: 'Não há versão de acesso aberto deste artigo. Anexe a primeira página.' };
        }
        return tentar(urls, 0, op, '');
      });
    }, function () {
      return { erro: true, motivo: 'Não consegui consultar o catálogo OpenAlex. Verifique a internet.' };
    });
  }

  return { buscarPrimeiraPagina: buscarPrimeiraPagina, normalizarDoi: normalizarDoi };
})();
