// Porta "Minha progressão" da Minha SindiUFSB: as regras que dizem ao docente
// o que ele pode pedir, quando, e quanto vale cada atividade.
//
// Um erro aqui não quebra a página: faz alguém perder prazo, montar relatório
// abaixo do mínimo, ou deixar de pedir dinheiro que é seu. Por isso cada regra
// tem a frase da norma ao lado, no código ou no teste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { baremaCompleto, FONTE_XLSX, DESTINO_JSON } from '../_config/barema.js';

const lerJson = (nome) => JSON.parse(fs.readFileSync(new URL('../assets/progressao/' + nome, import.meta.url), 'utf8'));

// ---------------------------------------------------------------- barema

test('barema: o JSON da página é exatamente a conversão da planilha oficial', () => {
  const daPlanilha = baremaCompleto(fs.readFileSync(FONTE_XLSX));
  const guardado = JSON.parse(fs.readFileSync(DESTINO_JSON, 'utf8'));
  assert.deepEqual(guardado, daPlanilha, 'rode: node _config/barema.js');
});

test('barema: nove campos, itens numerados dentro do próprio campo, sem repetição', () => {
  const b = lerJson('barema-ufsb-17-2022.json');
  assert.equal(b.campos.length, 9);
  const ids = new Set();
  for (const c of b.campos) {
    assert.ok(c.itens.length > 0, 'campo ' + c.romano + ' vazio');
    for (const it of c.itens) {
      assert.equal(Number(it.id.split('.')[0]), c.numero, it.id + ' fora do campo');
      assert.ok(!ids.has(it.id), 'id repetido ' + it.id);
      ids.add(it.id);
      assert.ok(['por_unidade', 'por_horas', 'teto_por_periodo', 'fracao_do_minimo'].includes(it.tipo), it.id);
    }
  }
  // contados na planilha: 39 + 45 + 14 + 3 + 7 + 15 + 23 + 6 + 1
  assert.deepEqual(b.campos.map((c) => c.itens.length), [39, 45, 14, 3, 7, 15, 23, 6, 1]);
});

test('barema: leitura dos textos de pontuação que mais confundem', () => {
  const b = lerJson('barema-ufsb-17-2022.json');
  const item = (id) => b.campos.flatMap((c) => c.itens).find((i) => i.id === id);
  assert.deepEqual([item('1.1').tipo, item('1.1').pontos, item('1.1').horas], ['por_horas', 1.25, 15]);
  assert.deepEqual([item('3.8').pontos, item('3.8').horas], [1, 8]);          // 01/08 horas
  assert.deepEqual([item('8.6').pontos, item('8.6').horas], [2, 40]);         // 02 a cada 40 horas
  assert.deepEqual([item('9.1').tipo, item('9.1').teto], ['teto_por_periodo', 5]);
  assert.deepEqual([item('6.11').pontos, item('6.11').unidade], [2, 'mês']);  // 02mês/Comissão
  assert.equal(item('2.11').pontos, 25);
  assert.equal(item('6.1').tipo, 'fracao_do_minimo');
  assert.deepEqual(item('6.2').variantes.map((v) => v.pontos), [2.1, 3]);
});

// ---------------------------------------------------------------- regras
// O arquivo é carregado como o navegador carrega, num contexto isolado.

function regras() {
  const ctx = { Math, Date, JSON, Number, String, Array, Object, isNaN };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../assets/js/progressao-regras.js', import.meta.url), 'utf8'), ctx);
  return ctx.criarRegrasDeProgressao(lerJson('carreira-ufsb.json'), lerJson('barema-ufsb-17-2022.json'));
}
const R = regras();
const simples = (v) => JSON.parse(JSON.stringify(v));

test('datas: meses somados sem passar do fim do mês, e 60 dias antes', () => {
  assert.equal(R.somarMeses('2023-03-15', 24), '2025-03-15');
  assert.equal(R.somarMeses('2024-02-29', 24), '2026-02-28');   // não existe 29/02/2026
  assert.equal(R.somarMeses('2023-01-31', 1), '2023-02-28');
  assert.equal(R.somarDias('2025-03-15', -60), '2025-01-14');
});

