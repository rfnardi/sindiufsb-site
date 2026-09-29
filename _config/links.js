// Link para PDF (os documentos anexados pelo CMS e os PDFs de fora, como as
// circulares do ANDES) abre em nova aba: quem lê não perde a página do post.
export function pdfEmNovaAba(html) {
  return html.replace(/<a\b[^>]*>/gi, (tag) => {
    const href = (tag.match(/\bhref=["']([^"']*)["']/i) || [])[1] || '';
    if (!/\.pdf$/i.test(href.split(/[?#]/)[0]) || /\btarget=/i.test(tag)) return tag;
    return tag.replace(/>$/, ' target="_blank" rel="noopener">');
  });
}
