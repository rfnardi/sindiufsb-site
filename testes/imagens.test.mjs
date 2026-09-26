import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limparImagens, imagemQuebrada } from '../_config/imagens.js';

const existe = (src) => src === '/imagens/ok.jpg';

test('remove blob:, data: e local inexistente; mantém o resto', () => {
  const html = '<p><img src="/imagens/ok.jpg"><img src="blob:https://www.blogger.com/x">' +
    '<img src="data:image/png;base64,AA"><img src="/imagens/sumiu.jpg"><img src="https://ex.com/a.png"></p>';
  const r = limparImagens(html, existe);
  assert.equal(r.html, '<p><img src="/imagens/ok.jpg"><img src="https://ex.com/a.png"></p>');
  assert.equal(r.removidas.length, 3);
});

test('link que só embrulhava a imagem quebrada sai junto', () => {
  const r = limparImagens('<a href="/imagens/sumiu.jpg"><img src="/imagens/sumiu.jpg"></a><a href="/x"><img src="/imagens/ok.jpg"></a>', existe);
  assert.equal(r.html, '<a href="/x"><img src="/imagens/ok.jpg"></a>');
});

test('imagemQuebrada: externas passam; blob, data e local inexistente não', () => {
  assert.equal(imagemQuebrada('https://ex.com/a.png', existe), false);
  assert.equal(imagemQuebrada('/imagens/ok.jpg', existe), false);
  assert.equal(imagemQuebrada('/imagens/ok.jpg?v=2', existe), false);
  assert.equal(imagemQuebrada('/imagens/sumiu.jpg', existe), true);
  assert.equal(imagemQuebrada('blob:https://x/1', existe), true);
});
