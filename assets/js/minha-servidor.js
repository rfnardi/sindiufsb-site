// O transporte da Minha SindiUFSB: as chamadas ao Apps Script da tesouraria.
//
// Até 10/2026 a página era servida pelo próprio Apps Script e chamava o
// servidor pelo google.script.run. Quem tinha mais de uma conta Google logada
// recebia "Não foi possível abrir o arquivo" e nem via a página. Agora a
// página mora aqui e fala com o doPost da tesouraria (Api.gs no repositório
// sindiufsb-tesouraria) por fetch:
//   - credentials: 'omit' — nenhum cookie do Google vai junto, então a
//     chamada é anônima e as várias contas não atrapalham;
//   - text/plain — pedido "simples", sem pré-voo de CORS (o Apps Script não
//     responde OPTIONS).
// A interface é a mesma do google.script.run (withSuccessHandler,
// withFailureHandler, nome da função), para o resto da página não mudar.
// Resposta { ok: true, r } → withSuccessHandler(r); { erro } ou falha de
// rede → withFailureHandler(Error).
window.criarServidor = function (api, marcarEspera, botaoDoClique) {
  return function servidor() {
    var ok = null, falha = null;
    var botao = botaoDoClique ? botaoDoClique() : null;
    var cadeia = new Proxy({}, {
      get: function (alvo, nome) {
        if (nome === 'withSuccessHandler') return function (f) { ok = f; return cadeia; };
        if (nome === 'withFailureHandler') return function (f) { falha = f; return cadeia; };
        return function () {
          var args = [].slice.call(arguments);
          var aberta = true;
          var fechar = function () {
            if (aberta) { aberta = false; marcarEspera(-1, botao); }
          };
          marcarEspera(+1, botao);
          fetch(api, {
            method: 'POST',
            credentials: 'omit',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ funcao: nome, args: args })
          }).then(function (resp) {
            return resp.json();
          }).then(function (corpo) {
            fechar();
            if (corpo && corpo.ok === true) { if (ok) ok(corpo.r); return; }
            var erro = new Error((corpo && corpo.erro) || 'Resposta inesperada do servidor.');
            if (falha) falha(erro);
          }, function (e) {
            fechar();
            if (falha) falha(e instanceof Error ? e : new Error(String(e)));
          });
        };
      }
    });
    return cadeia;
  };
};
