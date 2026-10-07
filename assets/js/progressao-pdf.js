// Porta "Minha progressão": o arquivo único em PDF que a Resolução UFSB
// 17/2022 pede (art. 7º, § 4º) — "documentos comprobatórios ... indexados com
// numeração de folhas e com vinculação expressa aos itens de avaliação".
//
// Montado NO NAVEGADOR, com pdf-lib: diplomas, portarias e declarações do
// docente não passam por servidor nenhum, nem o da SindiUFSB.
//
// Ordem do arquivo:
//   capa · tabela de pontuação por campo · índice (item → folhas) ·
//   comprovantes, na ordem do número do item.
// Toda página leva "Fl. N" no alto, à direita; as de comprovante levam também
// "Item X.Y — descrição", à esquerda.
//
// Arquivo que não abre (protegido por senha, corrompido, formato estranho)
// NÃO derruba os outros: volta em `erros`, com o nome, para a pessoa corrigir.
window.montarPdfDeProgressao = function (PDFLib, R, dados, anexos) {
  // PageSizes.A4, e não um [l, a] escrito aqui: a pdf-lib confere o tipo
  // com instanceof, e o teste roda este arquivo noutro contexto (vm)
  var A4 = PDFLib.PageSizes.A4, MARGEM = 50, CORPO = 10, LINHA = 14;
  var preto = PDFLib.rgb(0, 0, 0), cinza = PDFLib.rgb(0.35, 0.35, 0.35), branco = PDFLib.rgb(1, 1, 1);

  // A fonte padrão do PDF (Helvetica, WinAnsi) não tem seta, aspas curvas
  // nem emoji: trocamos pelo equivalente e descartamos o que não tem.
  var TROCAS = { '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-',
                 '—': '-', '→': '->', '≥': '>=', '≤': '<=', '•': '-',
                 '…': '...', ' ': ' ' };
  function limpar(s) {
    var out = '';
    var t = String(s == null ? '' : s);
    for (var i = 0; i < t.length; i++) {
      var c = t.charAt(i);
      if (TROCAS[c]) out += TROCAS[c];
      else if (c === '\n' || c === '\t') out += ' ';
      else if (c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 255 && !(c.charCodeAt(0) >= 127 && c.charCodeAt(0) < 160)) out += c;
    }
    return out.replace(/\s+/g, ' ').trim();
  }
  var PLURAIS = { 'hora': 'horas', 'mês': 'meses', 'período': 'períodos', 'publicação': 'publicações',
                  'estudante': 'estudantes', 'banca': 'bancas', 'edital': 'editais', 'atividade': 'atividades',
                  'capítulo': 'capítulos', 'participação': 'participações', 'peça': 'peças',
                  'documento': 'documentos', 'foto': 'fotos', 'patente': 'patentes', 'pedido': 'pedidos',
                  'registro': 'registros', 'trabalho': 'trabalhos', 'edição': 'edições', 'comissão': 'comissões',
                  'concurso': 'concursos', 'obra': 'obras', 'curso': 'cursos' };
  function unidade(u, q) { return Number(q) === 1 || !PLURAIS[u] ? (u || '') : PLURAIS[u]; }
  /** Encurta no fim de uma palavra, para o índice caber numa linha ou duas. */
  function curto(t, max) {
    if (t.length <= max) return t;
    return t.slice(0, t.lastIndexOf(' ', max)) + '...';
  }
  // Item do barema, ou atividade proposta fora dele (art. 9º, § 4º, id 'X')
  function ehProposta(l) { return l.id === R.ID_PROPOSTA; }
  function descricaoDe(l) {
    return ehProposta(l) ? (l.descricao || 'Atividade fora do barema') : R.item(l.id).descricao;
  }
  function br(d) { return d ? d.split('-').reverse().join('/') : ''; }
  function num(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }

  /** Quebra o texto em linhas que cabem na largura. */
  function quebrar(fonte, tam, texto, largura) {
    var palavras = limpar(texto).split(' '), linhas = [], atual = '';
    for (var i = 0; i < palavras.length; i++) {
      var tenta = atual ? atual + ' ' + palavras[i] : palavras[i];
      if (fonte.widthOfTextAtSize(tenta, tam) <= largura || !atual) atual = tenta;
      else { linhas.push(atual); atual = palavras[i]; }
    }
    if (atual) linhas.push(atual);
    return linhas.length ? linhas : [''];
  }

  return PDFLib.PDFDocument.create().then(function (doc) {
    return Promise.all([doc.embedFont(PDFLib.StandardFonts.Helvetica),
                        doc.embedFont(PDFLib.StandardFonts.HelveticaBold)])
      .then(function (f) { return montar(doc, f[0], f[1]); });
  });

  function montar(doc, fonte, negrito) {
    var erros = [];
    var porChave = {};
    dados.lancamentos.forEach(function (l) { porChave[l.chave] = l; });

    // --- 1. abre cada anexo, sem deixar um ruim derrubar os outros
    var abrir = anexos.map(function (a) {
      var l = porChave[a.lancamento];
      if (!l || !(R.item(l.id) || ehProposta(l))) return Promise.resolve(null);
      var ehImagem = /^image\/(png|jpe?g)$/i.test(a.tipo) || /\.(png|jpe?g)$/i.test(a.nome);
      if (ehImagem) {
        var png = /png/i.test(a.tipo) || /\.png$/i.test(a.nome);
        return (png ? doc.embedPng(a.bytes) : doc.embedJpg(a.bytes)).then(function (img) {
          return { a: a, l: l, imagem: img, paginas: 1 };
        }, function () {
          erros.push({ nome: a.nome, motivo: 'Não consegui ler esta imagem. Salve-a de novo como JPG ou PNG.' });
          return null;
        });
      }
      return PDFLib.PDFDocument.load(a.bytes).then(function (src) {
        return { a: a, l: l, src: src, paginas: src.getPageCount() };
      }, function (err) {
        var protegido = /encrypt/i.test(String(err && (err.name + ' ' + err.message)));
        erros.push({ nome: a.nome, motivo: protegido
          ? 'O PDF está protegido por senha. Abra-o e use "Imprimir > Salvar como PDF" para gerar uma cópia sem proteção.'
          : 'Não consegui ler este PDF. Abra-o e use "Imprimir > Salvar como PDF" para gerar uma cópia limpa.' });
        return null;
      });
    });

    return Promise.all(abrir).then(function (lidos) {
      lidos = lidos.filter(function (x) { return x && x.paginas > 0; });

      // --- 2. o que vai na tabela e no índice
      var minimoTipo = R.minimo(dados.tipo, dados.regime) || 0;
      var placar = R.placar(dados.lancamentos, { tipo: dados.tipo, regime: dados.regime,
                                                 mesesDeLicenca: dados.mesesDeLicenca });

      var largura = A4[0] - 2 * MARGEM;
      var COLS_TAB = [{ t: 'Item', w: 40 }, { t: 'Atividade', w: largura - 40 - 70 - 55 },
                      { t: 'Quantidade', w: 70 }, { t: 'Pontos', w: 55 }];
      var linhasTab = [];
      R.barema.campos.forEach(function (c, ci) {
        var doCampo = dados.lancamentos.filter(function (l) { var it = R.item(l.id); return it && it.campo === c.numero; })
          .sort(function (x, y) { return R.compararIds(x.id, y.id); });
        if (!doCampo.length) return;
        linhasTab.push({ titulo: 'Campo ' + c.romano + ' - ' + c.titulo });
        doCampo.forEach(function (l) {
          var it = R.item(l.id);
          var variante = it.variantes ? it.variantes[Number(l.variante) || 0] : null;
          var extra = [variante ? variante.rotulo : '', l.detalhe || ''].filter(Boolean).join('; ');
          linhasTab.push({ cel: [it.id, it.descricao + (extra ? ' (' + extra + ')' : ''),
                                 num(Number(l.quantidade) || 0) + ' ' + unidade(it.unidade, l.quantidade),
                                 num(R.pontosDoItem(it, l, minimoTipo))] });
        });
        linhasTab.push({ soma: 'Subtotal do campo ' + c.romano, valor: num(placar.porCampo[ci]) });
      });
      var propostas = dados.lancamentos.filter(ehProposta);
      if (propostas.length) {
        linhasTab.push({ titulo: 'Atividades propostas (art. 9º, § 4º) - não constam do Anexo I; a pontuação '
                                 + 'é proposta pelo docente e depende da CPADD' });
        propostas.forEach(function (l) {
          linhasTab.push({ cel: ['-', descricaoDe(l) + (l.detalhe ? ' (' + l.detalhe + ')' : ''), '-',
                                 num(Number(String(l.proposta || 0).replace(',', '.')) || 0)] });
        });
        linhasTab.push({ soma: 'Pontuação proposta (não somada ao total)', valor: num(placar.proposta) });
      }
      if (placar.licenca) linhasTab.push({ soma: 'Licença no interstício (' + num(dados.mesesDeLicenca) + ' meses, arts. 16 e 17)', valor: num(placar.licenca) });
      linhasTab.push({ soma: 'TOTAL', valor: num(placar.total) });
      linhasTab.push({ soma: 'Mínimo exigido (Resolução 17/2022, art. 9º)', valor: num(placar.minimo) });

      var COLS_IND = [{ t: 'Item', w: 40 }, { t: 'Comprovante', w: largura - 40 - 75 }, { t: 'Folhas', w: 75 }];
      // folhas ainda sem número: o índice tem o mesmo número de linhas com
      // ou sem elas, então dá para saber quantas páginas ele ocupa antes
      var ordem = R.folhear(lidos.map(function (x) { return { id: x.l.id, paginas: x.paginas, x: x }; }), 1);

      function linhasDoIndice(base) {
        return ordem.map(function (o) {
          return { cel: [ehProposta(o.x.l) ? '-' : o.id, curto(descricaoDe(o.x.l), 90) + (o.x.l.detalhe ? ' - ' + o.x.l.detalhe : '') + ' [' + o.x.a.nome + ']',
                         (o.de + base) === (o.ate + base) ? String(o.de + base) : (o.de + base) + ' a ' + (o.ate + base)] };
        });
      }

      // --- 3. paginação: mede antes, desenha depois
      function paginar(cols, linhas) {
        var paginas = [[]], y = A4[1] - MARGEM - 40 - LINHA * 1.6;
        linhas.forEach(function (ln) {
          var alt;
          if (ln.titulo) alt = (quebrar(negrito, CORPO, ln.titulo, largura).length) * LINHA + 6;
          else if (ln.soma) alt = LINHA + 2;
          else alt = Math.max.apply(null, ln.cel.map(function (c, i) {
            return quebrar(fonte, CORPO - 1, c, cols[i].w - 6).length; })) * (LINHA - 1) + 4;
          ln.alt = alt;
          if (y - alt < MARGEM + 20) { paginas.push([]); y = A4[1] - MARGEM - 40 - LINHA * 1.6; }
          paginas[paginas.length - 1].push(ln);
          y -= alt;
        });
        return paginas;
      }
      var pagsTab = paginar(COLS_TAB, linhasTab);
      var pagsInd = paginar(COLS_IND, linhasDoIndice(0));
      var iniciais = 1 + pagsTab.length + pagsInd.length;
      pagsInd = paginar(COLS_IND, linhasDoIndice(iniciais));

      var carimbos = [];
      function folha(p, n, rotulo) {
        var w = p.getWidth(), h = p.getHeight();
        var t = 'Fl. ' + n;
        var tw = negrito.widthOfTextAtSize(t, 10);
        p.drawRectangle({ x: w - tw - 30, y: h - 30, width: tw + 16, height: 18, color: branco, opacity: 0.85 });
        p.drawText(t, { x: w - tw - 22, y: h - 25, size: 10, font: negrito, color: preto });
        if (rotulo) {
          var r = limpar(rotulo);
          while (r.length > 10 && fonte.widthOfTextAtSize(r, 8) > w - tw - 70) r = r.slice(0, -4) + '...';
          var rw = fonte.widthOfTextAtSize(r, 8);
          p.drawRectangle({ x: 14, y: h - 30, width: rw + 12, height: 18, color: branco, opacity: 0.85 });
          p.drawText(r, { x: 20, y: h - 24, size: 8, font: fonte, color: preto });
        }
        carimbos.push({ pagina: n, texto: t, rotulo: rotulo || '' });
      }

      function desenharTabela(p, cols, linhas, titulo) {
        var y = A4[1] - MARGEM - 20;
        p.drawText(limpar(titulo), { x: MARGEM, y: y, size: 13, font: negrito });
        y -= LINHA * 1.6;
        var x = MARGEM;
        cols.forEach(function (c) { p.drawText(c.t, { x: x + 3, y: y, size: CORPO - 1, font: negrito, color: cinza }); x += c.w; });
        y -= 4;
        p.drawLine({ start: { x: MARGEM, y: y }, end: { x: MARGEM + largura, y: y }, thickness: 0.6, color: cinza });
        linhas.forEach(function (ln) {
          if (ln.titulo) {
            var ls = quebrar(negrito, CORPO, ln.titulo, largura);
            ls.forEach(function (t, i) { p.drawText(t, { x: MARGEM, y: y - 12 - i * LINHA, size: CORPO, font: negrito }); });
          } else if (ln.soma) {
            p.drawText(limpar(ln.soma), { x: MARGEM + 40, y: y - 11, size: CORPO, font: negrito });
            var vw = negrito.widthOfTextAtSize(ln.valor, CORPO);
            p.drawText(ln.valor, { x: MARGEM + largura - vw - 3, y: y - 11, size: CORPO, font: negrito });
          } else {
            var cx = MARGEM;
            ln.cel.forEach(function (c, i) {
              quebrar(fonte, CORPO - 1, c, cols[i].w - 6).forEach(function (t, k) {
                p.drawText(t, { x: cx + 3, y: y - 11 - k * (LINHA - 1), size: CORPO - 1, font: fonte });
              });
              cx += cols[i].w;
            });
          }
          y -= ln.alt;
        });
      }

      // --- 4. capa
      var n = 0;
      var capa = doc.addPage(A4);
      var y = A4[1] - MARGEM - 60;
      [[negrito, 15, 'Relatório de atividades para avaliação de desempenho docente'],
       [fonte, 11, 'Universidade Federal do Sul da Bahia - Resolução nº 17/2022'],
       [fonte, 11, ''],
       [negrito, 11, R.assuntoDetalhado(dados.de, dados.para)],
       [fonte, 11, ''],
       [fonte, 11, 'Docente: ' + dados.nome],
       [fonte, 11, 'SIAPE: ' + (dados.siape || '')],
       [fonte, 11, 'Regime de trabalho: ' + dados.regime],
       [fonte, 11, 'Interstício avaliado: ' + br(dados.inicio) + ' a ' + br(dados.fim)],
       [fonte, 11, 'Pontuação apresentada: ' + num(placar.total) + ' pontos (mínimo: ' + num(placar.minimo) + ')'],
       [fonte, 11, ''],
       [fonte, 10, 'Conteúdo: tabela de pontuação (Anexo I), índice dos comprovantes e comprovantes, '
                   + 'com as folhas numeradas e cada comprovante vinculado ao item que comprova.']
      ].forEach(function (ln) {
        quebrar(ln[0], ln[1], ln[2], largura).forEach(function (t) {
          capa.drawText(t, { x: MARGEM, y: y, size: ln[1], font: ln[0] });
          y -= ln[1] * 1.6;
        });
      });
      folha(capa, ++n);

      // --- 5. tabela e índice
      pagsTab.forEach(function (linhas, i) {
        var p = doc.addPage(A4);
        desenharTabela(p, COLS_TAB, linhas, 'Tabela de pontuação' + (i ? ' (continuação)' : ''));
        folha(p, ++n);
      });
      pagsInd.forEach(function (linhas, i) {
        var p = doc.addPage(A4);
        desenharTabela(p, COLS_IND, linhas, 'Índice dos comprovantes' + (i ? ' (continuação)' : ''));
        folha(p, ++n);
      });

      // --- 6. comprovantes
      var copias = ordem.map(function (o) {
        return o.x.src ? doc.copyPages(o.x.src, o.x.src.getPageIndices()) : Promise.resolve(null);
      });
      return Promise.all(copias).then(function (copiadas) {
        var folhas = [];
        ordem.forEach(function (o, k) {
          var rotulo = ehProposta(o.x.l) ? 'Atividade proposta (art. 9º, § 4º) - ' + descricaoDe(o.x.l)
                                          : 'Item ' + o.id + ' - ' + descricaoDe(o.x.l);
          var de = n + 1;
          if (copiadas[k]) {
            copiadas[k].forEach(function (pg) { doc.addPage(pg); folha(pg, ++n, rotulo); });
          } else {
            var p = doc.addPage(A4), img = o.x.imagem;
            var esc = Math.min((A4[0] - 80) / img.width, (A4[1] - 110) / img.height, 1);
            p.drawImage(img, { x: (A4[0] - img.width * esc) / 2, y: (A4[1] - 50 - img.height * esc) / 2,
                               width: img.width * esc, height: img.height * esc });
            folha(p, ++n, rotulo);
          }
          folhas.push({ item: o.id, lancamento: o.x.l.chave, nome: o.x.a.nome, de: de, ate: n });
        });
        return doc.save().then(function (bytes) {
          return { bytes: bytes, tamanho: bytes.length, paginasIniciais: iniciais,
                   folhas: folhas, erros: erros, carimbos: carimbos, placar: placar };
        });
      });
    });
  }
};
