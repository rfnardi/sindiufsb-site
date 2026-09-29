import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfEmNovaAba } from '../_config/links.js';

test('link para PDF abre em nova aba (do site e de fora)', () => {
  assert.equal(pdfEmNovaAba('<a href="/documentos/edital-1234abcd.pdf">Edital (PDF)</a>'),
    '<a href="/documentos/edital-1234abcd.pdf" target="_blank" rel="noopener">Edital (PDF)</a>');
  assert.equal(pdfEmNovaAba('<a class="x" href="https://www.andes.org.br/Circ067.PDF?v=1#p2">Circular</a>'),
    '<a class="x" href="https://www.andes.org.br/Circ067.PDF?v=1#p2" target="_blank" rel="noopener">Circular</a>');
});

test('outros links ficam como estão, e quem já tem target não é mexido', () => {
  const html = '<a href="/2026/09/post.html">post</a> <a href="/pdf-e-outras-coisas.html">p</a> ' +
    '<a href="/documentos/a.pdf" target="_self">a</a>';
  assert.equal(pdfEmNovaAba(html), html);
});
