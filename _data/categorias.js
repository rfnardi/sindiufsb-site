// Etiquetas do Blogger → categorias do site. A ordem aqui é a da lateral.
// "CAPA" era o marcador do slider antigo e não vira categoria; post sem
// etiqueta cai em "Geral".
const MAPA = [
  { etiqueta: 'CONVOCAÇÃO DE ASSEMBLEIA', rotulo: 'Convocações', slug: 'convocacoes' },
  { etiqueta: 'NOTÍCIAS', rotulo: 'Notícias', slug: 'noticias' },
  { etiqueta: 'BOLETIM SINDIUFSB', rotulo: 'Boletim SindiUFSB', slug: 'boletim' },
  { etiqueta: 'GREVE 2024', rotulo: 'Greve 2024', slug: 'greve-2024' },
  { etiqueta: 'BOLETIM DE GREVE', rotulo: 'Boletins de greve', slug: 'boletins-de-greve' },
  { etiqueta: 'ELEIÇÕES', rotulo: 'Eleições', slug: 'eleicoes' },
  { etiqueta: 'PAUTAS LOCAIS', rotulo: 'Pautas locais', slug: 'pautas-locais' },
  { etiqueta: 'Mesa local de negociação permanente', rotulo: 'Mesa de negociação', slug: 'mesa-de-negociacao' },
  { etiqueta: 'EaD', rotulo: 'EaD', slug: 'ead' },
  { etiqueta: 'FILIE-SE', rotulo: 'Filiação', slug: 'filiacao' },
];
const GERAL = { etiqueta: null, rotulo: 'Geral', slug: 'geral' };

function doPost(tags) {
  const lista = (Array.isArray(tags) ? tags : tags ? [tags] : [])
    .map((t) => MAPA.find((c) => c.etiqueta === t))
    .filter(Boolean);
  return lista.length ? lista : [GERAL];
}

export default { lista: [...MAPA, GERAL], doPost };