test('linha do tempo: em curso, pode pedir já (60 dias antes) e vencido', () => {
  const base = { nivel: 'B2', regime: 'DE', titulacao: 'Doutorado' };
  let l = R.linhaDoTempo({ ...base, desde: '2025-06-01', hoje: '2026-10-05' });
  assert.equal(l.length, 1);
  assert.deepEqual(simples(l[0]), { ...simples(l[0]), de: 'B2', para: 'B3', tipo: 'progressao',
    inicio: '2025-06-01', fim: '2027-06-01', abertura: '2027-04-02', estado: 'em_curso', minimo: 100 });

  l = R.linhaDoTempo({ ...base, desde: '2024-11-20', hoje: '2026-10-05' });   // fim 20/11/2026
  assert.equal(l[0].estado, 'pode_pedir');
  assert.equal(l[0].abertura, '2026-09-21');

  l = R.linhaDoTempo({ ...base, desde: '2024-10-05', hoje: '2026-10-05' });   // fim hoje
  assert.equal(l[0].estado, 'vencido');
});

test('linha do tempo: interstícios acumulados encadeiam, cada um começa no fim do anterior', () => {
  const l = R.linhaDoTempo({ nivel: 'B1', desde: '2019-03-01', regime: '40h', titulacao: 'Doutorado', hoje: '2026-10-05' });
  assert.deepEqual(simples(l).map((i) => i.de + '>' + i.para), ['B1>B2', 'B2>B3', 'B3>B4', 'B4>C1']);
  assert.deepEqual(simples(l).map((i) => i.fim), ['2021-03-01', '2023-03-01', '2025-03-01', '2027-03-01']);
  assert.deepEqual(simples(l).map((i) => i.estado), ['vencido', 'vencido', 'vencido', 'em_curso']);
  // promoção para Associado: mínimo de promoção e exige doutorado
  assert.equal(l[3].tipo, 'promocao');
  assert.equal(l[3].minimo, 100);
  assert.equal(l[0].minimo, 80);
  assert.equal(l[3].exigeDoutorado, true);
});

test('prescrição: efeito financeiro só dos últimos 5 anos; o direito à progressão continua', () => {
  const l = R.linhaDoTempo({ nivel: 'B1', desde: '2017-01-10', regime: 'DE', titulacao: 'Doutorado', hoje: '2026-10-05' });
  // Fins: 2019-01-10, 2021-01-10, 2023-01-10, 2025-01-10. A diferença de
  // salário de uma progressão continua todo mês; o que prescreve são os
  // atrasados de mais de 5 anos antes do pedido. Ninguém perde a progressão.
  assert.equal(l[0].prescricao, 'parcial');
  assert.equal(l[1].prescricao, 'parcial');
  assert.equal(l[2].prescricao, 'nenhuma');
  assert.equal(l[0].efeitosDesde, '2021-10-05');   // hoje − 5 anos
  assert.equal(l[2].efeitosDesde, '2023-01-10');
});

test('linha do tempo: sem doutorado, para antes de Associado e diz por quê', () => {
  const l = R.linhaDoTempo({ nivel: 'B3', desde: '2020-01-01', regime: 'DE', titulacao: 'Mestrado', hoje: '2026-10-05' });
  assert.deepEqual(simples(l).map((i) => i.de + '>' + i.para), ['B3>B4', 'B4>C1']);
  assert.equal(l[1].faltaDoutorado, true);
  assert.equal(l[1].estado, 'bloqueado');
});

