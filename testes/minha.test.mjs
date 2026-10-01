import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// A Minha SindiUFSB chama o Apps Script da tesouraria por fetch
// (assets/js/minha-servidor.js). O teste carrega o arquivo como o navegador
// carrega e troca o fetch por um falso.
function carregar(respostaFalsa) {
  const chamadas = [];
  const ctx = {
    fetch: (url, opcoes) => { chamadas.push({ url, opcoes }); return respostaFalsa(); },
    Proxy, JSON, Promise, Error,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../assets/js/minha-servidor.js', import.meta.url), 'utf8'), ctx);
  const espera = { n: 0, max: 0 };
  const servidor = ctx.criarServidor('https://script.google.com/macros/s/X/exec', (passo) => {
    espera.n += passo; espera.max = Math.max(espera.max, espera.n);
  });
  return { servidor, chamadas, espera };
}

const json = (corpo) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) });
const chamar = (servidor, montar) => new Promise((ok, falha) => {
  montar(servidor().withSuccessHandler(ok).withFailureHandler(falha));
});

test('sucesso: manda função e argumentos como text/plain e entrega o retorno', async () => {
  const { servidor, chamadas, espera } = carregar(json({ ok: true, r: { ok: true, nome: 'Ana' } }));
  const r = await chamar(servidor, (c) => c.meusDados({ token: 't' }));
  assert.deepEqual({ ...r }, { ok: true, nome: 'Ana' });
  assert.equal(chamadas[0].url, 'https://script.google.com/macros/s/X/exec');
  assert.equal(chamadas[0].opcoes.method, 'POST');
  assert.equal(chamadas[0].opcoes.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), { funcao: 'meusDados', args: [{ token: 't' }] });
  assert.equal(chamadas[0].opcoes.credentials, 'omit', 'sem cookie do Google: é isso que evita o erro das várias contas');
  assert.equal(espera.max, 1);
  assert.equal(espera.n, 0);
});

test('erro da porta (função recusada, falha genérica) vai para o withFailureHandler', async () => {
  const { servidor, espera } = carregar(json({ erro: 'Não consegui atender agora. Tente em instantes.' }));
  await assert.rejects(chamar(servidor, (c) => c.meusDados({})), /Não consegui atender agora/);
  assert.equal(espera.n, 0);
});

test('falha de rede vai para o withFailureHandler e a espera volta a zero', async () => {
  const { servidor, espera } = carregar(() => Promise.reject(new TypeError('Failed to fetch')));
  await assert.rejects(chamar(servidor, (c) => c.valorDaDiariaVigente('2026-09-10')));
  assert.equal(espera.n, 0);
});

test('resposta que não é JSON (página de erro do Google) também cai no withFailureHandler', async () => {
  const { servidor, espera } = carregar(() => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('x')) }));
  await assert.rejects(chamar(servidor, (c) => c.meusDados({})));
  assert.equal(espera.n, 0);
});
