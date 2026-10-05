// Minha SindiUFSB (paginas/minha-sindiufsb.njk). Copiado do <script> da
// PaginaFiliado.html (repositório sindiufsb-tesouraria) quando a página veio
// para o site, em 10/2026. Mudou só o que dependia do Apps Script: o
// transporte (minha-servidor.js), a tabela de carreira (configuracaoArea) e a
// saída dos lembretes (?sair=), que era a PaginaSaida.html.
// ---- espera pelo servidor ----
// Toda chamada ao Apps Script passa por servidor(), nunca pela API do
// Google direto: é o único jeito de a página saber que está
// esperando e de parar de dizer isso quando a resposta chega — com sucesso
// ou com erro, inclusive onde a chamada não trata erro. Sem isso, a tela
// parada não distingue "trabalhando" de "travou".
var esperas = 0;
var ultimoClique = { botao: null, quando: 0 };

// O botão que originou a chamada é o último clicado. document.activeElement
// não serve: no Safari, clicar num botão não lhe dá o foco.
document.addEventListener('click', function (ev) {
  var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
  ultimoClique = { botao: b, quando: Date.now() };
}, true);

(function () {
  var barra = document.createElement('div');
  barra.id = 'esperaBarra';
  barra.setAttribute('aria-hidden', 'true');
  var selo = document.createElement('div');
  selo.id = 'esperaSelo';
  selo.setAttribute('role', 'status');
  selo.innerHTML = '<span class="girando" aria-hidden="true"></span><span></span>';
  document.body.appendChild(barra);
  document.body.appendChild(selo);
})();

function marcarEspera_(botao, passo) {
  esperas += passo;
  document.body.classList.toggle('esperando', esperas > 0);
  document.getElementById('esperaSelo').lastChild.textContent = esperas > 0 ? 'Carregando…' : '';
  if (botao) {
    var n = (Number(botao.getAttribute('data-esperas')) || 0) + passo;
    botao.setAttribute('data-esperas', n);
    botao.classList.toggle('ocupado', n > 0);
  }
}

// O transporte é o fetch de minha-servidor.js, com a mesma interface do
// google.script.run que esta página usava quando morava no Apps Script.
var API = document.currentScript.getAttribute('data-api');
var servidor = criarServidor(API, function (passo, botao) { marcarEspera_(botao, passo); },
  function () { return Date.now() - ultimoClique.quando < 1000 ? ultimoClique.botao : null; });

// A tabela de contribuição vem do servidor (configuracaoArea, Api.gs) ao abrir
// a página; antes vinha no modelo do Apps Script.
var OPCOES = null;

// O formulário anônimo de consulta saiu em 19/09/2026: o demonstrativo passou
// a viver dentro da área, atrás do código. O que ficou é o utilitário que
// enche um <select>, usado pelos seletores de carreira da área.
function encher(sel, itens, textoVazio) {
  sel.innerHTML = '';
  var vazio = document.createElement('option');
  vazio.value = '';
  vazio.textContent = textoVazio;
  sel.appendChild(vazio);
  itens.forEach(function (it) {
    var o = document.createElement('option');
    o.value = it.valor;
    o.textContent = it.rotulo;
    sel.appendChild(o);
  });
  sel.disabled = false;
}

// ===================================================================
// PEDIR RESSARCIMENTO
// ===================================================================
//
// Três passos, e o segundo é o que separa um pedido legítimo de um forjado:
// o token que a verificação devolve é o que diz de quem é o pedido. O CPF
// digitado no passo 1 serve para receber o código, e mais nada — quem manda
// no dono do pedido é o servidor.
var tokenDespesa = '';
var TETO_ANEXO = 4 * 1024 * 1024;

var botoesPorta = [].slice.call(document.querySelectorAll('nav.portas button'));
// O título do cabeçalho é FIXO (pedido da tesouraria, 19/09/2026): ele diz
// onde a pessoa está, e não em que aba clicou. Qual aba está aberta já se vê
// na própria barra, marcada.

botoesPorta = botoesPorta.filter(function (bt) { return bt.dataset.porta; });

