// Nenhuma imagem quebrada à vista: se uma <img> falhar ao carregar (imagem
// externa que sumiu, por exemplo), ela some — e o link que só a embrulhava
// também. Na lista de posts, o card perde a coluna da miniatura e o texto
// ocupa a largura toda, como num post sem imagem.
document.addEventListener('error', function (e) {
  var img = e.target;
  if (!img || img.tagName !== 'IMG') return;
  var card = img.closest('.item-lista');
  if (card) card.classList.remove('com-imagem');
  if (img.closest('.destaque-imagem')) {
    img.replaceWith(Object.assign(document.createElement('span'), { className: 'sem-imagem' }));
    return;
  }
  var alvo = img.parentNode && img.parentNode.tagName === 'A' && img.parentNode.children.length === 1 ? img.parentNode : img;
  alvo.remove();
}, true);
