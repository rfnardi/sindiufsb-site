export default {
  nome: 'SindiUFSB',
  descricao: 'Sindicato Docente da Universidade Federal do Sul da Bahia — Seção Sindical do ANDES-SN',
  email: 'sindiufsb2020@gmail.com',
  emailInstitucional: 'sindiufsb@ufsb.edu.br',
  instagram: 'https://www.instagram.com/sindiufsb/',
  facebook: 'https://www.facebook.com/SindiUfsb-Sindicato-de-Docentes-da-UFSB-106000377937028/',
  andes: 'https://www.andes.org.br/',
  // Endereço absoluto (links de agenda). O Action passa o do GitHub Pages.
  url: (process.env.SITE_URL || 'https://www.sindiufsb.org.br').replace(/\/$/, ''),
  // Web app da tesouraria, de outra conta. Só o link mora aqui.
  minhaSindiufsb: 'https://script.google.com/macros/s/AKfycbxUkNmlAKeRCEaYdUj_Ganmg2-Z8e0P_nhq6RblixxCiz6cOe2lhsCezP16apIEv7L7/exec',
  menuSindicato: [
    { texto: 'Composição atual', url: '/p/composicao.html' },
    { texto: 'Histórico de diretorias', url: '/p/historico-de-diretorias.html' },
    { texto: 'Plano de gestão', url: '/p/plano.html' },
    { texto: 'Estatuto', url: '/p/estatuto.html' },
    { texto: 'Contribuição mensal', url: '/p/contribuicao-mensal-sindufsb.html' },
  ],
};