botoesPorta.forEach(function (bt) {
  bt.onclick = function () { abrirPorta(bt.dataset.porta); };
});

function el(id) { return document.getElementById(id); }

function mascaraCpf(campo) {
  campo.oninput = function () {
    var d = campo.value.replace(/\D/g, '').substring(0, 11);
    var fora = '';
    if (d.length > 9) fora = d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (d.length > 6) fora = d.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (d.length > 3) fora = d.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    else fora = d;
    campo.value = fora;
  };
}
function dizer(id, tipo, texto) {
  var a = el(id);
  a.className = tipo;
  a.textContent = texto;
}

// Os passos 1 e 2 do ressarcimento saíram em 19/09/2026: a entrada é uma
// só, na porta da área, e a sessão vale para tudo. O que restou aqui é o
// formulário em si.
el('btTipoCompra').onclick = function () {
  el('passoCompra').hidden = false; el('passoViagem').hidden = true;
};
el('btTipoViagem').onclick = function () {
  el('passoViagem').hidden = false; el('passoCompra').hidden = true;
};

// ---- dados bancários e anexo, montados para os dois formulários ----
function montarBanco(onde, prefixo) {
  el(onde).innerHTML =
    '<h3 style="font-size:1.1rem;color:var(--vinho);margin:1rem 0 .4rem">'
    + 'Para onde transferir</h3>'
    + '<div class="dupla">'
    + '<label>Nome do favorecido<input type="text" id="' + prefixo + 'Favorecido"></label>'
    + '<label>Chave PIX<input type="text" id="' + prefixo + 'Pix"></label>'
    + '</div><div class="dupla" style="margin-top:.7rem">'
    + '<label>Banco<input type="text" id="' + prefixo + 'Banco"></label>'
    + '<label>Agência<input type="text" id="' + prefixo + 'Agencia"></label>'
    + '<label>Conta<input type="text" id="' + prefixo + 'Conta"></label>'
    + '</div>';
}

function montarAnexo(onde, prefixo, multiplo) {
  el(onde).innerHTML =
    '<h3 style="font-size:1.1rem;color:var(--vinho);margin:1rem 0 .4rem">'
    + 'Comprovante</h3>'
    + '<p class="ajuda">PDF, JPEG ou PNG, até 4 MB cada.</p>'
    + '<input type="file" id="' + prefixo + 'Arquivo" accept=".pdf,.jpg,.jpeg,.png"'
    + (multiplo ? ' multiple' : '') + '>'
    + '<div class="ajuda" id="' + prefixo + 'Lista"></div>';
}

montarBanco('bancoCompra', 'cp');
montarBanco('bancoViagem', 'vg');
montarAnexo('anexoCompra', 'cp', false);
montarAnexo('anexoViagem', 'vg', true);

function dadosBanco(prefixo) {
  return {
    favorecido_nome: el(prefixo + 'Favorecido').value.trim(),
    chave_pix: el(prefixo + 'Pix').value.trim(),
    banco: el(prefixo + 'Banco').value.trim(),
    agencia: el(prefixo + 'Agencia').value.trim(),
    conta: el(prefixo + 'Conta').value.trim()
  };
}

/** Lê os arquivos escolhidos em base64, recusando o que passa do teto. */
function lerArquivos(prefixo, entao, avisar) {
  var campo = el(prefixo + 'Arquivo');
  var lista = [].slice.call(campo.files || []);
  if (!lista.length) { entao([]); return; }

  var grandes = lista.filter(function (f) { return f.size > TETO_ANEXO; });
  if (grandes.length) {
    avisar('O arquivo "' + grandes[0].name + '" tem '
           + (grandes[0].size / 1048576).toFixed(1) + ' MB e o limite é 4 MB.'
           + ' Reduza a imagem ou envie o PDF sem anexos pesados.');
    return;
  }

  var prontos = [];
  var restam = lista.length;
  lista.forEach(function (f) {
    var leitor = new FileReader();
    leitor.onerror = function () {
      avisar('Não consegui ler o arquivo "' + f.name + '" no seu computador.');
    };
    leitor.onload = function () {
      prontos.push({ nome: f.name,
                     base64: String(leitor.result).split(',')[1] || '' });
      if (--restam === 0) entao(prontos);
    };
    leitor.readAsDataURL(f);
  });
}

