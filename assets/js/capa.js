// Carrossel da capa: troca a foto a cada 7 s com fade. Pausa com o botão,
// com o mouse em cima ou com o foco dentro. Quem pede menos movimento
// começa pausado. Sem JavaScript fica a primeira foto, parada.
(function () {
  var hero = document.querySelector('.hero');
  var fotos = hero ? hero.querySelectorAll('.hero-foto') : [];
  if (fotos.length < 2) return;
  var pontos = hero.querySelectorAll('.hero-ponto');
  var pausa = hero.querySelector('.hero-pausa');
  var atual = 0, timer = null, suspenso = false;
  var pausado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  hero.querySelector('.hero-controles').hidden = false;

  function mostrar(i) {
    fotos[atual].classList.remove('ativa'); fotos[atual].setAttribute('aria-hidden', 'true');
    pontos[atual].removeAttribute('aria-current');
    atual = (i + fotos.length) % fotos.length;
    fotos[atual].classList.add('ativa'); fotos[atual].removeAttribute('aria-hidden');
    pontos[atual].setAttribute('aria-current', 'true');
  }
  function parar() { clearInterval(timer); timer = null; }
  function rodar() {
    parar();
    if (!pausado && !suspenso) timer = setInterval(function () { mostrar(atual + 1); }, 7000);
  }
  function botao() {
    pausa.setAttribute('aria-label', pausado ? 'Continuar fotos' : 'Pausar fotos');
    pausa.classList.toggle('pausado', pausado);
  }

  pausa.addEventListener('click', function () { pausado = !pausado; botao(); rodar(); });
  Array.prototype.forEach.call(pontos, function (p, i) {
    p.addEventListener('click', function () { mostrar(i); rodar(); });
  });
  hero.addEventListener('mouseenter', function () { suspenso = true; parar(); });
  hero.addEventListener('mouseleave', function () { suspenso = false; rodar(); });
  hero.addEventListener('focusin', function () { suspenso = true; parar(); });
  hero.addEventListener('focusout', function (e) { if (!hero.contains(e.relatedTarget)) { suspenso = false; rodar(); } });
  botao(); rodar();
})();