test('linha do tempo: casos especiais — Classe A (36 meses, estágio probatório) e Titular', () => {
  let l = R.linhaDoTempo({ nivel: 'A', desde: '2025-02-01', regime: 'DE', titulacao: 'Doutorado', hoje: '2026-10-05' });
  assert.equal(l[0].fim, '2028-02-01');
  assert.equal(l[0].especial, 'estagio_probatorio');
  assert.equal(l[0].minimo, null, 'A→B não usa barema na UFSB: só a portaria do estágio probatório');

  l = R.linhaDoTempo({ nivel: 'C3', desde: '2020-01-01', regime: 'DE', titulacao: 'Doutorado', hoje: '2026-10-05' });
  assert.deepEqual(simples(l).map((i) => i.de + '>' + i.para), ['C3>C4', 'C4>D']);
  assert.equal(l[1].especial, 'titular');
  assert.equal(l[1].minimo, null);

  assert.deepEqual(simples(R.linhaDoTempo({ nivel: 'D', desde: '2020-01-01', regime: 'DE', titulacao: 'Doutorado', hoje: '2026-10-05' })), []);
});

test('linha do tempo: dado inválido não inventa resposta', () => {
  assert.deepEqual(simples(R.linhaDoTempo({ nivel: 'X9', desde: '2020-01-01', regime: 'DE', hoje: '2026-10-05' })), []);
  assert.deepEqual(simples(R.linhaDoTempo({ nivel: 'B1', desde: '', regime: 'DE', hoje: '2026-10-05' })), []);
  assert.deepEqual(simples(R.linhaDoTempo({ nivel: 'B1', desde: '2027-01-01', regime: 'DE', hoje: '2026-10-05' })), []);
});

test('pontos por item: unidade, horas quebradas, teto por período, variante e fração do mínimo', () => {
  const it = (id) => R.item(id);
  assert.equal(R.pontosDoItem(it('2.11'), { quantidade: 2 }, 100), 50);
  assert.equal(R.pontosDoItem(it('1.1'), { quantidade: 60 }, 100), 5);         // 60h = 4 × 15h
  assert.equal(R.pontosDoItem(it('1.1'), { quantidade: 70 }, 100), 5.83);      // proporcional, 2 casas
  assert.equal(R.pontosDoItem(it('9.1'), { quantidade: 4, valor: 30 }, 100), 20);   // teto 5 × 4 períodos
  assert.equal(R.pontosDoItem(it('9.1'), { quantidade: 4, valor: 12 }, 100), 12);
  assert.equal(R.pontosDoItem(it('6.2'), { quantidade: 10, variante: 1 }, 100), 30);
  assert.equal(R.pontosDoItem(it('6.2'), { quantidade: 10, variante: 0 }, 100), 21);
  assert.equal(R.pontosDoItem(it('6.1'), { quantidade: 12 }, 100), 50);        // 12/24 do mínimo
  assert.equal(R.pontosDoItem(it('2.11'), { quantidade: -3 }, 100), 0);
  assert.equal(R.pontosDoItem(it('2.11'), { quantidade: 'x' }, 100), 0);
});

test('placar: soma por campo, crédito de licença (arts. 16 e 17) e quanto falta', () => {
  const p = R.placar([
    { id: '2.11', quantidade: 2 },        // 50, campo II
    { id: '1.1', quantidade: 120 },       // 10, campo I
    { id: '6.6', quantidade: 6 }          // 6, campo VI
  ], { tipo: 'progressao', regime: 'DE', mesesDeLicenca: 3 });
  assert.equal(p.minimo, 100);
  assert.equal(p.porCampo[1], 50);
  assert.equal(p.porCampo[0], 10);
  assert.equal(p.licenca, 12.5);           // 3/24 de 100
  assert.equal(p.total, 78.5);
  assert.equal(p.falta, 21.5);
  assert.equal(p.atinge, false);
});

test('retificação: aprovada depois do fim do interstício e há menos de 5 anos', () => {
  const hoje = '2026-10-05';
  assert.equal(R.cabeRetificacao({ fim: '2023-03-01', aprovacao: '2023-09-15', hoje }).cabe, true);
  assert.equal(R.cabeRetificacao({ fim: '2023-03-01', aprovacao: '2023-02-20', hoje }).cabe, false);   // aprovada antes
  assert.equal(R.cabeRetificacao({ fim: '2020-03-01', aprovacao: '2021-06-01', hoje }).cabe, false);   // mais de 5 anos
  assert.equal(R.cabeRetificacao({ fim: '', aprovacao: '2023-09-15', hoje }).cabe, false);
});