function enviando(bt, aviso, ligado) {
  bt.disabled = ligado;
  if (ligado) dizer(aviso, '', 'Enviando…');
}

// ---- enviar: compra ----
el('btEnviarCompra').onclick = function () {
  var bt = el('btEnviarCompra');
  enviando(bt, 'avisoCompra', true);

  lerArquivos('cp', function (arquivos) {
    if (!arquivos.length) {
      bt.disabled = false;
      dizer('avisoCompra', 'erro', 'Anexe o recibo ou a nota fiscal.');
      return;
    }
    servidor().withSuccessHandler(function (r) {
      bt.disabled = false;
      dizer('avisoCompra', r.ok ? 'ok' : 'erro', r.msg);
      if (r.ok) el('passoCompra').hidden = true;
    }).withFailureHandler(function () {
      bt.disabled = false;
      dizer('avisoCompra', 'erro', 'A página não conseguiu falar com o servidor.');
    }).enviarDespesaRessarcimento({
      token: tokenDespesa,
      descricao: el('cpDescricao').value,
      data_despesa: el('cpData').value,
      valor: el('cpValor').value,
      fornecedor_nome: el('cpFornecedor').value,
      anexo: arquivos[0],
      banco: dadosBanco('cp')
    });
  }, function (msg) {
    bt.disabled = false;
    dizer('avisoCompra', 'erro', msg);
  });
};

// ---- enviar: viagem ----
function totalViagem() {
  var q = Number(el('vgDiarias').value) || 0;
  var p = Number(String(el('vgPassagens').value).replace(',', '.')) || 0;
  var h = Number(String(el('vgHospedagem').value).replace(',', '.')) || 0;
  return { qtd: q, passagens: p, hospedagem: h };
}

// O valor da diária vem do servidor, pela data do evento — não é o de hoje,
// e não é digitado por quem pede. A página mostra o total antes de enviar e
// manda de volta o que mostrou: o que a pessoa viu é o que fica gravado.
var diariaVigente = 0;
var totalCalculado = 0;

function recalcularViagem() {
  var t = totalViagem();
  if (!t.qtd && !t.passagens && !t.hospedagem) {
    el('vgTotal').textContent = '';
    totalCalculado = 0;
    return;
  }
  totalCalculado = Math.round((t.qtd * diariaVigente + t.passagens
                               + t.hospedagem) * 100) / 100;
  el('vgTotal').innerHTML =
    t.qtd + ' × ' + brl(diariaVigente) + ' de diária'
    + (t.passagens ? ' + ' + brl(t.passagens) + ' de passagens' : '')
    + (t.hospedagem ? ' + ' + brl(t.hospedagem) + ' de hospedagem' : '')
    + ' = <b>' + brl(totalCalculado) + '</b>';
}

function brl(v) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',')
                  .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function buscarDiaria() {
  servidor().withSuccessHandler(function (v) {
    diariaVigente = Number(v) || 0;
    recalcularViagem();
  }).withFailureHandler(function () {
    el('vgTotal').textContent = 'Não consegui consultar o valor da diária.'
      + ' Você ainda pode enviar: a tesouraria calcula na conferência.';
  }).valorDaDiariaVigente(el('vgSaida').value || el('vgRetorno').value);
}

['vgDiarias', 'vgPassagens', 'vgHospedagem'].forEach(function (id) {
  el(id).oninput = recalcularViagem;
});
el('vgSaida').onchange = buscarDiaria;

