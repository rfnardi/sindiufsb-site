// O barema da progressão docente (Anexo I da Resolução UFSB 17/2022), lido
// da planilha oficial que a PROGEPE publica como "modelo" da tabela de
// pontuação. O JSON que a página usa (assets/progressao/barema-ufsb-17-2022.json)
// sai daqui, e não de digitação: um item transcrito errado vira pontuação
// errada no relatório de alguém, e a CPADD reprova.
//
// Rodar de novo quando a PROGEPE trocar a planilha:
//   node _config/barema.js
// O teste (testes/progressao.test.mjs) refaz a conversão e compara com o JSON
// guardado — o JSON não pode divergir da planilha sem alguém perceber.
//
// Sem dependência: o .xlsx é um zip, e só precisamos de dois arquivos dele.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const FONTE_XLSX = new URL('../assets/progressao/fonte/tabela-atividades-ufsb-17-2022.xlsx', import.meta.url);
export const DESTINO_JSON = new URL('../assets/progressao/barema-ufsb-17-2022.json', import.meta.url);

function lerZip(buf) {
  // fim do diretório central: assinatura 0x06054b50, nos últimos bytes
  let fim = buf.length - 22;
  while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error('não é um .xlsx (zip) válido');
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const arquivos = {};
  for (let i = 0; i < total; i++) {
    const metodo = buf.readUInt16LE(p + 10);
    const tamComp = buf.readUInt32LE(p + 20);
    const nLen = buf.readUInt16LE(p + 28), xLen = buf.readUInt16LE(p + 30), cLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + nLen);
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dado = buf.subarray(ini, ini + tamComp);
    arquivos[nome] = () => (metodo === 0 ? dado : zlib.inflateRawSync(dado)).toString('utf8');
    p += 46 + nLen + xLen + cLen;
  }
  return arquivos;
}

const desxml = (s) => s.replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Linhas da planilha como { A: '...', B: '...' }, na ordem. */
function linhasDaPlanilha(buf) {
  const z = lerZip(buf);
  const comp = [...z['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => desxml(m[1]));
  const folha = z['xl/worksheets/sheet1.xml']();
  return [...folha.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const linha = {};
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = /r="([A-Z]+)\d+"/.exec(c[1])[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] || '');
      if (!v) continue;
      linha[col] = /t="s"/.test(c[1]) ? comp[Number(v[1])] : v[1];
    }
    return linha;
  });
}

const num = (s) => Number(String(s).replace(',', '.'));

/**
 * Como o item pontua, a partir do texto da coluna "PONTOS/ATIVIDADE".
 * O que a planilha não diz em número (6.1 a 6.5, que estão no texto do
 * próprio item) é dito aqui, item por item, com a frase da Resolução ao lado.
 */
const POR_TEXTO = {
  // "02 anos como o total de pontos necessários à progressão ou 1/24 deste
  // total por mês no exercício do cargo"
  '6.1': { tipo: 'fracao_do_minimo', fracao: 1 / 24, unidade: 'mês' },
  '6.4': { tipo: 'fracao_do_minimo', fracao: 1 / 24, unidade: 'mês' },
  // "2,1 pontos por mês ... aqueles que não forem remunerados, 03 pontos por mês"
  '6.2': { tipo: 'por_unidade', unidade: 'mês',
           variantes: [{ rotulo: 'cargo remunerado', pontos: 2.1 },
                       { rotulo: 'cargo não remunerado', pontos: 3 }] },
  // "1 ponto por mês no exercício do cargo"
  '6.3': { tipo: 'por_unidade', pontos: 1, unidade: 'mês' },
  // "02 pontos por mês, desde que não haja remuneração"
  '6.5': { tipo: 'por_unidade', pontos: 2, unidade: 'mês' },
};