test('SIPAC: tipo de processo e assunto detalhado no formato dos exemplos da PROGEPE', () => {
  assert.equal(R.assuntoDetalhado('B1', 'B2'), 'Progressão de Adjunto I para Adjunto II');
  assert.equal(R.assuntoDetalhado('B4', 'C1'), 'Promoção de Adjunto IV para Associado I');
  assert.equal(R.assuntoDetalhado('A', 'B1'), 'Promoção de Classe A para Adjunto I');
  assert.equal(R.tipoSipac('B1'), 'PROGRESSÃO HORIZONTAL');
  assert.equal(R.tipoSipac('B4'), 'PROGRESSÃO VERTICAL');
});

test('folhas: comprovantes em ordem de item (2.9 antes de 2.11) e numeração contínua', () => {
  const f = R.folhear([
    { id: '2.11', paginas: 3 }, { id: '1.10', paginas: 1 }, { id: '2.9', paginas: 2 }, { id: '1.2', paginas: 1 }
  ], 4);
  assert.deepEqual(simples(f).map((x) => x.id + ':' + x.de + '-' + x.ate), ['1.2:4-4', '1.10:5-5', '2.9:6-7', '2.11:8-10']);
});

// ---------------------------------------------------------------- PDF
// O PDF é montado no navegador com pdf-lib. Aqui roda a mesma biblioteca,
// do node_modules, sobre o mesmo arquivo da página.
import * as PDFLib from 'pdf-lib';
import zlib from 'node:zlib';

// No mesmo contexto do teste (runInThisContext), e não num vm isolado: a
// pdf-lib confere os argumentos com instanceof, e objetos de outro contexto
// não passam. O arquivo só define window.montarPdfDeProgressao.
function montador() {
  globalThis.window = globalThis;
  vm.runInThisContext(fs.readFileSync(new URL('../assets/js/progressao-pdf.js', import.meta.url), 'utf8'));
  return globalThis.montarPdfDeProgressao;
}

async function pdfDe(paginas) {
  const d = await PDFLib.PDFDocument.create();
  for (let i = 0; i < paginas; i++) d.addPage([400, 600]).drawText('pagina ' + (i + 1), { x: 20, y: 300 });
  return d.save();
}
async function pdfProtegido() {
  const d = await PDFLib.PDFDocument.create();
  d.addPage();
  const s = Buffer.from(await d.save({ useObjectStreams: false })).toString('latin1');
  return new Uint8Array(Buffer.from(s.replace(/trailer\s*<</, 'trailer\n<<\n/Encrypt 1 0 R'), 'latin1'));
}
// PNG 1×1 válido
const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));

/** Todo o texto desenhado na página (os conteúdos vêm comprimidos e em hex). */
async function textoDasPaginas(bytes) {
  const d = await PDFLib.PDFDocument.load(bytes);
  return d.getPages().map((p) => {
    const c = p.node.Contents();
    const streams = c instanceof PDFLib.PDFArray ? c.asArray().map((r) => d.context.lookup(r)) : [c];
    let t = '';
    for (const s of streams) {
      let raw = Buffer.from(s.contents);
      try { raw = zlib.inflateSync(raw); } catch { /* sem compressão */ }
      const str = raw.toString('latin1');
      for (const m of str.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) t += Buffer.from(m[1], 'hex').toString('latin1') + '\n';
      for (const m of str.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) t += m[1] + '\n';
    }
    return t;
  });
}

const DADOS = {
  nome: 'Docente de Teste', siape: '1234567', de: 'B1', para: 'B2', tipo: 'progressao',
  inicio: '2023-03-01', fim: '2025-03-01', regime: 'DE', mesesDeLicenca: 0,
  lancamentos: [
    { chave: 'a', id: '2.11', quantidade: 2, detalhe: 'Artigo na Revista X' },
    { chave: 'b', id: '1.1', quantidade: 120, detalhe: 'Componentes do quadrimestre' },
    { chave: 'c', id: '2.9', quantidade: 1, detalhe: '' }
  ]
};