el('btEnviarViagem').onclick = function () {
  var bt = el('btEnviarViagem');
  enviando(bt, 'avisoViagem', true);
  var t = totalViagem();

  lerArquivos('vg', function (arquivos) {
    if (!arquivos.length) {
      bt.disabled = false;
      dizer('avisoViagem', 'erro', 'Anexe pelo menos um comprovante.');
      return;
    }
    servidor().withSuccessHandler(function (r) {
      bt.disabled = false;
      dizer('avisoViagem', r.ok ? 'ok' : 'erro', r.msg);
      if (r.ok) el('passoViagem').hidden = true;
    }).withFailureHandler(function () {
      bt.disabled = false;
      dizer('avisoViagem', 'erro', 'A página não conseguiu falar com o servidor.');
    }).enviarDespesaViagem({
      token: tokenDespesa,
      evento: el('vgEvento').value,
      cidade: el('vgCidade').value,
      saida: el('vgSaida').value,
      retorno: el('vgRetorno').value,
      data_despesa: el('vgRetorno').value || el('vgSaida').value,
      descricao: 'Diárias e passagens · ' + el('vgEvento').value,
      diarias_qtd: t.qtd,
      passagens: t.passagens,
      hospedagem: t.hospedagem,
      valor: totalCalculado || '',
      anexos: arquivos,
      banco: dadosBanco('vg')
    });
  }, function (msg) {
    bt.disabled = false;
    dizer('avisoViagem', 'erro', msg);
  });
};

// ===================================================================
// MINHA ÁREA
// ===================================================================
//
// O token que a verificação devolve é a credencial de tudo o que vem
// depois: quem é o dono da área é o servidor que diz, a partir dele. O CPF
// digitado no passo 1 serve para receber o código, e mais nada.
var tokenArea = '';

mascaraCpf(el('arCpf'));

el('btArCodigo').onclick = function () {
  var bt = el('btArCodigo');
  bt.disabled = true;
  dizer('arAviso1', '', 'Enviando…');
  servidor().withSuccessHandler(function (r) {
    bt.disabled = false;
    dizer('arAviso1', r.ok ? 'ok' : 'erro', r.msg);
    if (r.ok) { el('areaPasso2').hidden = false; el('arCodigo').focus(); }
  }).withFailureHandler(function () {
    bt.disabled = false;
    dizer('arAviso1', 'erro', 'Não consegui falar com o servidor. Tente de novo.');
  }).solicitarCodigoDespesa({ cpf: el('arCpf').value });
};

el('btArEntrar').onclick = function () {
  var bt = el('btArEntrar');
  bt.disabled = true;
  dizer('arAviso2', '', 'Conferindo…');
  servidor().withSuccessHandler(function (r) {
    bt.disabled = false;
    if (!r.ok) { dizer('arAviso2', 'erro', r.msg); return; }
    tokenArea = r.token;
    // o ressarcimento passa a usar a MESMA sessão: uma entrada só
    tokenDespesa = r.token;
    dizer('arAviso2', 'ok', '');
    entrarNaArea();
  }).withFailureHandler(function () {
    bt.disabled = false;
    dizer('arAviso2', 'erro', 'Não consegui falar com o servidor. Tente de novo.');
  }).verificarCodigoDespesa({ cpf: el('arCpf').value, codigo: el('arCodigo').value });
};

function entrarNaArea() {
  el('porta-entrar').hidden = true;
  el('navPortas').hidden = false;
  el('topoAcoes').hidden = false;
  el('abaAtual').hidden = false;
  abrirPorta('consulta');
  carregarArea();
}

function abrirPorta(qual) {
  botoesPorta.forEach(function (o) {
    var lig = o.dataset.porta === qual;
    o.setAttribute('aria-current', lig ? 'true' : 'false');
    el('porta-' + o.dataset.porta).hidden = !lig;
    if (lig) el('abaAtual').textContent = o.textContent;
  });
  // No celular o menu fica por cima do conteúdo: escolhida a aba, ele sai.
  fecharMenu();
}

// --- o menu ☰ (só aparece no celular; no computador as abas estão à vista)
function fecharMenu() {
  el('topo').classList.remove('menu-aberto');
  el('btMenu').setAttribute('aria-expanded', 'false');
}
el('btMenu').onclick = function () {
  var aberto = el('topo').classList.toggle('menu-aberto');
  el('btMenu').setAttribute('aria-expanded', aberto ? 'true' : 'false');
};
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharMenu(); });

