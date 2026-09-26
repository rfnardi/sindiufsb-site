// Nenhuma imagem quebrada à vista: se uma <img> falhar ao carregar (imagem
// externa que sumiu, por exemplo), ela some — e o link que só a embrulhava
// também. Nos cards, sobra o fundo padrão de "sem imagem".
document.addEventListener('error', function (e) {
  var img = e.target;
  if (!img || img.tagName !== 'IMG') return;
  var alvo = img.parentNode && img.parentNode.tagName === 'A' && img.parentNode.children.length === 1 ? img.parentNode : img;
  if (img.closest('.item-lista, .destaque-imagem')) {
    img.replaceWith(Object.assign(document.createElement('span'), { className: 'sem-imagem' }));
    return;
  }
  alvo.remove();
}, true);