test('PDF: capa, tabela, índice e comprovantes, com as folhas numeradas em sequência', async () => {
  const montar = montador();
  const anexos = [
    { lancamento: 'a', nome: 'artigo.pdf', tipo: 'application/pdf', bytes: await pdfDe(3) },
    { lancamento: 'b', nome: 'aulas.png', tipo: 'image/png', bytes: PNG },
    { lancamento: 'c', nome: 'curso.pdf', tipo: 'application/pdf', bytes: await pdfDe(2) }
  ];
  const r = await montar(PDFLib, R, DADOS, anexos);
  assert.equal(r.erros.length, 0);
  const pre = r.paginasIniciais;
  assert.ok(pre >= 3, 'capa + tabela + índice');
  const doc = await PDFLib.PDFDocument.load(r.bytes);
  assert.equal(doc.getPageCount(), pre + 3 + 1 + 2);

  // ordem pelo número do item: 1.1 (png), 2.9 (2 págs), 2.11 (3 págs)
  assert.deepEqual(simples(r.folhas).map((f) => f.item + ':' + f.de + '-' + f.ate),
    ['1.1:' + (pre + 1) + '-' + (pre + 1), '2.9:' + (pre + 2) + '-' + (pre + 3), '2.11:' + (pre + 4) + '-' + (pre + 6)]);

  const textos = await textoDasPaginas(r.bytes);
  textos.forEach((t, i) => assert.match(t, new RegExp('Fl\\. ' + (i + 1) + '\\b'), 'página ' + (i + 1) + ' sem a folha'));
  assert.match(textos[pre + 1], /Item 2\.9/);
  assert.match(textos[pre + 3], /Item 2\.11/);
  assert.match(textos[0], /Docente de Teste/);
  assert.match(textos.slice(1, pre).join(''), /Fls?\. .*?\b/);
  // o índice aponta a folha certa do artigo
  assert.match(textos.slice(1, pre).join('\n'), new RegExp('2\\.11[\\s\\S]*' + (pre + 4) + '\\s*a\\s*' + (pre + 6)));
});

test('PDF: arquivo protegido ou corrompido vira aviso com o nome, e o resto sai', async () => {
  const montar = montador();
  const anexos = [
    { lancamento: 'a', nome: 'protegido.pdf', tipo: 'application/pdf', bytes: await pdfProtegido() },
    { lancamento: 'b', nome: 'lixo.pdf', tipo: 'application/pdf', bytes: new Uint8Array([1, 2, 3, 4]) },
    { lancamento: 'c', nome: 'bom.pdf', tipo: 'application/pdf', bytes: await pdfDe(1) }
  ];
  const r = await montar(PDFLib, R, DADOS, anexos);
  assert.deepEqual(simples(r.erros).map((e) => e.nome).sort(), ['lixo.pdf', 'protegido.pdf']);
  assert.match(simples(r.erros).find((e) => e.nome === 'protegido.pdf').motivo, /senha|protegido/i);
  const doc = await PDFLib.PDFDocument.load(r.bytes);
  assert.equal(doc.getPageCount(), r.paginasIniciais + 1);
});

test('PDF: texto com caracteres fora da fonte padrão não derruba a montagem', async () => {
  const montar = montador();
  const d = { ...DADOS, nome: 'Zoë Ñúñez → Ştefan', lancamentos: [{ chave: 'a', id: '2.11', quantidade: 1, detalhe: 'Título “com” aspas — e ≥ símbolos 🎓' }] };
  const r = await montar(PDFLib, R, d, [{ lancamento: 'a', nome: 'a.pdf', tipo: 'application/pdf', bytes: await pdfDe(1) }]);
  assert.equal(r.erros.length, 0);
  const textos = await textoDasPaginas(r.bytes);
  assert.match(textos[0], /Zoë Ñúñez/);
});