// --- o cabeçalho encolhe ao rolar. Encolhe acima de 60 px e só volta abaixo
// de 4: a faixa perde altura ao encolher, e um limite único faria a página
// curta piscar entre os dois estados.
function ajustarTopo() {
  var y = window.pageYOffset || document.documentElement.scrollTop || 0;
  var topo = el('topo');
  if (y > 60) topo.classList.add('encolhido');
  else if (y < 4) topo.classList.remove('encolhido');
}
window.addEventListener('scroll', ajustarTopo, { passive: true });
ajustarTopo();

// Sair apaga a sessão DESTA aba. O token continua válido no servidor até
// vencer — é curto de propósito —, mas some do navegador, que é o que
// importa em computador compartilhado.
el('btSair').onclick = function () {
  tokenArea = '';
  tokenDespesa = '';
  fecharMenu();
  el('navPortas').hidden = true;
  el('topoAcoes').hidden = true;
  el('abaAtual').hidden = true;
  ['porta-consulta', 'porta-despesa', 'porta-area',
   'porta-pauta', 'porta-site', 'porta-progressao'].forEach(function (id) {
    el(id).hidden = true;
  });
  // Minha progressão: rascunho, anexos e PDF gerado saem junto com a pessoa
  if (window.limparProgressao) window.limparProgressao();
  // Computador compartilhado: o rascunho de quem saiu não fica para o próximo.
  ['pautaTitulo', 'pautaTexto', 'siteTitulo', 'siteTexto'].forEach(function (id) {
    el(id).value = '';
    el(id).oninput();
  });
  dizer('pautaAviso', '', '');
  dizer('siteAviso', '', '');
  el('porta-entrar').hidden = false;
  el('areaPasso2').hidden = true;
  el('arCpf').value = '';
  el('arCodigo').value = '';
  el('arCampos').innerHTML = '';
  el('arDemonstrativo').textContent = '';
  dizer('arAviso1', 'ok', 'Você saiu. Para voltar, peça um novo código.');
  dizer('arAviso2', '', '');
};

function carregarArea() {
  servidor().withSuccessHandler(mostrarDados)
            .withFailureHandler(function () {})
            .meusDados({ token: tokenArea });
  servidor().withSuccessHandler(mostrarDemonstrativo)
            .withFailureHandler(function () {})
            .meuDemonstrativo({ token: tokenArea });
  servidor().withSuccessHandler(mostrarLembretes)
            .withFailureHandler(function () {})
            .meusLembretes({ token: tokenArea });
}

function escapar(t) {
  var d = document.createElement('div');
  d.textContent = String(t === null || t === undefined ? '' : t);
  return d.innerHTML;
}

