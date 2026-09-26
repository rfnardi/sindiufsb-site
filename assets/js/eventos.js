// Esconde da página inicial o evento que já terminou, caso o site ainda não
// tenha sido reconstruído (o Action roda uma vez por dia).
(function () {
  var secao = document.querySelector('.eventos');
  if (!secao) return;
  var agora = Date.now();
  secao.querySelectorAll('.evento[data-fim]').forEach(function (e) {
    if (Date.parse(e.dataset.fim) <= agora) e.hidden = true;
  });
  if (!secao.querySelector('.evento:not([hidden])')) secao.hidden = true;
})();
