// Remove do HTML gerado as <img> que quebrariam: blob:/data: e caminhos
// locais inexistentes. Se a imagem era o único conteúdo de um link, o link
// sai junto. Devolve o HTML e a lista do que foi removido (para o log).
export function imagemQuebrada(src, existe) {
  return /^(blob|data):/i.test(src) || (/^\/(?!\/)/.test(src) && !existe(src.split(/[?#]/)[0]));
}

export function limparImagens(html, existe) {
  const removidas = [];
  const quebrada = (src) => imagemQuebrada(src, existe);
  let saida = html.replace(/<a\b[^>]*>\s*(<img\b[^>]*>)\s*<\/a>/gi, (tudo, img) => {
    const src = (img.match(/\bsrc=["']([^"']*)["']/i) || [])[1] || '';
    if (!quebrada(src)) return tudo;
    removidas.push(src);
    return '';
  });
  saida = saida.replace(/<img\b[^>]*>/gi, (img) => {
    const src = (img.match(/\bsrc=["']([^"']*)["']/i) || [])[1] || '';
    if (!quebrada(src)) return img;
    removidas.push(src);
    return '';
  });
  return { html: saida, removidas };
}