function moeda(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

function mostrarDados(r) {
  if (r.erro) { dizer('arAvisoDados', 'erro', r.erro); return; }
  el('arOla').textContent = 'Olá, ' + r.nome + '!';
  var h = '';
  r.campos.forEach(function (c) {
    h += '<label>' + escapar(c.rotulo)
      + '<input type="text" data-campo="' + escapar(c.campo) + '" value="'
      + escapar(c.atual) + '">'
      + '<span class="ajuda">no cadastro: ' + escapar(c.atual || '(vazio)')
      + (c.emAnalise ? ' · pedido em análise: ' + escapar(c.emAnalise) : '')
      + '</span></label>';
  });
  el('arCampos').innerHTML = h;
  if (r.carreira && r.carreira.regime) {
    el('arRegime').value = r.carreira.regime;
    if (el('arRegime').value) el('arRegime').onchange();
  }
  // a porta Minha progressão aproveita nome e carreira, sem nova chamada
  if (window.progressaoComDados) window.progressaoComDados(r);
}

el('btArDados').onclick = function () {
  var bt = el('btArDados');
  var campos = {};
  [].slice.call(el('arCampos').querySelectorAll('input[data-campo]'))
    .forEach(function (i) { campos[i.dataset.campo] = i.value; });
  bt.disabled = true;
  dizer('arAvisoDados', '', 'Registrando…');
  servidor().withSuccessHandler(function (r) {
    bt.disabled = false;
    dizer('arAvisoDados', r.ok ? 'ok' : 'erro', r.msg || r.erro);
    if (r.ok) {
      servidor().withSuccessHandler(mostrarDados).withFailureHandler(function () {})
                .meusDados({ token: tokenArea });
    }
  }).withFailureHandler(function () {
    bt.disabled = false;
    dizer('arAvisoDados', 'erro', 'Não consegui falar com o servidor.');
  }).pedirAtualizacao({ token: tokenArea, campos: campos });
};

// ===================================================================
// PAUTA E TEXTOS PARA O SITE
// ===================================================================
//
// Os campos só se limpam depois de "Recebido". Em qualquer erro — inclusive
// sessão vencida no meio de um texto longo — o que a pessoa escreveu fica.
function montarEnvio(prefixo, chamar) {
  var titulo = el(prefixo + 'Titulo'), texto = el(prefixo + 'Texto');
  var conta = el(prefixo + 'Conta'), bt = el(prefixo + 'Enviar');
  var limite = Number(texto.getAttribute('data-limite'));
  var limiteTitulo = Number(titulo.getAttribute('data-limite'));
  // Acima do limite, avisa e desliga o botão — sem cortar: quem colou um
  // texto maior decide o que tirar.
  function atualizar() {
    var n = texto.value.length;
    var passou = n > limite || titulo.value.length > limiteTitulo;
    conta.textContent = n.toLocaleString('pt-BR') + ' de ' + limite.toLocaleString('pt-BR')
      + (n > limite ? ' — passou ' + (n - limite).toLocaleString('pt-BR')
                      + ' caracteres; encurte para enviar' : '')
      + (titulo.value.length > limiteTitulo
           ? ' — o título passa de ' + limiteTitulo + ' caracteres' : '');
    bt.disabled = passou || !titulo.value.trim() || !texto.value.trim();
  }
  titulo.oninput = atualizar;
  texto.oninput = atualizar;
  atualizar();
  bt.onclick = function () {
    bt.disabled = true;
    dizer(prefixo + 'Aviso', '', 'Enviando…');
    chamar(servidor().withSuccessHandler(function (r) {
      if (r.ok) { titulo.value = ''; texto.value = ''; }
      atualizar();
      dizer(prefixo + 'Aviso', r.ok ? 'ok' : 'erro', r.ok ? r.msg : r.erro);
    }).withFailureHandler(function () {
      atualizar();
      dizer(prefixo + 'Aviso', 'erro',
            'Não consegui falar com o servidor. Seu texto continua aqui.');
    }), { token: tokenArea, titulo: titulo.value, texto: texto.value });
  };
}
montarEnvio('pauta', function (c, d) { c.enviarPropostaDePauta(d); });
montarEnvio('site', function (c, d) { c.enviarTextoParaSite(d); });

function mostrarDemonstrativo(r) {
  if (r.erro) { el('arDemonstrativo').textContent = r.erro; return; }
  var linhas = [];
  linhas.push(['Situação', r.quitado ? 'em dia' : 'com pendência']);
  linhas.push(['Período apurado', r.periodo.de + ' a ' + r.periodo.ate]);
  // A contribuição de hoje, pela carreira declarada — o mesmo número que o
  // PDF imprime em "Devida hoje". Vem antes da de referência porque é a
  // pergunta que a pessoa faz ao abrir a tela: quanto eu pago.
  if (r.carreira) {
    linhas.push(['Contribuição atual', moeda(r.valorAtual)
                 + ' · ' + r.carreira.regime + ' · ' + r.carreira.classe
                 + ' · ' + r.carreira.titulacao]);
  } else {
    linhas.push(['Contribuição atual', r.motivoCarreira
                 + ' Informe-os em Meus dados.']);
  }
  linhas.push(['Contribuição de referência', moeda(r.mensalidade)
               + (r.baseMensalidade ? ' (' + r.baseMensalidade + ')' : '')]);
  // Três números que fecham: pago − devido = saldo. A dívida só desce
  // quando a quitação perdoou algo, e aí vem com a ponte que explica.
  linhas.push(['Pago no período', moeda(r.pago)]);
  linhas.push(['Devido no período', moeda(r.devido)
               + (r.mesesAfastada ? ' · ' + r.mesesAfastada
                  + ' mês(es) de afastamento fora da conta' : '')]);
  linhas.push(['Saldo', r.saldo]);
  if (r.pontePerdao) {
    linhas.push(['Quitado', r.pontePerdao]);
    linhas.push(['Dívida', moeda(r.divida)]);
  }
  // Quem aderiu à anistia vê quanto depositou na negociação, e o que restou.
  if (r.notaAdesao) linhas.push(['Adesão à anistia', r.notaAdesao]);
  if (r.ultimoPagamento) {
    linhas.push(['Último pagamento', r.ultimoPagamento
                 + (r.ultimoValor ? ' · ' + moeda(r.ultimoValor) : '')]);
  }
  // A nota diz até quando, por qual ato, e quanto do que a pessoa pagou caiu
  // em mês já quitado — que é o que explica um devido zerado ao lado de um
  // período de dois anos.
  if (r.notaQuitacao) linhas.push(['Situação quitada', r.notaQuitacao]);
  if (r.mesesSemPagamento && r.mesesSemPagamento.length) {
    linhas.push(['Meses sem pagamento', r.mesesSemPagamento.join(', ')]);
  }
  if (r.anistiaAberta && r.aDepositar) {
    linhas.push(['Proposta de anistia', 'depositar ' + moeda(r.aDepositar)
                 + ' até ' + r.prazoAnistia
                 + (r.perdao ? ' · perdão de ' + moeda(r.perdao) : '')]);
  }
  var h = '<table>';
  linhas.forEach(function (l) {
    h += '<tr><th style="text-align:left;padding:.25rem .8rem .25rem 0">'
      + escapar(l[0]) + '</th><td>' + escapar(l[1]) + '</td></tr>';
  });
  h += '</table>';
  el('arDemonstrativo').innerHTML = h;
  if (r.jaPediuHoje) {
    el('btArEmail').textContent = 'Já enviado hoje';
  }
}

el('btArPdf').onclick = function () {
  var bt = el('btArPdf');
  bt.disabled = true;
  dizer('arAvisoDem', '', 'Gerando o arquivo…');
  servidor().withSuccessHandler(function (r) {
    bt.disabled = false;
    if (r.erro) { dizer('arAvisoDem', 'erro', r.erro); return; }
    // O Chrome do Android RECUSA baixar de um data: URL — a pessoa recebe
    // "não foi possível abrir o arquivo" e nada acontece (relatado pela
    // tesouraria em 19/09/2026). Com blob: funciona nos dois mundos, e o
    // navegador ganha um arquivo de verdade, com tipo e nome.
    var bytes = atob(r.base64);
    var buf = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    var blob = new Blob([buf], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    // No iOS o atributo download é ignorado e o clique não baixa nada: lá o
    // caminho é abrir o PDF numa aba, que o próprio Safari salva ou
    // compartilha.
    if ('download' in a) {
      a.href = url;
      a.download = r.nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      dizer('arAvisoDem', 'ok', 'Arquivo baixado: ' + r.nome);
    } else {
      window.open(url, '_blank');
      dizer('arAvisoDem', 'ok', 'O PDF abriu numa aba nova.');
    }
    // o endereço do blob morre com a aba; solta-se a memória depois do
    // clique, e não antes — revogar cedo demais cancela o download
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }).withFailureHandler(function () {
    bt.disabled = false;
    dizer('arAvisoDem', 'erro', 'Não consegui gerar o arquivo agora.');
  }).baixarMeuDemonstrativo({ token: tokenArea });
};

el('btArEmail').onclick = function () {
  var bt = el('btArEmail');
  bt.disabled = true;
  dizer('arAvisoDem', '', 'Enviando…');
  servidor().withSuccessHandler(function (r) {
    bt.disabled = false;
    dizer('arAvisoDem', r.erro ? 'erro' : 'ok', r.erro || r.msg);
  }).withFailureHandler(function () {
    bt.disabled = false;
    dizer('arAvisoDem', 'erro', 'Não consegui enviar agora.');
  }).enviarMeuDemonstrativo({ token: tokenArea });
};

el('btArCarreira').onclick = function () {
  var bt = el('btArCarreira');
  bt.disabled = true;
  dizer('arAvisoCarreira', '', 'Registrando…');
  servidor().withSuccessHandler(function (r) {
    bt.disabled = false;
    dizer('arAvisoCarreira', r.erro ? 'erro' : 'ok', r.erro || r.msg);
    if (!r.erro) {
      servidor().withSuccessHandler(mostrarDemonstrativo)
                .withFailureHandler(function () {})
                .meuDemonstrativo({ token: tokenArea });
    }
  }).withFailureHandler(function () {
    bt.disabled = false;
    dizer('arAvisoCarreira', 'erro', 'Não consegui falar com o servidor.');
  }).atualizarMinhaCarreira({ token: tokenArea, regime: el('arRegime').value,
                              classe: el('arClasse').value,
                              titulacao: el('arTitulacao').value });
};

function mostrarLembretes(r) {
  if (r.erro) { dizer('arAvisoLem', 'erro', r.erro); return; }
  el('arLemEmail').checked = !!r.email;
}

el('btArLembretes').onclick = function () {
  var bt = el('btArLembretes');
  bt.disabled = true;
  dizer('arAvisoLem', '', 'Salvando…');
  servidor().withSuccessHandler(function (r) {
    bt.disabled = false;
    if (r.erro) { dizer('arAvisoLem', 'erro', r.erro); return; }
    dizer('arAvisoLem', 'ok', r.msg);
    if (r.preferencias) mostrarLembretes(r.preferencias);
  }).withFailureHandler(function () {
    bt.disabled = false;
    dizer('arAvisoLem', 'erro', 'Não consegui falar com o servidor.');
  }).salvarMeusLembretes({ token: tokenArea,
                           email: el('arLemEmail').checked });
};

// os mesmos seletores de carreira da consulta, na área
function montarCarreiraDaArea() {
  var reg = el('arRegime'), cla = el('arClasse'), tit = el('arTitulacao');
  OPCOES.regimes.forEach(function (r) {
    var o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.nome + ' (' + r.detalhe + ')';
    reg.appendChild(o);
  });
  reg.onchange = function () {
    var r = OPCOES.regimes.filter(function (x) { return x.id === reg.value; })[0];
    tit.innerHTML = '<option value="">Selecione a classe antes</option>';
    tit.disabled = true;
    if (!r) {
      cla.innerHTML = '<option value="">Selecione o regime antes</option>';
      cla.disabled = true;
      return;
    }
    encher(cla, r.classes.map(function (c) {
      return { valor: c.classe, rotulo: c.classe + ' — ' + c.denominacao };
    }), 'Selecione');
  };
  cla.onchange = function () {
    var r = OPCOES.regimes.filter(function (x) { return x.id === reg.value; })[0];
    var c = r && r.classes.filter(function (x) { return x.classe === cla.value; })[0];
    if (!c) { tit.innerHTML = '<option value="">Selecione a classe antes</option>';
              tit.disabled = true; return; }
    encher(tit, c.titulacoes.map(function (t) {
      return { valor: t, rotulo: t };
    }), 'Selecione');
  };
}

servidor().withSuccessHandler(function (c) {
  OPCOES = c.opcoes;
  montarCarreiraDaArea();
}).withFailureHandler(function () {
  el('arRegime').innerHTML = '<option value="">Não consegui carregar a tabela. Recarregue a página.</option>';
}).configuracaoArea();

// ===================================================================
// SAIR DOS LEMBRETES (?sair=TOKEN, o link do rodapé do e-mail)
// ===================================================================
(function () {
  var token = new URLSearchParams(location.search).get('sair');
  if (!token) return;
  el('porta-entrar').hidden = true;
  el('porta-sair').hidden = false;
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
    }).sairDoLembrete({ token: token });
  };
})();
