import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventoDoPost, proximosEventos, linkGoogleAgenda, ics } from '../_config/eventos.js';

const assembleia = (data, extra = {}) => ({ url: `/a-${data}.html`, data: {
  title: `Convocação ${data}`, convocacao: true, assembleia_data: data, assembleia_hora1: '13:30', assembleia_hora2: '14:00',
  salas: ['Campus Jorge Amado (CJA): Sala 104', 'Campus Paulo Freire (CPF): a confirmar'], ...extra } });
const debate = (data) => ({ url: `/d-${data}.html`, data: {
  title: 'Carreira docente', debate: true, debate_data: data, debate_inicio: '18:00', debate_fim: '20:00' } });

test('assembleia: horário da Bahia, 3 h de duração e salas', () => {
  const e = eventoDoPost(assembleia('2026-10-02'));
  assert.equal(e.inicio.toISOString(), '2026-10-02T16:30:00.000Z');
  assert.equal(e.fim.toISOString(), '2026-10-02T19:30:00.000Z');
  assert.equal(e.horaTexto, '13h30 (1ª chamada), 14h (2ª chamada)');
  assert.equal(e.locais.length, 2);
});

test('debate: nunca tem link; post comum ou sem data não é evento', () => {
  const e = eventoDoPost(debate('2026-10-08'));
  assert.equal(e.horaTexto, '18h às 20h');
  assert.match(e.onde, /enviado por e-mail/);
  assert.equal(eventoDoPost({ url: '/x', data: { title: 'Nota' } }), null);
  assert.equal(eventoDoPost({ url: '/x', data: { convocacao: true, title: 'Migrada' } }), null);
});

test('próximos: só o que não terminou, o mais próximo de cada tipo', () => {
  const agora = new Date('2026-10-02T18:00:00Z');   // durante a assembleia do dia 2
  const r = proximosEventos([assembleia('2026-11-10'), assembleia('2026-10-02'), assembleia('2026-09-01'),
    debate('2026-10-08'), debate('2026-10-20')], agora);
  assert.deepEqual(r.map((e) => e.url), ['/a-2026-10-02.html', '/d-2026-10-08.html']);
  assert.equal(proximosEventos([assembleia('2026-10-02')], new Date('2026-10-02T19:31:00Z')).length, 0);
});

test('agenda: link do Google e arquivo .ics com horário em UTC', () => {
  const e = eventoDoPost(assembleia('2026-10-02'));
  const g = new URL(linkGoogleAgenda(e, 'https://sindiufsb.org.br/a.html'));
  assert.equal(g.searchParams.get('dates'), '20261002T163000Z/20261002T193000Z');
  const texto = ics(e, 'https://sindiufsb.org.br/a.html', 'a-2026-10-02');
  assert.match(texto, /\r\nDTSTART:20261002T163000Z\r\n/);
  assert.match(texto, /SUMMARY:Convocação 2026-10-02/);
  assert.ok(texto.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));
});
