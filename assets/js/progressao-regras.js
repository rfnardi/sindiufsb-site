// Porta "Minha progressão": as regras, sem tela.
//
// Tudo aqui é conta sobre o que o próprio docente informa — nível atual, data
// em que entrou nele, regime, titulação, atividades. Nada sai do navegador.
// As regras moram em dois JSON ao lado (assets/progressao/): a carreira
// (Lei 12.772 na redação da Lei 15.141/2025, e a Resolução UFSB 17/2022) e o
// barema (Anexo I da Resolução, convertido da planilha oficial por
// _config/barema.js). Este arquivo só sabe fazer conta com eles.
//
// O projeto da tesouraria usa a mesma conta de data no alerta por e-mail
// (Progressao.gs) e confere, em teste, que as duas dão o mesmo dia.
//
// Datas são texto 'AAAA-MM-DD' e a conta é feita em UTC: um interstício não
// pode andar um dia por causa de fuso ou de horário de verão.
window.criarRegrasDeProgressao = function (carreira, barema) {
  var NIVEIS = {}, PASSOS = {}, ITENS = {};
  carreira.niveis.forEach(function (n) { NIVEIS[n.id] = n; });
  carreira.passos.forEach(function (p) { PASSOS[p.de] = p; });
  barema.campos.forEach(function (c) {
    c.itens.forEach(function (i) { ITENS[i.id] = Object.assign({ campo: c.numero }, i); });
  });

  // ------------------------------------------------------------ datas
  function lerData(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 ? d : null;
  }
  function texto(d) { return d.toISOString().slice(0, 10); }

  /** Soma meses; 29/02 + 24 meses cai em 28/02 (não pula para março). */
  function somarMeses(s, meses) {
    var d = lerData(s);
    var alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1));
    var ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    alvo.setUTCDate(Math.min(d.getUTCDate(), ultimo));
    return texto(alvo);
  }
  function somarDias(s, dias) {
    var d = lerData(s);
    d.setUTCDate(d.getUTCDate() + dias);
    return texto(d);
  }

  function arred(v) { return Math.round(v * 100) / 100; }
  function ehDoutor(t) { return /doutor/i.test(String(t || '')); }

  function minimo(tipo, regime) {
    var tab = carreira.minimos[tipo];
    return tab && tab[regime] !== undefined ? tab[regime] : null;
  }

  // ------------------------------------------------------- linha do tempo
  /**
   * Os interstícios a partir do nível atual: os vencidos e não pedidos, e o
   * próximo, ainda em curso. Cada um começa no fim do anterior, porque o
   * efeito da progressão conta da data em que o interstício se cumpre (Lei
   * 12.772, art. 13-A) — é isso que o Parecer AGU 00038/2023 reconheceu para
   * quem deixou acumular.
   *
   * Não infere nada que o docente não disse: sem data válida, ou com nível
   * desconhecido, devolve lista vazia.
   */
  function linhaDoTempo(e) {
    var hoje = e.hoje, out = [];
    if (!lerData(e.desde) || !lerData(hoje) || e.desde > hoje || !NIVEIS[e.nivel]) return out;
    var corte = somarMeses(hoje, -12 * carreira.prescricaoAnos);
    var nivel = e.nivel, inicio = e.desde;
    while (PASSOS[nivel]) {
      var p = PASSOS[nivel];
      var fim = somarMeses(inicio, p.meses);
      var i = {
        de: p.de, para: p.para, tipo: p.tipo, especial: p.especial || '',
        exigeDoutorado: !!p.exigeDoutorado, norma: p.norma || '',
        inicio: inicio, fim: fim,
        abertura: somarDias(fim, -carreira.aberturaDiasAntes),
        // A→B e Titular não passam pelo barema da Resolução 17/2022
        minimo: p.especial ? null : minimo(p.tipo, e.regime),
        estado: fim <= hoje ? 'vencido'
              : somarDias(fim, -carreira.aberturaDiasAntes) <= hoje ? 'pode_pedir' : 'em_curso',
        efeitosDesde: fim < corte ? corte : fim,
        prescricao: fim < corte ? 'parcial' : 'nenhuma'
      };
      if (p.exigeDoutorado && !ehDoutor(e.titulacao)) {
        i.faltaDoutorado = true;
        i.estado = 'bloqueado';
        out.push(i);
        break;
      }
      out.push(i);
      if (i.estado !== 'vencido' || p.especial) break;
      nivel = p.para;
      inicio = fim;
    }
    return out;
  }

  // ------------------------------------------------------------ pontos
  function item(id) { return ITENS[id] || null; }

  /**
   * Pontos de UM lançamento. A conta é a do texto do barema; as restrições
   * que dependem de julgamento (não acumular orientação com banca, coordenação
   * com equipe) ficam como aviso na tela, para a CPADD decidir.
   */
  function pontosDoItem(it, l, minimoDoTipo) {
    if (!it) return 0;
    var q = Number(l.quantidade);
    if (!(q > 0)) return 0;
    var v;
    if (it.tipo === 'por_horas') v = q / it.horas * it.pontos;
    else if (it.tipo === 'teto_por_periodo') v = Math.min(Math.max(Number(l.valor) || 0, 0), q * it.teto);
    else if (it.tipo === 'fracao_do_minimo') v = q * it.fracao * (minimoDoTipo || 0);
    else if (it.variantes) {
      var va = it.variantes[Number(l.variante) || 0];
      v = va ? q * va.pontos : 0;
    } else v = q * it.pontos;
    return arred(v);
  }

  /**
   * Soma do relatório contra o mínimo. Licença (médica, maternidade,
   * paternidade, adotante, doença em pessoa da família, capacitação,
   * pós-graduação) vale 1/24 dos pontos exigidos por mês — arts. 16 e 17.
   */
  function placar(lancamentos, o) {
    var min = minimo(o.tipo, o.regime) || 0;
    var porCampo = [];
    for (var c = 0; c < barema.campos.length; c++) porCampo.push(0);
    lancamentos.forEach(function (l) {
      var it = item(l.id);
      if (!it) return;
      porCampo[it.campo - 1] = arred(porCampo[it.campo - 1] + pontosDoItem(it, l, min));
    });
    // Atividade fora do barema (art. 9º, § 4º): pontuação PROPOSTA pelo
    // docente, que só a CPADD aceita ou não. Fica à parte: não entra no
    // total nem decide se o mínimo foi atingido.
    var proposta = 0;
    lancamentos.forEach(function (l) {
      if (l.id === ID_PROPOSTA) proposta += Math.max(Number(String(l.proposta || 0).replace(',', '.')) || 0, 0);
    });
    var meses = Math.max(Number(o.mesesDeLicenca) || 0, 0);
    var licenca = arred(meses * min / 24);
    var total = arred(porCampo.reduce(function (s, v) { return s + v; }, 0) + licenca);
    return { minimo: min, porCampo: porCampo, licenca: licenca, total: total, proposta: arred(proposta),
             falta: arred(Math.max(min - total, 0)), atinge: total >= min };
  }

  // -------------------------------------------------------- retificação
  /**
   * Revisão de progressão já concedida (página da PROGEPE): cabe quando a
   * CPADD aprovou DEPOIS de o interstício se completar, e a aprovação tem
   * menos de cinco anos (Decreto 20.910/1932).
   */
  function cabeRetificacao(e) {
    if (!lerData(e.fim) || !lerData(e.aprovacao) || !lerData(e.hoje)) {
      return { cabe: false, motivo: 'Informe as duas datas.' };
    }
    if (e.aprovacao <= e.fim) {
      return { cabe: false, motivo: 'A aprovação veio no prazo: não há efeito a recuperar.' };
    }
    if (e.aprovacao < somarMeses(e.hoje, -12 * carreira.prescricaoAnos)) {
      return { cabe: false, motivo: 'A aprovação tem mais de cinco anos (prescrição quinquenal).' };
    }
    return { cabe: true, motivo: 'A aprovação veio depois do fim do interstício e há menos de cinco anos.' };
  }

  // -------------------------------------------------------------- SIPAC
  function tipoSipac(de) {
    var p = PASSOS[de];
    return p && p.tipo === 'promocao' ? carreira.sipac.tipoPromocao : carreira.sipac.tipoProgressao;
  }
  function assuntoDetalhado(de, para) {
    var p = PASSOS[de];
    return (p && p.tipo === 'promocao' ? 'Promoção' : 'Progressão') + ' de '
      + NIVEIS[de].romano + ' para ' + NIVEIS[para].romano;
  }

  // ------------------------------------------------------------- folhas
  // Atividade proposta fora do barema: id 'X', sempre depois dos nove campos
  var ID_PROPOSTA = 'X';
  function compararIds(a, b) {
    var x = a === ID_PROPOSTA ? ['99', '0'] : a.split('.');
    var y = b === ID_PROPOSTA ? ['99', '0'] : b.split('.');
    return (+x[0] - +y[0]) || (+x[1] - +y[1]);
  }
  /**
   * Ordena os comprovantes pelo número do item (2.9 antes de 2.11) e dá a
   * cada um suas folhas — a "numeração de folhas com vinculação expressa aos
   * itens" do art. 7º, § 4º.
   */
  function folhear(anexos, primeira) {
    var f = primeira;
    return anexos.slice().sort(function (a, b) { return compararIds(a.id, b.id); })
      .map(function (a) {
        var r = Object.assign({}, a, { de: f, ate: f + a.paginas - 1 });
        f += a.paginas;
        return r;
      });
  }

  return {
    somarMeses: somarMeses, somarDias: somarDias, lerData: lerData,
    niveis: carreira.niveis, nivel: function (id) { return NIVEIS[id] || null; },
    passo: function (de) { return PASSOS[de] || null; },
    minimo: minimo, linhaDoTempo: linhaDoTempo,
    item: item, pontosDoItem: pontosDoItem, placar: placar,
    cabeRetificacao: cabeRetificacao, tipoSipac: tipoSipac,
    assuntoDetalhado: assuntoDetalhado, compararIds: compararIds, folhear: folhear,
    ID_PROPOSTA: ID_PROPOSTA,
    carreira: carreira, barema: barema
  };
};
