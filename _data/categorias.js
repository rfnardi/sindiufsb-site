// Etiquetas dos posts → categorias do site. A tabela mora em
// dados/categorias.json porque o CMS (repositório privado sindiufsb-cms) lê
// o mesmo arquivo pela API do GitHub para montar o seletor; fica fora de
// _data para não virar um segundo dado global de mesmo nome. A ordem do JSON
// é a da lateral. "CAPA" era o marcador do slider antigo e não vira
// categoria; post sem etiqueta conhecida cai em "Geral".
import fs from 'node:fs';

const MAPA = JSON.parse(fs.readFileSync(new URL('../dados/categorias.json', import.meta.url), 'utf8'));
const GERAL = { etiqueta: null, rotulo: 'Geral', slug: 'geral' };

function doPost(tags) {
  const lista = (Array.isArray(tags) ? tags : tags ? [tags] : [])
    .map((t) => MAPA.find((c) => c.etiqueta === t))
    .filter(Boolean);
  return lista.length ? lista : [GERAL];
}

export default { lista: [...MAPA, GERAL], doPost };