test('pdf-lib servida pelo site é a mesma do package.json (sem CDN)', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const versao = pkg.devDependencies['pdf-lib'];
  const servida = fs.readFileSync(new URL('../assets/js/vendor/pdf-lib-' + versao + '.min.js', import.meta.url));
  const instalada = fs.readFileSync(new URL('../node_modules/pdf-lib/dist/pdf-lib.min.js', import.meta.url));
  assert.ok(servida.equals(instalada), 'copie node_modules/pdf-lib/dist/pdf-lib.min.js para assets/js/vendor/');
});

// ---------------------------------------------------------------- tela
const TEMPLATE = fs.readFileSync(new URL('../paginas/minha-sindiufsb.njk', import.meta.url), 'utf8');
const TELA = fs.readFileSync(new URL('../assets/js/progressao.js', import.meta.url), 'utf8');

test('tela: todo id que progressao.js usa existe na página', () => {
  const usados = new Set([...TELA.matchAll(/el\('([A-Za-z0-9]+)'\)/g)].map((m) => m[1]));
  for (const m of TELA.matchAll(/\[((?:\s*'[A-Za-z0-9]+',?\s*)+)\]\s*\.forEach/g)) {
    for (const id of m[1].matchAll(/'([A-Za-z0-9]+)'/g)) usados.add(id[1]);
  }
  assert.ok(usados.size > 20);
  for (const id of usados) assert.match(TEMPLATE, new RegExp('id="' + id + '"'), 'falta id="' + id + '" na página');
});

test('tela: a porta tem seção, botão no menu (escondido até a revisão) e os scripts na ordem', () => {
  assert.match(TEMPLATE, /<section id="porta-progressao" hidden>/);
  assert.match(TEMPLATE, /data-porta="progressao" id="btPortaProgressao" hidden/);
  const ordem = ['minha-servidor.js', 'minha.js', 'progressao-regras.js', 'progressao-pdf.js', 'progressao.js']
    .map((f) => TEMPLATE.indexOf("/assets/js/" + f + "'"));
  assert.ok(ordem.every((p) => p > 0), 'script ausente');
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, 'scripts fora de ordem');
  assert.match(TEMPLATE, /data-pdflib="\{\{ '\/assets\/js\/vendor\/pdf-lib-1\.17\.1\.min\.js' \| versao \}\}"/);
});

test('tela: Sair limpa a porta, e o nome vem do meusDados que a área já faz', () => {
  const minha = fs.readFileSync(new URL('../assets/js/minha.js', import.meta.url), 'utf8');
  assert.match(minha, /'porta-progressao'\]\.forEach/);
  assert.match(minha, /window\.limparProgressao\(\)/);
  assert.match(minha, /window\.progressaoComDados\(r\)/);
  assert.match(TELA, /window\.limparProgressao = apagarTudo/);
});

test('privacidade: nenhuma chamada ao servidor leva comprovante', () => {
  // Toda chamada passa por servidor()…  .nomeDaFuncao({...}). A porta só pode
  // chamar as funções do alerta, e nenhuma delas recebe bytes ou arquivos.
  const chamadas = [...TELA.matchAll(/\}\)\.(\w+)\(\{([^}]*)\}\)/g)];
  const permitidas = ['minhaProgressao', 'salvarMinhaProgressao', 'sairDoAlertaDeProgressao'];
  assert.deepEqual(chamadas.map((c) => c[1]).sort(), [...permitidas].sort(), 'a varredura não achou as chamadas');
  for (const c of chamadas) {
    assert.ok(permitidas.includes(c[1]), 'chamada inesperada ao servidor: ' + c[1]);
    assert.doesNotMatch(c[2], /bytes|arquivo|anexo|File/i);
  }
  assert.doesNotMatch(TELA, /fetch\([^)]*method/i, 'fetch de envio na porta');
  // o rascunho guarda a lista de atividades, nunca os arquivos nem o SIAPE
  const rascunho = TELA.slice(TELA.indexOf('function guardarRascunho'), TELA.indexOf('function recuperarRascunho'));
  assert.doesNotMatch(rascunho, /arquivos\[|bytes|pgSiape/);
});