export function regraDoTexto(id, texto) {
  if (POR_TEXTO[id]) return { ...POR_TEXTO[id] };
  const t = String(texto || '').trim();
  let m;
  if ((m = /^at[ée]\s*(\d+(?:,\d+)?)\s*\/\s*per[ií]odo/i.exec(t))) {
    return { tipo: 'teto_por_periodo', teto: num(m[1]), unidade: 'período' };
  }
  if ((m = /^(\d+(?:,\d+)?)\s*\/\s*(\d+)\s*h/i.exec(t))) {          // 1,25/15h · 01/8h
    return { tipo: 'por_horas', pontos: num(m[1]), horas: Number(m[2]), unidade: 'hora' };
  }
  if ((m = /^(\d+(?:,\d+)?)\s*\/\s*(\d+)\s*horas/i.exec(t))) {      // 01/08 horas de atividade
    return { tipo: 'por_horas', pontos: num(m[1]), horas: Number(m[2]), unidade: 'hora' };
  }
  if ((m = /^(\d+(?:,\d+)?)\s*a cada\s*(\d+)\s*horas/i.exec(t))) {   // 02 a cada 40 horas
    return { tipo: 'por_horas', pontos: num(m[1]), horas: Number(m[2]), unidade: 'hora' };
  }
  if ((m = /^(\d+(?:,\d+)?)\s*m[eê]s\s*\/\s*(.+)$/i.exec(t))) {      // 02mês/Comissão
    return { tipo: 'por_unidade', pontos: num(m[1]), unidade: 'mês' };
  }
  if ((m = /^(\d+(?:,\d+)?)\s*\/\s*(.+)$/.exec(t))) {
    const u = m[2].trim().toLowerCase();
    return { tipo: 'por_unidade', pontos: num(m[1]),
             unidade: /^per[ií]odo/.test(u) ? 'período' : /^m[eê]s/.test(u) ? 'mês' : u };
  }
  return null;
}

export function baremaDoXlsx(buf) {
  const campos = [];
  let campo = null;
  for (const l of linhasDaPlanilha(buf)) {
    const a = String(l.A || '').trim();
    const cab = /^CAMPO\s+([IVX]+)\s*[-–]?\s*(.*)$/s.exec(a);
    if (cab) {
      const [titulo, ...resto] = cab[2].split(/\n+OBS\.:\s*/);
      campo = { numero: campos.length + 1, romano: cab[1],
                titulo: titulo.replace(/\s*-\s*PONTOS\/ATIVIDADE\s*$/i, '').replace(/\s+/g, ' ').trim(),
                obs: resto.join(' ').replace(/\s+/g, ' ').trim(), itens: [] };
      campos.push(campo);
      continue;
    }
    const it = /^(\d+)\.(\d+)\.?\s+([\s\S]+)$/.exec(a);
    if (!it || !campo) continue;
    const id = it[1] + '.' + it[2];
    const regra = regraDoTexto(id, l.B);
    if (!regra) throw new Error('item ' + id + ': não sei pontuar "' + l.B + '"');
    campo.itens.push({ id, descricao: it[3].replace(/\s+/g, ' ').trim(),
                       textoPontos: String(l.B || '').trim(), ...regra });
  }
  return campos;
}

export function baremaCompleto(buf) {
  return {
    fonte: {
      norma: 'Resolução UFSB nº 17/2022, Anexo I — Tabela de Atividades da Carreira de Magistério Superior',
      planilha: 'https://ufsb.edu.br/progepe/images/CD_PROGEPE/Nova_Progressão_e_Promoção/TABELA_DE_ATIVIDADES_DA_CARREIRA_DE_MAGISTÉRIO_SUPERIOR.xlsx',
      resolucao: 'https://ufsb.edu.br/progepe/images/Resolucao17_2022_ProgressaoDocente.pdf',
      periodo: '"Período" refere-se ao regime letivo vigente na Instituição (quadrimestre ou semestre).'
    },
    campos: baremaDoXlsx(buf)
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const b = baremaCompleto(fs.readFileSync(FONTE_XLSX));
  fs.writeFileSync(DESTINO_JSON, JSON.stringify(b, null, 1) + '\n');
  const n = b.campos.reduce((s, c) => s + c.itens.length, 0);
  console.log(b.campos.length + ' campos, ' + n + ' itens → ' + fileURLToPath(DESTINO_JSON));
}
