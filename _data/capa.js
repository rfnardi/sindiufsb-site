// Fotos do carrossel da capa. A lista mora em dados/capa.json porque o CMS
// grava esse arquivo (aba Capa); fica fora de _data pelo mesmo motivo de
// dados/categorias.json.
import fs from 'node:fs';

export default JSON.parse(fs.readFileSync(new URL('../dados/capa.json', import.meta.url), 'utf8'));
