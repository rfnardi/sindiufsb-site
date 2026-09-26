// Próximos eventos (assembleias e debates online) para o destaque da página
// inicial. Os dados vêm do cabeçalho que o CMS grava nos posts:
// assembleia_data/assembleia_hora1/salas e debate_data/debate_inicio/debate_fim.
// O fuso da Bahia é fixo em -03:00 (sem horário de verão).

const DURACAO_ASSEMBLEIA_H = 3;   // a convocação não diz o término

const hora = (h) => /^\d{2}:\d{2}$/.test(String(h || '')) ? String(h) : null;
const instante = (data, h) => new Date(`${data}T${h}:00-03:00`);

export function eventoDoPost(post) {
  const d = post.data || {};
  if (d.convocacao === true && /^\d{4}-\d{2}-\d{2}$/.test(String(d.assembleia_data || '')) && hora(d.assembleia_hora1)) {
    const inicio = instante(d.assembleia_data, d.assembleia_hora1);
    return {
      tipo: 'assembleia', rotulo: 'Próxima assembleia', titulo: d.title, url: post.url, id: idDe(post.url),
      inicio, fim: new Date(inicio.getTime() + DURACAO_ASSEMBLEIA_H * 3600e3),
      horaTexto: horaTexto(d.assembleia_hora1) + ' (1ª chamada)' +
        (hora(d.assembleia_hora2) ? ', ' + horaTexto(d.assembleia_hora2) + ' (2ª chamada)' : ''),
      locais: (d.salas || []).map(String),
      onde: 'Presencial nos campi da UFSB' + ((d.salas || []).length ? ': ' + d.salas.join('; ') : ''),
    };
  }
  if (d.debate === true && /^\d{4}-\d{2}-\d{2}$/.test(String(d.debate_data || '')) && hora(d.debate_inicio)) {
    const inicio = instante(d.debate_data, d.debate_inicio);
    const fim = hora(d.debate_fim) ? instante(d.debate_data, d.debate_fim) : new Date(inicio.getTime() + 2 * 3600e3);
    return {
      tipo: 'debate', rotulo: 'Próximo debate online', titulo: d.title, url: post.url, id: idDe(post.url), inicio, fim,
      horaTexto: horaTexto(d.debate_inicio) + (hora(d.debate_fim) ? ' às ' + horaTexto(d.debate_fim) : ''),
      locais: [],
      // O link da sala nunca está no site: só nos e-mails aos sindicalizados.
      onde: 'Online. O link é enviado por e-mail aos sindicalizados.',
    };
  }
  return null;
}

const idDe = (url) => String(url).replace(/\.html$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

function horaTexto(h) {
  const [hh, mm] = h.split(':');
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`;
}

/** Eventos que ainda não terminaram, do mais próximo ao mais distante (no máximo um de cada tipo). */
export function proximosEventos(posts, agora = new Date()) {
  const vistos = new Set();
  return posts.map(eventoDoPost)
    .filter((e) => e && e.fim > agora)
    .sort((a, b) => a.inicio - b.inicio)
    .filter((e) => (vistos.has(e.tipo) ? false : vistos.add(e.tipo)));
}

const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function linkGoogleAgenda(e, urlAbsoluta) {
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: e.titulo, dates: `${utc(e.inicio)}/${utc(e.fim)}`,
    details: `${e.onde}\n\n${urlAbsoluta}`, ctz: 'America/Bahia',
  });
  if (e.tipo === 'assembleia') p.set('location', 'UFSB');
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

const escaparIcs = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
// Linhas de mais de 75 octetos são dobradas (RFC 5545).
const dobrar = (linha) => {
  const partes = [];
  let atual = '';
  for (const ch of linha) {
    if (Buffer.byteLength(atual + ch) > (partes.length ? 74 : 75)) { partes.push(atual); atual = ''; }
    atual += ch;
  }
  return [...partes, atual].join('\r\n ');
};

export function ics(e, urlAbsoluta, uid) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SindiUFSB//site//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@sindiufsb.org.br`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(e.inicio)}`,
    `DTEND:${utc(e.fim)}`,
    `SUMMARY:${escaparIcs(e.titulo)}`,
    `DESCRIPTION:${escaparIcs(e.onde + '\n\n' + urlAbsoluta)}`,
    ...(e.tipo === 'assembleia' ? ['LOCATION:UFSB'] : []),
    `URL:${urlAbsoluta}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(dobrar).join('\r\n');
}
