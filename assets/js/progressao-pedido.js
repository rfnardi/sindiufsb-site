// Porta "Minha progressão": salvar o pedido em construção.
//
// Decisão da tesouraria (07/10/2026): o docente monta o pedido em várias
// etapas, então ele fica salvo de dois jeitos, e nenhum passa pelo servidor:
//   - NESTE NAVEGADOR, sozinho, com os anexos (IndexedDB). Sobrevive ao Sair;
//     a caixa "computador compartilhado" desliga.
//   - NUM ARQUIVO (.zip com pedido.json e os anexos), que o docente baixa e
//     abre em qualquer computador.
// O SIAPE não é guardado em nenhum dos dois; o XML do Lattes nunca chega
// aqui.
window.ProgressaoPedido = (function () {
  var FORMATO = 'sindiufsb-progressao';
  var VERSAO = 1;
  var NAO_E_PEDIDO = 'Este arquivo não é um pedido salvo pela Minha progressão.';

  /** Cópia do estado sem o que não se guarda. */
  function limpo(estado) {
    var e = JSON.parse(JSON.stringify(estado || {}));
    if (e.carreira) delete e.carreira.siape;
    delete e.siape;
    return e;
  }

  function nomeSeguro(n) {
    return String(n || 'anexo').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 120);
  }

  /**
   * estado + anexos [{ lancamento, nome, tipo, bytes, auto }] -> bytes do
   * .zip. `auto` marca a primeira página que o sistema trouxe pelo DOI.
   */
  function pedidoParaZip(estado, anexos) {
    var e = limpo(estado);
    var arquivos = [];
    e.anexos = (anexos || []).map(function (a, i) {
      var caminho = 'anexos/' + (i + 1) + '-' + nomeSeguro(a.nome);
      arquivos.push({ nome: caminho, bytes: a.bytes });
      return { lancamento: a.lancamento, nome: a.nome, tipo: a.tipo, auto: !!a.auto, arquivo: caminho };
    });
    e.formato = FORMATO;
    e.versao = VERSAO;
    e.salvoEm = new Date().toISOString();
    var json = new TextEncoder().encode(JSON.stringify(e, null, 1));
    return window.ProgressaoZip.montarZip([{ nome: 'pedido.json', bytes: json }].concat(arquivos));
  }

  /** bytes do .zip -> Promise<{ estado, anexos }>. */
  function pedidoDoZip(bytes) {
    return window.ProgressaoZip.lerZip(bytes).then(function (itens) {
      var porNome = {};
      itens.forEach(function (i) { porNome[i.nome] = i.bytes; });
      if (!porNome['pedido.json']) throw new Error(NAO_E_PEDIDO);
      var e;
      try { e = JSON.parse(new TextDecoder().decode(porNome['pedido.json'])); } catch (err) { throw new Error(NAO_E_PEDIDO); }
      if (!e || e.formato !== FORMATO) throw new Error(NAO_E_PEDIDO);
      if (e.versao > VERSAO) {
        throw new Error('Este pedido foi salvo por uma versão mais nova da página. Recarregue a página e tente de novo.');
      }
      var anexos = (e.anexos || []).filter(function (a) { return porNome[a.arquivo]; }).map(function (a) {
        return { lancamento: a.lancamento, nome: a.nome, tipo: a.tipo, auto: !!a.auto, bytes: porNome[a.arquivo] };
      });
      delete e.anexos; delete e.formato; delete e.versao;
      return { estado: limpo(e), anexos: anexos, salvoEm: e.salvoEm || '' };
    }, function () { throw new Error(NAO_E_PEDIDO); });
  }

  // ---------------------------------------------------------- navegador
  /**
   * O cofre deste navegador, sobre um armazenamento chave-valor com
   * promessas ({ get, set, del }). No navegador é o IndexedDB
   * (armazenamentoIndexedDB, abaixo); no teste, um Map.
   */
  function criarCofre(arm) {
    var CHAVE = 'pedido';
    return {
      guardar: function (estado, anexos) {
        return arm.set(CHAVE, { versao: VERSAO, salvoEm: new Date().toISOString(), estado: limpo(estado),
          anexos: (anexos || []).map(function (a) {
            return { lancamento: a.lancamento, nome: a.nome, tipo: a.tipo, auto: !!a.auto, bytes: a.bytes };
          }) });
      },
      recuperar: function () {
        return arm.get(CHAVE).then(function (r) {
          if (!r || !r.estado || r.versao > VERSAO) return null;
          return { estado: r.estado, anexos: r.anexos || [], salvoEm: r.salvoEm };
        });
      },
      apagar: function () { return arm.del(CHAVE); }
    };
  }

  /** O IndexedDB do navegador como { get, set, del }. null se não houver. */
  function armazenamentoIndexedDB() {
    if (typeof indexedDB === 'undefined') return null;
    var banco = null;
    function abrir() {
      if (banco) return banco;
      banco = new Promise(function (ok, falha) {
        var req = indexedDB.open('minha-progressao', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('pedidos'); };
        req.onsuccess = function () { ok(req.result); };
        req.onerror = function () { banco = null; falha(req.error); };
      });
      return banco;
    }
    function op(modo, faz) {
      return abrir().then(function (db) {
        return new Promise(function (ok, falha) {
          var tx = db.transaction('pedidos', modo);
          var req = faz(tx.objectStore('pedidos'));
          tx.oncomplete = function () { ok(req && req.result); };
          tx.onerror = function () { falha(tx.error); };
          tx.onabort = function () { falha(tx.error); };
        });
      });
    }
    return {
      get: function (k) { return op('readonly', function (s) { return s.get(k); }); },
      set: function (k, v) { return op('readwrite', function (s) { return s.put(v, k); }); },
      del: function (k) { return op('readwrite', function (s) { return s.delete(k); }); }
    };
  }

  return { pedidoParaZip: pedidoParaZip, pedidoDoZip: pedidoDoZip, criarCofre: criarCofre,
           armazenamentoIndexedDB: armazenamentoIndexedDB };
})();
