// Porta "Minha progressão": a rota OPCIONAL do currículo Lattes.
//
// O docente exporta o XML do próprio Lattes (Atualizar currículo > Exportar
// > XML, que baixa um .zip) e carrega aqui. Este arquivo lê o XML NO
// NAVEGADOR — nada sai do computador — e devolve SUGESTÕES de lançamento
// pelo barema, para o docente conferir uma a uma. O Lattes é coleta parcial:
// o que ele não tem entra à mão, pela busca ou pelo quadro "O que o Lattes
// não traz".
//
// POR QUE SUGERIR, E NÃO LANÇAR
// O XML não traz o Qualis nem, quase sempre, a data exata (só o ano). Então:
// produção do ano de início ou de fim do interstício vem DESMARCADA, com
// "confira a data"; o que não tem item claro vai para "não sugerido"; e nada
// entra no relatório sem o docente clicar.
//
// COMO SE LÊ O REGISTRO
// Toda produção do Lattes tem a mesma forma: um elemento (ARTIGO-PUBLICADO,
// PARTICIPACAO-EM-CONGRESSO…) com um filho DADOS-BASICOS-… (o ano num
// atributo que começa por ANO, o título num que começa por TITULO) e às vezes
// um DETALHAMENTO-…. O ano e o título saem desse padrão, e não de uma tag
// escrita à mão; as regras (assets/progressao/lattes-barema.json) só dizem que
// tag vai para que item. Registro de tag sem regra cai em "não sugerido":
// nada some calado. Conferido num currículo real em 06/10/2026.
//
// Leitor de XML próprio, pequeno: o XML do Lattes é só elementos e
// atributos, e assim o mesmo código roda no navegador e no teste (node).
window.ProgressaoLattes = (function () {
  var NAO_E_LATTES = 'Este arquivo não parece um currículo Lattes exportado em XML. '
    + 'No Lattes: Atualizar currículo > Exportar > XML.';

  // ------------------------------------------------------------ arquivo
  /** bytes (Uint8Array) de um .zip do Lattes ou de um .xml -> texto do XML. */
  function lerArquivoLattes(bytes) {
    var ehZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
    var xml = ehZip ? xmlDoZip(bytes) : Promise.resolve(bytes);
    return xml.then(function (b) {
      var t = decodificar(b).replace(/^﻿/, '');
      if (!/^\s*</.test(t)) throw new Error(NAO_E_LATTES);
      return t;
    });
  }

  // O prólogo diz a codificação; o Lattes usa ISO-8859-1.
  function decodificar(b) {
    var cabeca = '';
    for (var i = 0; i < Math.min(b.length, 200); i++) cabeca += String.fromCharCode(b[i]);
    var m = /encoding\s*=\s*["']([^"']+)["']/i.exec(cabeca);
    var cod = m ? m[1].toLowerCase() : 'utf-8';
    try { return new TextDecoder(cod).decode(b); } catch (e) { return new TextDecoder('utf-8').decode(b); }
  }

  /** O primeiro .xml do zip. O Lattes chama o arquivo pelo número do currículo. */
  function xmlDoZip(b) {
    return window.ProgressaoZip.lerZip(b).then(function (itens) {
      for (var i = 0; i < itens.length; i++) if (/\.xml$/i.test(itens[i].nome)) return itens[i].bytes;
      throw new Error(NAO_E_LATTES);
    }, function () { throw new Error(NAO_E_LATTES); });
  }

  // --------------------------------------------------------------- XML
  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  function desentidade(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (_, e) {
      if (e.charAt(0) === '#') {
        return String.fromCharCode(e.charAt(1) === 'x' || e.charAt(1) === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      }
      return ENT[e.toLowerCase()];
    });
  }

  /** Árvore { tag, attrs, filhos } — só elementos e atributos. */
  function analisarXml(t) {
    var re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/([^\s>]+)\s*>|<([^\s\/>!?]+)((?:\s+[^\s=\/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    var raiz = null, pilha = [], m;
    while ((m = re.exec(t))) {
      if (m[1]) { pilha.pop(); continue; }
      if (!m[2]) continue;
      var no = { tag: m[2], attrs: {}, filhos: [] };
      var ra = /([^\s=\/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, a;
      while ((a = ra.exec(m[3] || ''))) no.attrs[a[1]] = desentidade(a[2] !== undefined ? a[2] : a[3]);
      if (pilha.length) pilha[pilha.length - 1].filhos.push(no);
      else if (!raiz) raiz = no;
      if (!m[4]) pilha.push(no);
    }
    return raiz;
  }

  // ---------------------------------------------------------- registros
  var COM_ATRIBUTOS_PROPRIOS = { 'PREMIO-TITULO': 1, 'ENSINO': 1, 'PROJETO-DE-PESQUISA': 1 };

  function filhoQueComeca(no, prefixo) {
    for (var i = 0; i < no.filhos.length; i++) if (no.filhos[i].tag.indexOf(prefixo) === 0) return no.filhos[i];
    return null;
  }
  function attrQueComeca(attrs, prefixos) {
    for (var p = 0; p < prefixos.length; p++) {
      for (var k in attrs) {
        if (k.indexOf(prefixos[p]) === 0 && !/-INGLES$/.test(k) && attrs[k]) return attrs[k];
      }
    }
    return '';
  }

  /** Cada produção, prêmio, disciplina ou projeto do currículo. */
  function registros(raiz) {
    var out = [];
    (function andar(no) {
      var basicos = filhoQueComeca(no, 'DADOS-BASICOS');
      if (basicos || COM_ATRIBUTOS_PROPRIOS[no.tag]) {
        var b = basicos || no;
        var detalhe = filhoQueComeca(no, 'DETALHAMENTO') || { attrs: {} };
        var ini = Number(b.attrs['ANO-INICIO']) || 0;
        out.push({
          tag: no.tag, basicos: b.attrs, detalhe: detalhe.attrs,
          ano: ini ? 0 : Number(attrQueComeca(b.attrs, ['ANO'])) || 0,
          anoInicio: ini, anoFim: ini ? (Number(b.attrs['ANO-FIM']) || 9999) : 0,
          // participação em evento costuma vir com TITULO vazio e o nome do
          // evento no DETALHAMENTO (visto no currículo real)
          titulo: attrQueComeca(b.attrs, ['TITULO', 'NOME-DO-PREMIO', 'NOME-DO-PROJETO', 'NOME-CURSO'])
                  || attrQueComeca(detalhe.attrs, ['NOME-DO-EVENTO', 'TITULO'])
                  || '(sem título no Lattes)',
          doi: String(b.attrs.DOI || '').trim()
        });
        if (basicos) return;     // os filhos de uma produção não são outras produções
      }
      for (var i = 0; i < no.filhos.length; i++) andar(no.filhos[i]);
    })(raiz);
    return out;
  }

  function casa(regra, r) {
    var q = regra.quando || [];
    for (var i = 0; i < q.length; i++) {
      var v = (q[i].em === 'detalhe' ? r.detalhe : r.basicos)[q[i].atributo] || '';
      if (q[i].valores.indexOf(v) < 0) return false;
    }
    return true;
  }

  function rotuloDaTag(tag) {
    return tag.toLowerCase().replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }

  // ------------------------------------------------------------ sugerir
  /**
   * texto do XML + regras + interstício { inicio, fim } ('AAAA-MM-DD') ->
   * { nome, sugeridas, naoSugeridas, foraDoPeriodo }.
   */
  function sugestoesDoLattes(texto, mapa, periodo) {
    var raiz = analisarXml(texto);
    if (!raiz || raiz.tag !== 'CURRICULO-VITAE') throw new Error(NAO_E_LATTES);
    var dados = filhoQueComeca(raiz, 'DADOS-GERAIS');
    var a0 = Number(periodo.inicio.slice(0, 4)), a1 = Number(periodo.fim.slice(0, 4));
    var sugeridas = [], naoSugeridas = [], fora = 0, vistas = {};

    registros(raiz).forEach(function (r) {
      // período: o Lattes dá o ano; disciplina e projeto dão início e fim
      var dentro, borda;
      if (r.anoInicio) {
        dentro = r.anoInicio <= a1 && r.anoFim >= a0;
        borda = false;
      } else {
        dentro = r.ano >= a0 && r.ano <= a1;
        borda = r.ano === a0 || r.ano === a1;
      }
      if (!dentro) { fora++; return; }

      var regra = null;
      for (var i = 0; i < mapa.regras.length; i++) {
        if (mapa.regras[i].tag === r.tag && casa(mapa.regras[i], r)) { regra = mapa.regras[i]; break; }
      }
      var anoTxt = r.anoInicio ? r.anoInicio + '–' + (r.anoFim === 9999 ? '' : r.anoFim) : String(r.ano);
      if (!regra) {
        naoSugeridas.push({ tag: r.tag, rotulo: rotuloDaTag(r.tag), ano: anoTxt, titulo: r.titulo,
                            dica: (mapa.naoSugeridosComDica || {})[r.tag] || '' });
        return;
      }
      var chave = 'lattes:' + r.tag + ':' + r.ano + ':' + r.titulo;
      if (vistas[chave]) return;           // o mesmo registro duas vezes no XML
      vistas[chave] = 1;
      var avisos = [];
      if (regra.aviso) avisos.push(regra.aviso);
      if (borda) avisos.push('Ano de ' + (r.ano === a0 ? 'início' : 'fim') + ' do interstício: confira a data no comprovante.');
      sugeridas.push({ chave: chave, tag: r.tag, item: regra.item, alternativas: (regra.alternativas || []).slice(),
                       ano: r.ano, titulo: r.titulo, doi: r.doi, marcado: !borda && !regra.desmarcado,
                       avisos: avisos });
    });

    sugeridas.sort(function (x, y) {
      var a = x.item.split('.'), b = y.item.split('.');
      return (+a[0] - +b[0]) || (+a[1] - +b[1]) || (x.ano - y.ano);
    });
    return { nome: dados ? (dados.attrs['NOME-COMPLETO'] || '') : '', sugeridas: sugeridas,
             naoSugeridas: naoSugeridas, foraDoPeriodo: fora };
  }

  return { lerArquivoLattes: lerArquivoLattes, analisarXml: analisarXml, sugestoesDoLattes: sugestoesDoLattes };
})();
