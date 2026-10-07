// Porta "Minha progressão": .zip sem dependência, no navegador.
//
// Dois usos: ler o .zip que o Lattes exporta (deflate) e montar/ler o
// arquivo do pedido ("Baixar o pedido para continuar depois"), que leva o
// pedido.json e os anexos. O pedido é montado SEM compressão (método store):
// PDF e JPG já vêm comprimidos, e assim montar não depende de nada além de
// um CRC32.
window.ProgressaoZip = (function () {
  function u16(b, p) { return b[p] | (b[p + 1] << 8); }
  function u32(b, p) { return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) + b[p + 3] * 16777216; }

  var TABELA = null;
  function crc32(b) {
    if (!TABELA) {
      TABELA = [];
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        TABELA[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) crc = TABELA[(crc ^ b[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function inflar(dado) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('Este navegador não abre .zip comprimido. Atualize o navegador.'));
    }
    var fluxo = new Blob([dado]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(fluxo).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  /** bytes de um .zip -> Promise<[{ nome, bytes }]>, na ordem do arquivo. */
  function lerZip(b) {
    var fim = b.length - 22;
    while (fim >= 0 && u32(b, fim) !== 0x06054b50) fim--;
    if (fim < 0) return Promise.reject(new Error('Não é um arquivo .zip.'));
    var total = u16(b, fim + 10), p = u32(b, fim + 16), itens = [];
    for (var i = 0; i < total; i++) {
      if (u32(b, p) !== 0x02014b50) break;
      var flag = u16(b, p + 8), metodo = u16(b, p + 10), tam = u32(b, p + 20);
      var nLen = u16(b, p + 28), xLen = u16(b, p + 30), cLen = u16(b, p + 32), local = u32(b, p + 42);
      var nb = b.subarray(p + 46, p + 46 + nLen);
      var nome = new TextDecoder(flag & 0x0800 ? 'utf-8' : 'iso-8859-1').decode(nb);
      var ini = local + 30 + u16(b, local + 26) + u16(b, local + 28);
      itens.push({ nome: nome, metodo: metodo, dado: b.subarray(ini, ini + tam) });
      p += 46 + nLen + xLen + cLen;
    }
    return Promise.all(itens.map(function (it) {
      if (it.metodo === 0) return Promise.resolve({ nome: it.nome, bytes: new Uint8Array(it.dado) });
      if (it.metodo !== 8) return Promise.reject(new Error('Formato de .zip não suportado.'));
      return inflar(it.dado).then(function (bytes) { return { nome: it.nome, bytes: bytes }; });
    }));
  }

  /** [{ nome, bytes }] -> bytes de um .zip (store, nomes em UTF-8). */
  function montarZip(arquivos) {
    var partes = [], centrais = [], pos = 0;
    var agora = new Date();
    var hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
    var dia = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
    arquivos.forEach(function (a) {
      var nome = new TextEncoder().encode(a.nome), dado = a.bytes, crc = crc32(dado);
      var l = new Uint8Array(30), v = new DataView(l.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true);
      v.setUint16(8, 0, true); v.setUint16(10, hora, true); v.setUint16(12, dia, true);
      v.setUint32(14, crc, true); v.setUint32(18, dado.length, true); v.setUint32(22, dado.length, true);
      v.setUint16(26, nome.length, true);
      var c = new Uint8Array(46), w = new DataView(c.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true);
      w.setUint16(8, 0x0800, true); w.setUint16(10, 0, true); w.setUint16(12, hora, true);
      w.setUint16(14, dia, true); w.setUint32(16, crc, true); w.setUint32(20, dado.length, true);
      w.setUint32(24, dado.length, true); w.setUint16(28, nome.length, true); w.setUint32(42, pos, true);
      partes.push(l, nome, dado);
      centrais.push(c, nome);
      pos += 30 + nome.length + dado.length;
    });
    var tamCentral = centrais.reduce(function (s, x) { return s + x.length; }, 0);
    var f = new Uint8Array(22), e = new DataView(f.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, arquivos.length, true);
    e.setUint16(10, arquivos.length, true); e.setUint32(12, tamCentral, true); e.setUint32(16, pos, true);
    var todas = partes.concat(centrais, [f]);
    var out = new Uint8Array(todas.reduce(function (s, x) { return s + x.length; }, 0)), k = 0;
    todas.forEach(function (x) { out.set(x, k); k += x.length; });
    return out;
  }

  return { lerZip: lerZip, montarZip: montarZip, crc32: crc32 };
})();
