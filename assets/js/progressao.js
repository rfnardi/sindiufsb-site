// Minha SindiUFSB · porta "Minha progressão" (paginas/minha-sindiufsb.njk).
//
// A tela. As contas estão em progressao-regras.js e a montagem do PDF em
// progressao-pdf.js; aqui só se lê o formulário e se mostra o resultado.
//
// O QUE NÃO SAI DAQUI
// Os comprovantes são lidos pelo navegador e entram no PDF aqui mesmo. Nenhuma
// chamada ao servidor leva arquivo — o teste confere. O único dado que pode
// ir ao servidor é o do alerta por e-mail (nível, data, regime), e só se a
// pessoa marcar a caixa.
//
// RASCUNHO
// A lista de atividades (sem os arquivos) fica no localStorage, para um
// recarregar acidental não apagar meia hora de trabalho. "Sair" e "Apagar
// tudo deste computador" a removem: computador compartilhado.
(function () {
  var script = document.currentScript;
  var CHAVE_RASCUNHO = 'sindiufsb.progressao';
  var TAM_AVISO = 10 * 1024 * 1024;      // SIPAC: limite não publicado; avisamos acima disto
  var LADO_MAX_IMAGEM = 2000;            // px — foto de celular vira página legível e leve

  var R = null;            // regras, depois de carregar os JSON
  var LATTES = null;       // assets/progressao/lattes-barema.json
  var dadosPessoa = null;  // { nome } vindo de meusDados
  var escolhido = null;    // o interstício do relatório
  var lancamentos = [];    // { chave, id, quantidade, valor, variante, detalhe }
  var arquivos = {};       // chave -> [File]
  var urlPdf = '';
  var seq = 0;

  // A porta só aparece no menu com ?porta=progressao, até a revisão de
  // conteúdo pela tesouraria (o botão está no HTML com hidden).
  if (new URLSearchParams(location.search).get('porta') === 'progressao') {
    el('btPortaProgressao').hidden = false;
  }

  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function br(d) { return d ? d.split('-').reverse().join('/') : ''; }
  function num(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }
  function mb(n) { return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB'; }

  // ------------------------------------------------------------ carregar
  Promise.all([fetch(script.dataset.carreira).then(function (r) { return r.json(); }),
               fetch(script.dataset.barema).then(function (r) { return r.json(); }),
               fetch(script.dataset.lattes).then(function (r) { return r.json(); })])
    .then(function (j) {
      R = window.criarRegrasDeProgressao(j[0], j[1]);
      LATTES = j[2];
      montarSelects();
      montarFontes();
      montarNaoTraz();
      recuperarRascunho();
    }, function () {
      dizer('pgAvisoCarreira', 'erro', 'Não consegui carregar as regras. Recarregue a página.');
    });

  function montarSelects() {
    R.niveis.forEach(function (n) {
      var o = document.createElement('option');
      o.value = n.id;
      o.textContent = n.nome + (n.id === 'A' ? '' : ' (' + n.id + ')');
      el('pgNivel').appendChild(o);
    });
    R.carreira.passos.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.de;
      o.textContent = R.nivel(p.de).nome + ' → ' + R.nivel(p.para).nome;
      el('pgRetPasso').appendChild(o);
    });
  }

  function montarFontes() {
    var L = R.carreira.links;
    var f = [
      ['Página da PROGEPE sobre progressão e promoção', L.progepe],
      ['Resolução UFSB nº 17/2022 (avaliação, pontuação mínima e Anexo I)', L.resolucao],
      ['Lei nº 12.772/2012, arts. 12 e 13-A, na redação da Lei nº 15.141/2025', L.lei12772],
      ['Parecer AGU nº 00038/2023: progressão por interstícios acumulados', L.parecerAgu],
      ['Instruções da PROGEPE para cadastrar o processo no SIPAC', L.instrucoesSipac],
      ['Resolução UFBA nº 04/2014 (promoção a Titular, adotada pela UFSB)', L.titularUfba]
    ];
    el('pgFontes').innerHTML = f.map(function (x) {
      return '<li><a href="' + escapar(x[1]) + '" target="_blank" rel="noopener">' + escapar(x[0]) + '</a></li>';
    }).join('') + '<li>Efeitos financeiros desde o fim do interstício, limitados aos últimos cinco anos: '
      + 'Parecer nº 00002/2024/CFEDU/SUBCONSU/PGF/AGU e Decreto nº 20.910/1932, conforme a página da PROGEPE.</li>'
      + '<li>O Termo de Acordo nº 10/2024 (greve de 2024) previu regras nacionais de progressão '
      + '(cláusula 4ª, c) e juntou as classes iniciais (cláusula 3ª, a), que a Lei 15.141/2025 efetivou.</li>';
  }

  // Nome, SIAPE e carreira do cadastro, quando a área carrega (minha.js).
  window.progressaoComDados = function (r) {
    if (r.erro) return;
    dadosPessoa = { nome: r.nome };
    var c = r.carreira || {};
    if (c.classe && !el('pgNivel').value) el('pgNivel').value = c.classe === 'TL' ? '' : c.classe;
    if (c.regime && !el('pgRegime').value) el('pgRegime').value = c.regime;
    if (c.titulacao && !el('pgTitulacao').value) el('pgTitulacao').value = c.titulacao;
  };

  // ------------------------------------------------------- linha do tempo
  var ROTULO = { vencido: 'Vencido: já pode pedir', pode_pedir: 'Já pode abrir o processo',
                 em_curso: 'Em curso', bloqueado: 'Depende do doutorado' };

  el('pgVer').onclick = function () {
    if (!R) return;
    var e = { nivel: el('pgNivel').value, desde: el('pgDesde').value, regime: el('pgRegime').value,
              titulacao: el('pgTitulacao').value, hoje: hojeISO() };
    if (!e.nivel || !e.desde || !e.regime) {
      dizer('pgAvisoCarreira', 'erro', 'Informe nível, data e regime.');
      return;
    }
    if (e.desde > e.hoje) {
      dizer('pgAvisoCarreira', 'erro', 'A data de início no nível não pode estar no futuro.');
      return;
    }
    var l = R.linhaDoTempo(e);
    if (!l.length) {
      dizer('pgAvisoCarreira', 'ok', e.nivel === 'D'
        ? 'Titular é o último nível da carreira: não há interstício a contar.'
        : 'Não consegui calcular com esses dados. Confira o nível e a data.');
      el('pgLinha').innerHTML = '';
      return;
    }
    var vencidos = l.filter(function (i) { return i.estado === 'vencido'; }).length;
    dizer('pgAvisoCarreira', 'ok', vencidos > 1
      ? 'Você tem ' + vencidos + ' interstícios vencidos e não pedidos. Desde o Parecer AGU 00038/2023 é possível progredir '
        + 'por interstícios acumulados, um relatório para cada interstício, com os comprovantes do próprio período. '
        + 'Confirme com o Setor de Avaliação (avaliacao@ufsb.edu.br) se a UFSB quer um processo para cada um ou um só.'
      : '');
    el('pgLinha').innerHTML = l.map(function (i, k) {
      var h = '<div class="prog-inter prog-' + i.estado + '">'
        + '<div class="prog-inter-topo"><strong>' + escapar(R.nivel(i.de).nome + ' → ' + R.nivel(i.para).nome) + '</strong>'
        + '<span class="prog-selo">' + escapar(ROTULO[i.estado]) + '</span></div>'
        + '<div>Interstício de ' + br(i.inicio) + ' a ' + br(i.fim)
        + (i.estado === 'em_curso' ? ' · o processo pode ser aberto a partir de <strong>' + br(i.abertura) + '</strong>' : '')
        + '</div>';
      if (i.minimo) h += '<div>' + (i.tipo === 'promocao' ? 'Promoção' : 'Progressão') + ': mínimo de <strong>'
        + i.minimo + ' pontos</strong> no interstício (regime ' + escapar(e.regime) + ').</div>';
      if (i.faltaDoutorado) h += '<div>A promoção para Associado e para Titular exige o título de doutor '
        + '(Lei 12.772, art. 12, § 3º). Com o diploma, o interstício segue valendo.</div>';
      if (i.prescricao === 'parcial') h += '<div>Atenção: os atrasados anteriores a ' + br(i.efeitosDesde)
        + ' já prescreveram (cinco anos). A progressão continua devida, e o efeito vale daí em diante. '
        + 'Quanto antes pedir, menos se perde.</div>';
      if (i.especial === 'estagio_probatorio') h += '<div>Da classe A para Adjunto: 36 meses na classe e aprovação no '
        + 'estágio probatório. No SIPAC, anexe só a <strong>portaria de aprovação no estágio probatório</strong>, em PDF. '
        + 'Quem já era estável em 31/12/2024 foi promovido pela própria PROGEPE (Portaria 215/2025).</div>';
      if (i.especial === 'titular') h += '<div>Titular segue a Resolução UFBA 04/2014: relatório de atividades do período '
        + 'como Associado 4 e memorial (ou tese inédita), com comissão examinadora aprovada na Congregação do IHAC ou do '
        + 'Centro de Formação. Esta ferramenta ainda não monta esse processo.</div>';
      if (i.minimo && i.estado !== 'bloqueado') h += '<div style="margin-top:.5rem"><button type="button" class="secundario" '
        + 'data-inter="' + k + '">Montar o relatório deste interstício</button></div>';
      return h + '</div>';
    }).join('');
    [].slice.call(el('pgLinha').querySelectorAll('button[data-inter]')).forEach(function (b) {
      b.onclick = function () { escolher(l[Number(b.dataset.inter)], e); };
    });
    if (window.progressaoAlertaPronto) window.progressaoAlertaPronto(e, l);
    guardarRascunho();
  };

  // ------------------------------------------------------------ relatório
  function escolher(i, e) {
    if (escolhido && (escolhido.de !== i.de || escolhido.inicio !== i.inicio) && lancamentos.length
        && !confirmar('Trocar de interstício apaga as atividades já lançadas. Continuar?')) return;
    if (escolhido && (escolhido.de !== i.de || escolhido.inicio !== i.inicio)) { lancamentos = []; arquivos = {}; }
    if (escolhido && (escolhido.de !== i.de || escolhido.inicio !== i.inicio)) limparLattes();
    escolhido = { de: i.de, para: i.para, tipo: i.tipo, inicio: i.inicio, fim: i.fim, regime: e.regime };
    mostrarRelatorio();
    el('pgRelatorio').scrollIntoView({ behavior: 'smooth' });
  }

  // window.confirm trava a página e a automação; o botão pede um segundo clique
  var confirmando = '';
  function confirmar(msg) {
    if (confirmando === msg) { confirmando = ''; return true; }
    confirmando = msg;
    dizer('pgAvisoCarreira', 'erro', msg + ' Clique de novo para confirmar.');
    return false;
  }

  function mostrarRelatorio() {
    el('pgRelatorio').hidden = !escolhido;
    el('pgSipac').hidden = !escolhido;
    if (!escolhido) return;
    el('pgRelatorioQual').textContent = R.assuntoDetalhado(escolhido.de, escolhido.para)
      + ' · interstício de ' + br(escolhido.inicio) + ' a ' + br(escolhido.fim);
    desenharLancamentos();
    montarSipac();
  }

  el('pgBusca').oninput = function () {
    var q = el('pgBusca').value.trim().toLowerCase();
    if (q.length < 2) { el('pgAchados').innerHTML = ''; return; }
    var achados = [];
    R.barema.campos.forEach(function (c) {
      c.itens.forEach(function (it) {
        if (it.id.indexOf(q) === 0 || it.descricao.toLowerCase().indexOf(q) > -1) achados.push(it);
      });
    });
    el('pgAchados').innerHTML = achados.slice(0, 12).map(function (it) {
      return '<button type="button" class="prog-achado" data-item="' + escapar(it.id) + '"><strong>'
        + escapar(it.id) + '</strong> ' + escapar(it.descricao) + ' <span class="ajuda">'
        + escapar(it.textoPontos || textoDaRegra(it)) + '</span></button>';
    }).join('') + (achados.length > 12 ? '<p class="ajuda">… e mais ' + (achados.length - 12)
      + '. Refine a busca.</p>' : '') + (!achados.length ? '<p class="ajuda">Nada encontrado.</p>' : '');
    [].slice.call(el('pgAchados').querySelectorAll('button[data-item]')).forEach(function (b) {
      b.onclick = function () {
        el('pgBusca').value = '';
        el('pgAchados').innerHTML = '';
        novoLancamento(b.dataset.item);
      };
    });
  };

  /** Toda atividade entra por aqui: da busca, do quadro do Lattes ou fora do barema. */
  function novoLancamento(id, extra) {
    var l = { chave: 'l' + (++seq) + '-' + Date.now(), id: id, quantidade: '', valor: '',
              variante: 0, detalhe: '', descricao: '', proposta: '', origem: '' };
    for (var k in (extra || {})) l[k] = extra[k];
    lancamentos.push(l);
    desenharLancamentos();
    guardarRascunho();
    return l;
  }

  // "O que o Lattes não traz": os grupos do barema que o currículo quase
  // nunca tem, com um clique para cada item. O Lattes é coleta PARCIAL.
  function montarNaoTraz() {
    el('pgNaoTraz').innerHTML = LATTES.naoTraz.map(function (g) {
      return '<div class="prog-nao-traz"><strong>' + escapar(g.grupo) + '</strong>'
        + (g.porque ? ' <span class="ajuda">' + escapar(g.porque) + '</span>' : '') + '<div>'
        + g.itens.map(function (id) {
          var it = R.item(id);
          return '<button type="button" class="secundario prog-mini" data-nao-traz="' + escapar(id) + '" title="'
            + escapar(it.descricao) + '">' + escapar(id) + ' ' + escapar(curtoTela(it.descricao, 38)) + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    [].slice.call(el('pgNaoTraz').querySelectorAll('button[data-nao-traz]')).forEach(function (b) {
      b.onclick = function () { if (escolhido) novoLancamento(b.dataset.naoTraz); };
    });
  }
  function curtoTela(t, n) { return t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n)) + '…'; }

  // ------------------------------------------------------------- Lattes
  // Rota opcional: o XML do Lattes é lido aqui (progressao-lattes.js) e vira
  // SUGESTÃO. Nada entra no relatório sem o clique; o XML não fica guardado.
  var sugestoesLattes = null;

  function limparLattes() {
    sugestoesLattes = null;
    el('pgLattesArquivo').value = '';
    el('pgLattesLista').innerHTML = '';
    el('pgLattesNao').innerHTML = '';
    el('pgLattesAdicionar').hidden = true;
    dizer('pgLattesAviso', '', '');
  }

  el('pgLattesArquivo').onchange = function () {
    var f = el('pgLattesArquivo').files[0];
    if (!f || !escolhido) return;
    dizer('pgLattesAviso', '', 'Lendo o currículo no seu computador…');
    lerBytes(f).then(window.ProgressaoLattes.lerArquivoLattes).then(function (xml) {
      sugestoesLattes = window.ProgressaoLattes.sugestoesDoLattes(xml, LATTES, escolhido);
      desenharLattes();
    }).catch(function (e) {
      sugestoesLattes = null;
      el('pgLattesLista').innerHTML = '';
      el('pgLattesNao').innerHTML = '';
      el('pgLattesAdicionar').hidden = true;
      dizer('pgLattesAviso', 'erro', (e && e.message) || 'Não consegui ler o arquivo.');
    });
  };

  function jaNoRelatorio(chave) {
    return lancamentos.some(function (l) { return l.origem === chave; });
  }

  function desenharLattes() {
    var r = sugestoesLattes;
    if (!r) return;
    var marcadas = r.sugeridas.filter(function (s) { return s.marcado && !jaNoRelatorio(s.chave); }).length;
    dizer('pgLattesAviso', 'ok', r.sugeridas.length + ' sugestão(ões) no interstício, ' + marcadas + ' já marcada(s). '
      + r.foraDoPeriodo + ' registro(s) do currículo ficaram fora do período. Confira cada linha: o Lattes não '
      + 'traz o Qualis e, em geral, só traz o ano.');
    el('pgLattesLista').innerHTML = r.sugeridas.map(function (s, i) {
      var ja = jaNoRelatorio(s.chave);
      var opcoes = [s.item].concat(s.alternativas).map(function (id) {
        var it = R.item(id);
        return '<option value="' + escapar(id) + '"' + (id === (s.escolha || s.item) ? ' selected' : '') + '>'
          + escapar(id + ' ' + curtoTela(it.descricao, 50)) + '</option>';
      }).join('');
      return '<div class="prog-sug' + (ja ? ' prog-sug-ja' : '') + '">'
        + '<label class="confere"><input type="checkbox" data-sug="' + i + '"' + (ja ? ' disabled' : (s.marcado ? ' checked' : ''))
        + '><span><strong>' + escapar(String(s.ano)) + '</strong> · ' + escapar(s.titulo)
        + (ja ? ' <em>(já no relatório)</em>' : '') + '</span></label>'
        + '<select data-sug-item="' + i + '"' + (ja ? ' disabled' : '') + '>' + opcoes + '</select>'
        + s.avisos.map(function (a) { return '<p class="ajuda">' + escapar(a) + '</p>'; }).join('') + '</div>';
    }).join('');
    [].slice.call(el('pgLattesLista').querySelectorAll('input[data-sug]')).forEach(function (c) {
      c.onchange = function () { r.sugeridas[Number(c.dataset.sug)].marcado = c.checked; };
    });
    [].slice.call(el('pgLattesLista').querySelectorAll('select[data-sug-item]')).forEach(function (c) {
      c.onchange = function () { r.sugeridas[Number(c.dataset.sugItem)].escolha = c.value; };
    });
    el('pgLattesAdicionar').hidden = !r.sugeridas.length;
    el('pgLattesNao').innerHTML = r.naoSugeridas.length
      ? '<p><strong>Não sugerido</strong> <span class="ajuda">— está no Lattes, mas sem item claro no barema. '
        + 'Se valer, lance pela busca.</span></p><ul class="prog-lista">' + r.naoSugeridas.map(function (s) {
          return '<li>' + escapar(s.ano) + ' · ' + escapar(s.rotulo) + ': ' + escapar(s.titulo)
            + (s.dica ? '<br><span class="ajuda">' + escapar(s.dica) + '</span>' : '') + '</li>';
        }).join('') + '</ul>'
      : '';
  }

  el('pgLattesAdicionar').onclick = function () {
    var r = sugestoesLattes;
    if (!r || !escolhido) return;
    var n = 0;
    r.sugeridas.forEach(function (s) {
      if (!s.marcado || jaNoRelatorio(s.chave)) return;
      lancamentos.push({ chave: 'l' + (++seq) + '-' + Date.now(), id: s.escolha || s.item, quantidade: '1',
                         valor: '', variante: 0, detalhe: s.titulo + ' (' + s.ano + ')', descricao: '',
                         proposta: '', origem: s.chave });
      n++;
    });
    desenharLancamentos();
    guardarRascunho();
    desenharLattes();
    dizer('pgLattesAviso', 'ok', n ? n + ' atividade(s) acrescentada(s) ao relatório. Anexe o comprovante de cada uma.'
                                    : 'Nada novo para acrescentar.');
  };

  // Atividade que não consta do Anexo I (Resolução 17/2022, art. 9º, § 4º):
  // a pontuação é proposta pelo docente e só vale se a CPADD aceitar.
  el('pgProposta').onclick = function () {
    if (escolhido) novoLancamento(R.ID_PROPOSTA);
  };

  function textoDaRegra(it) {
    if (it.tipo === 'fracao_do_minimo') return '1/24 do mínimo por mês';
    if (it.variantes) return it.variantes.map(function (v) { return num(v.pontos) + '/mês (' + v.rotulo + ')'; }).join(' · ');
    return num(it.pontos) + '/' + it.unidade;
  }
  function rotuloQuantidade(it) {
    if (it.tipo === 'por_horas') return 'Horas';
    if (it.tipo === 'teto_por_periodo') return 'Períodos letivos';
    if (it.unidade === 'mês') return 'Meses';
    if (it.unidade === 'período') return 'Períodos letivos';
    return 'Quantidade (' + it.unidade + ')';
  }

  function desenharLancamentos() {
    var min = R.minimo(escolhido.tipo, escolhido.regime);
    el('pgLancamentos').innerHTML = lancamentos.map(function (l, k) {
      if (l.id === R.ID_PROPOSTA) return desenharProposta(l, k);
      var it = R.item(l.id);
      var campo = R.barema.campos[it.campo - 1];
      var h = '<div class="prog-lanc" data-k="' + k + '">'
        + '<div class="prog-lanc-topo"><strong>' + escapar(it.id) + '</strong> ' + escapar(it.descricao)
        + ' <span class="ajuda">' + escapar(it.textoPontos || textoDaRegra(it)) + '</span></div>';
      if (campo.obs) h += '<p class="ajuda prog-obs">Campo ' + escapar(campo.romano) + ': ' + escapar(campo.obs) + '</p>';
      h += '<div class="dupla">'
        + '<label>' + escapar(rotuloQuantidade(it)) + '<input type="text" inputmode="decimal" data-f="quantidade" value="'
        + escapar(l.quantidade) + '"></label>';
      if (it.tipo === 'teto_por_periodo') h += '<label>Pontos obtidos na avaliação<input type="text" inputmode="decimal" '
        + 'data-f="valor" value="' + escapar(l.valor) + '"><span class="ajuda">até ' + num(it.teto) + ' por período</span></label>';
      if (it.variantes) h += '<label>Tipo<select data-f="variante">' + it.variantes.map(function (v, i) {
        return '<option value="' + i + '"' + (Number(l.variante) === i ? ' selected' : '') + '>' + escapar(v.rotulo) + '</option>';
      }).join('') + '</select></label>';
      h += '<label>Pontos<output>' + num(R.pontosDoItem(it, l, min)) + '</output></label></div>'
        + '<label>Descrição (opcional, sai no índice)<input type="text" data-f="detalhe" value="' + escapar(l.detalhe) + '"></label>'
        + anexosDe(l)
        + '<button type="button" class="secundario prog-tirar" data-tirar="' + k + '">Tirar esta atividade</button></div>';
      return h;
    }).join('');

    [].slice.call(el('pgLancamentos').querySelectorAll('.prog-lanc')).forEach(function (bloco) {
      var l = lancamentos[Number(bloco.dataset.k)];
      [].slice.call(bloco.querySelectorAll('[data-f]')).forEach(function (c) {
        var f = c.dataset.f;
        if (f === 'arquivos') {
          c.onchange = function () {
            arquivos[l.chave] = [].slice.call(c.files);
            l.tinhaArquivos = arquivos[l.chave].length > 0;
            desenharLancamentos();
            guardarRascunho();
          };
          return;
        }
        c.oninput = c.onchange = function () {
          l[f] = f === 'quantidade' || f === 'valor' || f === 'proposta' ? c.value.replace(',', '.') : c.value;
          var out = bloco.querySelector('output');
          if (out) out.textContent = num(R.pontosDoItem(R.item(l.id), l, R.minimo(escolhido.tipo, escolhido.regime)));
          mostrarPlacar();
          guardarRascunho();
        };
      });
    });
    [].slice.call(el('pgLancamentos').querySelectorAll('button[data-tirar]')).forEach(function (b) {
      b.onclick = function () {
        var l = lancamentos.splice(Number(b.dataset.tirar), 1)[0];
        delete arquivos[l.chave];
        desenharLancamentos();
        guardarRascunho();
        if (l.origem) desenharLattes();
      };
    });
    mostrarPlacar();
  }

  function anexosDe(l) {
    var fs = arquivos[l.chave] || [];
    return '<label>Comprovante(s)<input type="file" data-f="arquivos" multiple accept="application/pdf,image/jpeg,image/png">'
      + '<span class="ajuda">' + (fs.length ? fs.map(function (f) { return escapar(f.name); }).join(', ')
        : (l.tinhaArquivos ? 'Anexe de novo: os arquivos não ficam guardados.' : 'Nenhum arquivo.')) + '</span></label>';
  }

  function desenharProposta(l, k) {
    return '<div class="prog-lanc prog-proposta" data-k="' + k + '">'
      + '<div class="prog-lanc-topo"><strong>Atividade fora do barema</strong> <span class="ajuda">Resolução 17/2022, '
      + 'art. 9º, § 4º: proponha à CPADD <em>antes</em> de enviar o relatório. A pontuação proposta aparece à parte '
      + 'e não conta para o mínimo até a CPADD aceitar.</span></div>'
      + '<label>O que foi a atividade<input type="text" data-f="descricao" value="' + escapar(l.descricao) + '"></label>'
      + '<div class="dupla"><label>Pontuação que você propõe<input type="text" inputmode="decimal" data-f="proposta" value="'
      + escapar(l.proposta) + '"></label></div>'
      + anexosDe(l)
      + '<button type="button" class="secundario prog-tirar" data-tirar="' + k + '">Tirar esta atividade</button></div>';
  }

  el('pgLicenca').oninput = function () { mostrarPlacar(); guardarRascunho(); };
  // o SIAPE entra no passo a passo do SIPAC, mas não no rascunho
  el('pgSiape').oninput = function () { if (escolhido) montarSipac(); };

  function mostrarPlacar() {
    if (!escolhido) return;
    var p = R.placar(lancamentos, { tipo: escolhido.tipo, regime: escolhido.regime,
                                    mesesDeLicenca: el('pgLicenca').value.replace(',', '.') });
    var partes = [];
    p.porCampo.forEach(function (v, i) { if (v) partes.push('Campo ' + R.barema.campos[i].romano + ': ' + num(v)); });
    if (p.licenca) partes.push('Licença: ' + num(p.licenca));
    el('pgPlacar').className = 'prog-placar ' + (p.atinge ? 'ok' : 'erro');
    el('pgPlacar').innerHTML = '<strong>Total: ' + num(p.total) + ' de ' + num(p.minimo) + ' pontos</strong>'
      + (p.atinge ? ' · atinge o mínimo' : ' · faltam ' + num(p.falta))
      + (partes.length ? '<br><span class="ajuda">' + escapar(partes.join(' · ')) + '</span>' : '')
      + (p.proposta ? '<br><span class="ajuda">Fora do barema, proposta à CPADD (não somada): '
        + num(p.proposta) + ' pontos</span>' : '');
  }

  // ---------------------------------------------------------------- PDF
  var pdfLib = null;
  function carregarPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (pdfLib) return pdfLib;
    pdfLib = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = script.dataset.pdflib;
      s.onload = function () { ok(window.PDFLib); };
      s.onerror = function () { pdfLib = null; falha(new Error('pdf-lib')); };
      document.head.appendChild(s);
    });
    return pdfLib;
  }

  function lerBytes(f) {
    return new Promise(function (ok, falha) {
      var r = new FileReader();
      r.onload = function () { ok(new Uint8Array(r.result)); };
      r.onerror = function () { falha(r.error); };
      r.readAsArrayBuffer(f);
    });
  }

  /** Foto grande vira JPEG de até 2000 px: o PDF fica leve e legível. */
  function prepararImagem(f) {
    if (!/^image\//.test(f.type)) return lerBytes(f).then(function (b) { return { bytes: b, tipo: f.type }; });
    return new Promise(function (ok) {
      var url = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () {
        var esc = Math.min(1, LADO_MAX_IMAGEM / Math.max(img.width, img.height));
        if (esc === 1 && f.size < 1.5 * 1024 * 1024) {
          URL.revokeObjectURL(url);
          lerBytes(f).then(function (b) { ok({ bytes: b, tipo: f.type }); });
          return;
        }
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * esc);
        c.height = Math.round(img.height * esc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          lerBytes(b).then(function (bytes) { ok({ bytes: bytes, tipo: 'image/jpeg' }); });
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        lerBytes(f).then(function (b) { ok({ bytes: b, tipo: f.type }); });
      };
      img.src = url;
    });
  }

  el('pgGerar').onclick = function () {
    if (!escolhido) return;
    var semArquivo = lancamentos.filter(function (l) { return !(arquivos[l.chave] || []).length; });
    var semQtd = lancamentos.filter(function (l) {
      return l.id === R.ID_PROPOSTA ? !(String(l.descricao || '').trim() && Number(l.proposta) > 0)
                                    : !(Number(l.quantidade) > 0);
    });
    if (!lancamentos.length) { dizer('pgAvisoPdf', 'erro', 'Lance pelo menos uma atividade.'); return; }
    if (semQtd.length) {
      dizer('pgAvisoPdf', 'erro', 'Falta preencher: ' + semQtd.map(function (l) {
        return l.id === R.ID_PROPOSTA ? 'atividade fora do barema (descrição e pontuação)' : l.id + ' (quantidade)';
      }).join(', ') + '.');
      return;
    }
    var bt = el('pgGerar');
    bt.disabled = true;
    bt.classList.add('ocupado');
    dizer('pgAvisoPdf', '', 'Montando o PDF no seu computador…');
    var lista = [];
    lancamentos.forEach(function (l) {
      (arquivos[l.chave] || []).forEach(function (f) { lista.push({ l: l, f: f }); });
    });
    carregarPdfLib().then(function (PDFLib) {
      return Promise.all(lista.map(function (x) {
        return prepararImagem(x.f).then(function (p) {
          return { lancamento: x.l.chave, nome: x.f.name, tipo: p.tipo, bytes: p.bytes };
        });
      })).then(function (anexos) {
        return window.montarPdfDeProgressao(PDFLib, R, {
          nome: (dadosPessoa && dadosPessoa.nome) || '', siape: el('pgSiape').value.trim(),
          de: escolhido.de, para: escolhido.para, tipo: escolhido.tipo,
          inicio: escolhido.inicio, fim: escolhido.fim, regime: escolhido.regime,
          mesesDeLicenca: el('pgLicenca').value.replace(',', '.'),
          lancamentos: lancamentos.map(function (l) {
            return { chave: l.chave, id: l.id, quantidade: Number(l.quantidade), valor: Number(l.valor) || 0,
                     descricao: l.descricao || '', proposta: Number(l.proposta) || 0,
                     variante: Number(l.variante) || 0, detalhe: l.detalhe };
          })
        }, anexos);
      });
    }).then(function (r) {
      bt.disabled = false;
      bt.classList.remove('ocupado');
      if (urlPdf) URL.revokeObjectURL(urlPdf);
      urlPdf = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
      var nome = 'relatorio-progressao-' + escolhido.de + '-para-' + escolhido.para + '.pdf';
      var avisos = [];
      if (r.erros.length) avisos.push('Ficaram de fora: ' + r.erros.map(function (e) { return e.nome + ' (' + e.motivo + ')'; }).join(' · '));
      if (semArquivo.length) avisos.push('Sem comprovante: ' + semArquivo.map(function (l) { return l.id; }).join(', ') + '.');
      if (r.tamanho > TAM_AVISO) avisos.push('O arquivo tem ' + mb(r.tamanho) + '. Se o SIPAC recusar, '
        + 'reduza as imagens ou salve os PDFs escaneados em qualidade menor.');
      if (!r.placar.atinge) avisos.push('A pontuação (' + num(r.placar.total) + ') está abaixo do mínimo ('
        + num(r.placar.minimo) + '): o relatório tende a ser reprovado.');
      dizer('pgAvisoPdf', avisos.length ? 'erro' : 'ok', avisos.length ? avisos.join(' ')
        : 'Pronto: ' + (r.paginasIniciais + r.folhas.reduce(function (s, f) { return s + f.ate - f.de + 1; }, 0))
          + ' folhas, ' + mb(r.tamanho) + '. Confira o arquivo antes de enviar.');
      el('pgBaixar').innerHTML = '<a class="prog-baixar" href="' + urlPdf + '" download="' + nome + '">Baixar '
        + escapar(nome) + '</a>';
    }, function () {
      bt.disabled = false;
      bt.classList.remove('ocupado');
      dizer('pgAvisoPdf', 'erro', 'Não consegui montar o PDF. Recarregue a página e tente de novo; '
        + 'se continuar, tente outro navegador (Firefox ou Chrome atualizados).');
    });
  };

  // ---------------------------------------------------------------- SIPAC
  function copiavel(t) {
    return '<span class="prog-copia"><code>' + escapar(t) + '</code> <button type="button" class="secundario" '
      + 'data-copiar="' + escapar(t) + '">Copiar</button></span>';
  }
  function montarSipac() {
    var S = R.carreira.sipac;
    var nome = (dadosPessoa && dadosPessoa.nome) || '(seu nome)';
    var siape = el('pgSiape').value.trim() || '(seu SIAPE)';
    var passos = [
      'Entre em <a href="' + S.endereco + '" target="_blank" rel="noopener">' + S.endereco + '</a> com o mesmo usuário e senha do SIG.',
      'Vá em <strong>' + escapar(S.caminho) + '</strong>.',
      'Tipo do processo: ' + copiavel(R.tipoSipac(escolhido.de)) + '. Processo eletrônico: <strong>Sim</strong>.',
      'Assunto detalhado: ' + copiavel(R.assuntoDetalhado(escolhido.de, escolhido.para)),
      'Tipo de documento: <strong>Formulário – Promoção e Progressão Docente</strong>. Em Forma do Documento, '
        + '"Escrever Documento", depois <strong>Carregar modelo</strong> e OK. Preencha: nome '
        + copiavel(nome) + ', SIAPE ' + copiavel(siape) + ', classe/nível atual '
        + copiavel(R.nivel(escolhido.de).romano) + ' e o pedido para ' + copiavel(R.nivel(escolhido.para).romano)
        + '. Clique em <strong>Adicionar Documento</strong>.',
      'Novo tipo de documento: <strong>DOCUMENTOS COMPROBATÓRIOS</strong>, Forma "Anexar Documento Digital". '
        + 'Data do documento e data do recebimento: a de hoje. Tipo de conferência: <strong>DOCUMENTO ORIGINAL</strong>. '
        + 'Arquivo: o PDF que você baixou acima. <strong>Adicionar Documento</strong>.',
      'Selecione os documentos, <strong>Adicionar Assinante &gt; Minha Assinatura</strong>, Assinar (função e senha) '
        + 'e Continuar.',
      'Interessado: o seu nome. Inserir e Continuar.',
      'Destino: Outra Unidade · ' + copiavel(S.unidade) + '. Confirme e anote o número do processo.'
    ];
    el('pgSipacPassos').innerHTML = '<ol class="prog-lista">' + passos.map(function (p) { return '<li>' + p + '</li>'; }).join('')
      + '</ol><p class="ajuda">O processo pode ser aberto até ' + R.carreira.aberturaDiasAntes
      + ' dias antes do fim do interstício (Resolução 17/2022, art. 7º, § 2º). Passo a passo conforme as '
      + '<a href="' + escapar(R.carreira.links.instrucoesSipac) + '" target="_blank" rel="noopener">instruções da PROGEPE</a>.</p>';
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('button[data-copiar]') : null;
    if (!b) return;
    var t = b.dataset.copiar;
    var feito = function () { b.textContent = 'Copiado'; setTimeout(function () { b.textContent = 'Copiar'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(feito, function () {});
  });

  // ----------------------------------------------------------- retificação
  el('pgRetConferir').onclick = function () {
    if (!R) return;
    var r = R.cabeRetificacao({ fim: el('pgRetFim').value, aprovacao: el('pgRetAprov').value, hoje: hojeISO() });
    if (!r.cabe) { dizer('pgRetResultado', 'erro', r.motivo); return; }
    var de = el('pgRetPasso').value;
    var passo = de ? R.passo(de) : null;
    var texto = 'Solicito a retificação dos efeitos financeiros da '
      + (passo ? R.assuntoDetalhado(passo.de, passo.para).replace(/^(Progressão|Promoção)/, function (m) { return m.toLowerCase(); }) : 'progressão funcional')
      + (el('pgRetProcesso').value ? ', concedida no processo nº ' + el('pgRetProcesso').value.trim() : '')
      + ', para que valham desde ' + br(el('pgRetFim').value) + ', data em que o interstício se completou, '
      + 'nos termos do art. 13-A da Lei nº 12.772/2012 e do Parecer nº 00002/2024/CFEDU/SUBCONSU/PGF/AGU, '
      + 'observada a prescrição quinquenal.';
    el('pgRetResultado').className = 'ok';
    el('pgRetResultado').innerHTML = escapar(r.motivo) + '<ol class="prog-lista">'
      + '<li>No SIPAC, cadastre um processo com o assunto ' + copiavel('RETIFICAÇÃO') + '.</li>'
      + '<li>Indique a progressão revista, o processo original, o período do interstício e anexe a '
      + 'comprovação das atividades do período (pode ser o mesmo PDF do processo original).</li>'
      + '<li>Texto do pedido: ' + copiavel(texto) + '</li>'
      + '<li>Envie ao ' + escapar(R.carreira.sipac.unidade) + '. <strong>Um processo para cada progressão</strong> revista.</li></ol>';
  };

  // ------------------------------------------------------------ rascunho
  function guardarRascunho() {
    try {
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({
        nivel: el('pgNivel').value, desde: el('pgDesde').value, regime: el('pgRegime').value,
        titulacao: el('pgTitulacao').value, licenca: el('pgLicenca').value, escolhido: escolhido,
        lancamentos: lancamentos.map(function (l) {
          return { chave: l.chave, id: l.id, quantidade: l.quantidade, valor: l.valor, variante: l.variante,
                   descricao: l.descricao || '', proposta: l.proposta || '', origem: l.origem || '',
                   detalhe: l.detalhe, tinhaArquivos: !!l.tinhaArquivos };
        })
      }));
    } catch (e) { /* navegador sem armazenamento: segue sem rascunho */ }
  }

  function recuperarRascunho() {
    var r;
    try { r = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null'); } catch (e) { r = null; }
    if (!r) return;
    if (r.nivel) el('pgNivel').value = r.nivel;
    if (r.desde) el('pgDesde').value = r.desde;
    if (r.regime) el('pgRegime').value = r.regime;
    if (r.titulacao) el('pgTitulacao').value = r.titulacao;
    if (r.licenca) el('pgLicenca').value = r.licenca;
    lancamentos = (r.lancamentos || []).filter(function (l) { return R.item(l.id) || l.id === R.ID_PROPOSTA; });
    escolhido = r.escolhido && R.passo(r.escolhido.de) ? r.escolhido : null;
    mostrarRelatorio();
  }

  function apagarTudo() {
    try { localStorage.removeItem(CHAVE_RASCUNHO); } catch (e) { /* nada */ }
    lancamentos = []; arquivos = {}; escolhido = null; dadosPessoa = null;
    if (urlPdf) { URL.revokeObjectURL(urlPdf); urlPdf = ''; }
    ['pgNivel', 'pgDesde', 'pgSiape', 'pgRegime', 'pgTitulacao', 'pgBusca', 'pgRetFim', 'pgRetAprov', 'pgRetPasso', 'pgRetProcesso']
      .forEach(function (id) { el(id).value = ''; });
    el('pgLicenca').value = '0';
    ['pgLinha', 'pgAchados', 'pgLancamentos', 'pgPlacar', 'pgBaixar', 'pgSipacPassos'].forEach(function (id) {
      el(id).innerHTML = '';
    });
    ['pgAvisoCarreira', 'pgAvisoPdf', 'pgRetResultado', 'pgAvisoAlerta'].forEach(function (id) { dizer(id, '', ''); });
    el('pgAlerta').hidden = true;
    limparLattes();
    mostrarRelatorio();
  }

  // --------------------------------------------------------------- aviso
  // A caixa só aparece se o servidor conhece minhaProgressao (Progressao.gs
  // da tesouraria): enquanto o Apps Script não estiver publicado com ela, a
  // porta responde "não disponível" e a caixa fica escondida, sem prometer
  // um aviso que não sairia.
  var ultimaCarreira = null;
  window.progressaoAlertaPronto = function (e) {
    ultimaCarreira = e;
    if (!window.tokenArea) return;
    servidor().withSuccessHandler(function (r) {
      if (!r || !r.ok) return;
      el('pgAlerta').hidden = false;
      el('pgAlertaLigado').checked = !!r.ativo;
      if (r.ativo && r.nivel && (r.nivel !== e.nivel || r.desde !== e.desde)) {
        dizer('pgAvisoAlerta', 'erro', 'O aviso guardado é para ' + r.nivel + ' desde ' + br(r.desde)
          + '. Salve de novo para usar os dados acima.');
      }
    }).withFailureHandler(function () {}).minhaProgressao({ token: window.tokenArea });
  };

  el('pgAlertaSalvar').onclick = function () {
    if (!ultimaCarreira) return;
    var bt = el('pgAlertaSalvar');
    bt.disabled = true;
    dizer('pgAvisoAlerta', '', 'Salvando…');
    servidor().withSuccessHandler(function (r) {
      bt.disabled = false;
      dizer('pgAvisoAlerta', r.ok ? 'ok' : 'erro', r.msg || r.erro);
    }).withFailureHandler(function () {
      bt.disabled = false;
      dizer('pgAvisoAlerta', 'erro', 'Não consegui falar com o servidor.');
    }).salvarMinhaProgressao({ token: window.tokenArea, ativar: el('pgAlertaLigado').checked,
                               nivel: ultimaCarreira.nivel, desde: ultimaCarreira.desde,
                               regime: ultimaCarreira.regime });
  };

  // ?sairProgressao=TOKEN, o link do rodapé do aviso. Pede um clique, como o
  // ?sair= dos lembretes (minha.js): antivírus abrem links para checá-los.
  (function () {
    var token = new URLSearchParams(location.search).get('sairProgressao');
    if (!token) return;
    el('porta-entrar').hidden = true;
    el('porta-sair').hidden = false;
    el('porta-sair').querySelector('h2').textContent = 'Aviso de progressão';
    el('porta-sair').querySelector('p').textContent = 'Você pode deixar de receber o aviso de progressão por e-mail.';
    el('btSairLembrete').onclick = function () {
      var bt = el('btSairLembrete');
      bt.disabled = true;
      bt.textContent = 'Registrando…';
      servidor().withSuccessHandler(function (r) {
        bt.hidden = true;
        dizer('sairAviso', 'ok', r.msg);
      }).withFailureHandler(function () {
        bt.disabled = false;
        bt.textContent = 'Parar de receber';
        dizer('sairAviso', 'erro', 'A página não conseguiu falar com o servidor. Tente de novo em instantes.');
      }).sairDoAlertaDeProgressao({ token: token });
    };
  })();

  el('pgApagar').onclick = function () {
    apagarTudo();
    dizer('pgAvisoCarreira', 'ok', 'Apagado deste computador.');
  };
  window.limparProgressao = apagarTudo;
})();
