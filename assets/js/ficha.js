// Ficha de filiação: níveis/titulações por classe, cálculo da contribuição e
// envio para o back-end em Apps Script (legado/boas-vindas no repositório do
// CMS). Veio do tema do Blogger; mudanças: as cores inline do botão saíram
// para o CSS (.botao:disabled) e o centro de formação virou lista por campus
// (bloco no fim do arquivo).
//
// Os name= dos campos em paginas/ficha-de-filiacao.njk são o contrato com o
// back-end: não renomeie sem mudar o doPost junto.
(function () {
  // Sai sem fazer nada nas paginas que nao tem o formulario.
  if (!document.getElementById('sindiForm')) { return; }

  // ===========================================================================
    // Estrutura oficial: Lei 12.772/2012 + MP 1.286/2024 (Lei 15.141/2025),
    // conforme tabela UNIFESSPA com vigência a partir de 01/04/2026.
    //
    // O NÍVEL depende SOMENTE DA CLASSE (não da titulação):
    //   Classe A (Assistente)  -> Único
    //   Classe B (Adjunto)     -> Níveis 1 a 4
    //   Classe C (Associado)   -> Níveis 1 a 4
    //   Classe D (Titular)     -> Único
    //   Classe E (Titular-Livre, cargo isolado) -> Único, só Doutorado
    // ===========================================================================
    var NIVEIS_POR_CLASSE = {
      'A': ['Único'],
      'B': ['1', '2', '3', '4'],
      'C': ['1', '2', '3', '4'],
      'D': ['Único'],
      'E': ['Único']
    };

    var TITULACOES_POR_CLASSE = {
      'A': ['APERFEIÇOAMENTO', 'ESPECIALIZAÇÃO', 'MESTRADO', 'DOUTORADO'],
      'B': ['APERFEIÇOAMENTO', 'ESPECIALIZAÇÃO', 'MESTRADO', 'DOUTORADO'],
      'C': ['APERFEIÇOAMENTO', 'ESPECIALIZAÇÃO', 'MESTRADO', 'DOUTORADO'],
      'D': ['APERFEIÇOAMENTO', 'ESPECIALIZAÇÃO', 'MESTRADO', 'DOUTORADO'],
      'E': ['DOUTORADO']
    };

    // Remuneração (VB + RT) por Regime/Classe+Nível/Titulação
    // Fonte: Unifesspa-TABELA-CMS_GERAL-2026.pdf (vigência 01/04/2026)
    // Contribuição sindical = 1% da Remuneração (VB + RT)
    var REMUNERACAO = {
      '20H': {
        'A':  { APERFEIÇOAMENTO: 3358.52,  ESPECIALIZAÇÃO: 3518.45,  MESTRADO: 3998.24,  DOUTORADO: 5037.78 },
        'B1': { APERFEIÇOAMENTO: 3560.03,  ESPECIALIZAÇÃO: 3729.56,  MESTRADO: 4238.14,  DOUTORADO: 5340.05 },
        'B2': { APERFEIÇOAMENTO: 3738.03,  ESPECIALIZAÇÃO: 3916.03,  MESTRADO: 4450.04,  DOUTORADO: 5607.05 },
        'B3': { APERFEIÇOAMENTO: 3924.94,  ESPECIALIZAÇÃO: 4111.84,  MESTRADO: 4672.55,  DOUTORADO: 5887.41 },
        'B4': { APERFEIÇOAMENTO: 4121.18,  ESPECIALIZAÇÃO: 4317.43,  MESTRADO: 4906.17,  DOUTORADO: 6181.78 },
        'C1': { APERFEIÇOAMENTO: 5048.45,  ESPECIALIZAÇÃO: 5288.85,  MESTRADO: 6010.06,  DOUTORADO: 7572.68 },
        'C2': { APERFEIÇOAMENTO: 5300.87,  ESPECIALIZAÇÃO: 5553.29,  MESTRADO: 6310.56,  DOUTORADO: 7951.31 },
        'C3': { APERFEIÇOAMENTO: 5565.91,  ESPECIALIZAÇÃO: 5830.96,  MESTRADO: 6626.09,  DOUTORADO: 8348.87 },
        'C4': { APERFEIÇOAMENTO: 5844.21,  ESPECIALIZAÇÃO: 6122.51,  MESTRADO: 6957.40,  DOUTORADO: 8766.32 },
        'D':  { APERFEIÇOAMENTO: 6428.63,  ESPECIALIZAÇÃO: 6734.76,  MESTRADO: 7653.14,  DOUTORADO: 9642.96 },
        'E':  { DOUTORADO: 9642.96 }
      },
      '40H': {
        'A':  { APERFEIÇOAMENTO: 4813.88,  ESPECIALIZAÇÃO: 5149.74,  MESTRADO: 6157.29,   DOUTORADO: 8340.33 },
        'B1': { APERFEIÇOAMENTO: 5102.71,  ESPECIALIZAÇÃO: 5458.72,  MESTRADO: 6526.72,   DOUTORADO: 8840.74 },
        'B2': { APERFEIÇOAMENTO: 5357.85,  ESPECIALIZAÇÃO: 5731.66,  MESTRADO: 6853.07,   DOUTORADO: 9282.79 },
        'B3': { APERFEIÇOAMENTO: 5625.74,  ESPECIALIZAÇÃO: 6018.24,  MESTRADO: 7195.72,   DOUTORADO: 9746.92 },
        'B4': { APERFEIÇOAMENTO: 5907.03,  ESPECIALIZAÇÃO: 6319.15,  MESTRADO: 7555.50,   DOUTORADO: 10234.27 },
        'C1': { APERFEIÇOAMENTO: 7236.11,  ESPECIALIZAÇÃO: 7740.96,  MESTRADO: 9255.49,   DOUTORADO: 12536.98 },
        'C2': { APERFEIÇOAMENTO: 7597.91,  ESPECIALIZAÇÃO: 8128.01,  MESTRADO: 9718.26,   DOUTORADO: 13163.83 },
        'C3': { APERFEIÇOAMENTO: 7977.81,  ESPECIALIZAÇÃO: 8534.41,  MESTRADO: 10204.17,  DOUTORADO: 13822.02 },
        'C4': { APERFEIÇOAMENTO: 8376.70,  ESPECIALIZAÇÃO: 8961.13,  MESTRADO: 10714.38,  DOUTORADO: 14513.12 },
        'D':  { APERFEIÇOAMENTO: 9214.38,  ESPECIALIZAÇÃO: 9857.25,  MESTRADO: 11785.83,  DOUTORADO: 15964.45 },
        'E':  { DOUTORADO: 15964.45 }
      },
      'DE': {
        'A':  { APERFEIÇOAMENTO: 7036.91,   ESPECIALIZAÇÃO: 7676.63,   MESTRADO: 9595.78,   DOUTORADO: 13753.96 },
        'B1': { APERFEIÇOAMENTO: 7459.12,   ESPECIALIZAÇÃO: 8137.22,   MESTRADO: 10171.53,  DOUTORADO: 14579.19 },
        'B2': { APERFEIÇOAMENTO: 7832.07,   ESPECIALIZAÇÃO: 8544.08,   MESTRADO: 10680.10,  DOUTORADO: 15308.15 },
        'B3': { APERFEIÇOAMENTO: 8223.67,   ESPECIALIZAÇÃO: 8971.29,   MESTRADO: 11214.11,  DOUTORADO: 16073.55 },
        'B4': { APERFEIÇOAMENTO: 8634.85,   ESPECIALIZAÇÃO: 9419.85,   MESTRADO: 11774.81,  DOUTORADO: 16877.23 },
        'C1': { APERFEIÇOAMENTO: 10577.71,  ESPECIALIZAÇÃO: 11539.32,  MESTRADO: 14424.15,  DOUTORADO: 20674.61 },
        'C2': { APERFEIÇOAMENTO: 11106.59,  ESPECIALIZAÇÃO: 12116.28,  MESTRADO: 15145.35,  DOUTORADO: 21708.34 },
        'C3': { APERFEIÇOAMENTO: 11661.92,  ESPECIALIZAÇÃO: 12722.10,  MESTRADO: 15902.62,  DOUTORADO: 22793.76 },
        'C4': { APERFEIÇOAMENTO: 12245.01,  ESPECIALIZAÇÃO: 13358.20,  MESTRADO: 16697.75,  DOUTORADO: 23933.44 },
        'D':  { APERFEIÇOAMENTO: 13469.53,  ESPECIALIZAÇÃO: 14694.04,  MESTRADO: 18367.54,  DOUTORADO: 26326.81 },
        'E':  { DOUTORADO: 26326.81 }
      }
    };

    var $ = function (id) { return document.getElementById(id); };

    function regimeParaChave(regime) {
      if (regime === 'Dedicação Exclusiva (DE)') return 'DE';
      if (regime === '40 horas') return '40H';
      if (regime === '20 horas') return '20H';
      return null;
    }

    // Chave de busca na tabela: 'B3', 'C1', ou apenas 'A'/'D'/'E' (nível Único)
    function chaveTabela(classe, nivel) {
      if (!classe) return null;
      if (nivel && nivel !== 'Único') return classe + nivel;
      return classe;
    }

    // -------------------------------------------------------------------------
    // NÍVEL — populado a partir da CLASSE, sempre visível
    // -------------------------------------------------------------------------
    function popularNivel() {
      var classe = $('classe').value;
      var nivelSelect = $('nivel');
      var hint = $('nivel_hint');
      var niveis = NIVEIS_POR_CLASSE[classe] || [];

      nivelSelect.innerHTML = '';
      nivelSelect.classList.remove('sindi-unico');

      if (!classe) {
        nivelSelect.appendChild(new Option('Selecione a classe primeiro', ''));
        nivelSelect.disabled = true;
        nivelSelect.required = true;
        hint.textContent = 'O nível aparece assim que você escolher a classe.';
        return;
      }

      nivelSelect.disabled = false;
      nivelSelect.required = true;

      if (niveis.length === 1 && niveis[0] === 'Único') {
        // Classes de nível único: o campo continua visível e é enviado como "Único"
        nivelSelect.appendChild(new Option('Único', 'Único'));
        nivelSelect.value = 'Único';
        nivelSelect.classList.add('sindi-unico');
        hint.textContent = 'Esta classe tem nível único.';
      } else {
        nivelSelect.appendChild(new Option('Selecione...', ''));
        niveis.forEach(function (niv) {
          nivelSelect.appendChild(new Option('Nível ' + niv, niv));
        });
        hint.textContent = 'Níveis 1 a 4, conforme sua progressão.';
      }
    }

    function popularTitulacao() {
      var classe = $('classe').value;
      var titulacaoSelect = $('titulacao');
      var titulacoes = TITULACOES_POR_CLASSE[classe] || [];

      titulacaoSelect.innerHTML = '';
      titulacaoSelect.classList.remove('sindi-unico');

      if (!classe) {
        titulacaoSelect.appendChild(new Option('Selecione a classe primeiro', ''));
        titulacaoSelect.disabled = true;
        return;
      }

      titulacaoSelect.disabled = false;

      if (titulacoes.length === 1) {
        titulacaoSelect.appendChild(new Option(rotuloTitulacao(titulacoes[0]), titulacoes[0]));
        titulacaoSelect.value = titulacoes[0];
        titulacaoSelect.classList.add('sindi-unico');
      } else {
        titulacaoSelect.appendChild(new Option('Selecione...', ''));
        titulacoes.forEach(function (tit) {
          titulacaoSelect.appendChild(new Option(rotuloTitulacao(tit), tit));
        });
      }
    }

    function rotuloTitulacao(tit) {
      return tit.charAt(0) + tit.slice(1).toLowerCase();
    }

    function aoMudarClasse() {
      popularNivel();
      popularTitulacao();
      atualizarConcatenado();
      calcularContribuicao();
    }

    function atualizarConcatenado() {
      var classe = $('classe').value;
      var titulacao = $('titulacao').value;
      var nivel = $('nivel').value;
      var hidden = $('categoria_docente');

      if (!classe || !titulacao || !nivel) { hidden.value = ''; return; }

      if (classe === 'E') {
        hidden.value = 'CARGO ISOLADO - PROFESSOR TITULAR-LIVRE - DOUTORADO';
      } else if (nivel === 'Único') {
        hidden.value = 'CLASSE ' + classe + ' - ' + titulacao;
      } else {
        hidden.value = 'CLASSE ' + classe + ' - NÍVEL ' + nivel + ' - ' + titulacao;
      }
    }

    function calcularContribuicao() {
      var regime = $('regime_trabalho').value;
      var classe = $('classe').value;
      var nivel = $('nivel').value;
      var titulacao = $('titulacao').value;
      var display = $('valor_contribuicao_display');
      var hidden = $('valor_contribuicao');

      if (!regime || !classe || !nivel || !titulacao) {
        display.textContent = 'Preencha Classe, Nível, Titulação e Regime de trabalho acima para ver o valor da sua contribuição.';
        hidden.value = '';
        return;
      }

      var regimeKey = regimeParaChave(regime);
      var chave = chaveTabela(classe, nivel);
      var remuneracao = null;

      if (regimeKey && REMUNERACAO[regimeKey] && REMUNERACAO[regimeKey][chave]) {
        var v = REMUNERACAO[regimeKey][chave][titulacao];
        if (v !== undefined) remuneracao = v;
      }

      if (remuneracao !== null) {
        var valor = remuneracao * 0.01;
        display.innerHTML = 'Contribuição mensal: <strong>R$ ' + valor.toFixed(2).replace('.', ',') +
          '</strong> (1% de R$ ' + remuneracao.toFixed(2).replace('.', ',') + ')';
        hidden.value = valor.toFixed(2);
      } else {
        display.innerHTML = 'Valor não disponível na tabela para esta combinação — <a href="mailto:ufsbsindicato@gmail.com">consulte a tesouraria</a> para confirmar o valor exato antes de depositar.';
        hidden.value = '';
      }
    }

    // -------------------------------------------------------------------------
    // Eventos
    // -------------------------------------------------------------------------
    $('classe').addEventListener('change', aoMudarClasse);
    $('nivel').addEventListener('change', function () { atualizarConcatenado(); calcularContribuicao(); });
    $('titulacao').addEventListener('change', function () { atualizarConcatenado(); calcularContribuicao(); });
    $('regime_trabalho').addEventListener('change', calcularContribuicao);

    // Estado inicial coerente (também cobre recarregamentos com valores preservados pelo navegador)
    aoMudarClasse();

    $('sindiForm').addEventListener('submit', function (e) {
      e.preventDefault();

      var form = this;
      var btn = $('submitBtn');
      btn.innerText = 'Enviando aguarde...';
      btn.disabled = true;

      // =========================================================================
      // COLE AQUI A URL /exec DA IMPLANTAÇÃO ATIVA DO APPS SCRIPT.
      // Onde encontrar: Apps Script > Implantar > Gerenciar implantações.
      // Para validar, abra a URL no navegador: ela deve responder com a marca
      // da versão, o nome da planilha e o nome da pasta de comprovantes.
      // Ao atualizar este bloco no futuro, reponha a URL antes de publicar.
      var scriptURL = 'https://script.google.com/macros/s/AKfycbzXgY1ceoltk4BCXoTMRI_OARf_bigbwLzxeYMEp1SINyIoY6xajFr9MVoxDgVx3_2P/exec';
      // =========================================================================

      // Sem a URL correta o envio se perderia em silêncio: o modo no-cors não
      // enxerga a resposta do servidor, então o formulário diria "Sucesso".
      if (scriptURL.indexOf('COLE_AQUI') === 0 || scriptURL.indexOf('/exec') === -1) {
        alert('Formulário fora do ar por falta de configuração. '
              + 'Avise a diretoria pelo e-mail sindiufsb2020@gmail.com.');
        resetButton();
        return;
      }

      function resetButton() {
        btn.innerText = 'Filiar-se agora';
        btn.disabled = false;
      }

      function sendData(fileDataUrl, fileName, fileMime) {
        var formData = new FormData(form);
        formData.set('aceita_whatsapp', $('aceita_whatsapp').checked ? 'on' : '');
        formData.delete('comprovante'); // remove o File cru; enviamos como base64 abaixo

        if (fileDataUrl) {
          formData.append('comprovante_data', fileDataUrl);
          formData.append('comprovante_filename', fileName);
          formData.append('comprovante_mimetype', fileMime);
        }

        fetch(scriptURL, { method: 'POST', body: formData, mode: 'no-cors' })
          .then(function () {
            $('successMessage').style.display = 'block';
            resetButton();
            form.reset();
            aoMudarClasse(); // repopula Nível e Titulação após o reset
            setTimeout(function () {
              $('successMessage').style.display = 'none';
            }, 6000);
          })
          .catch(function () {
            alert('Erro ao enviar o formulário. Verifique sua conexão e tente novamente.');
            resetButton();
          });
      }

      if (!$('nivel').value) {
        alert('Selecione o Nível da sua categoria docente.');
        resetButton();
        return;
      }

      atualizarConcatenado();
      if (!$('categoria_docente').value) {
        alert('Complete os campos de Categoria Docente (Classe, Nível e Titulação).');
        resetButton();
        return;
      }

      var fileInput = $('comprovante');
      var file = fileInput.files[0];
      var MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

      if (file && file.size > MAX_SIZE_BYTES) {
        alert('O arquivo do comprovante excede o limite de 1MB. Por favor, envie um arquivo menor.');
        resetButton();
        return;
      }

      if (file) {
        var reader = new FileReader();
        reader.onload = function () {
          sendData(reader.result, file.name, file.type);
        };
        reader.onerror = function () {
          alert('Erro ao ler o arquivo de comprovante. Tente novamente.');
          resetButton();
        };
        reader.readAsDataURL(file);
      } else {
        sendData(null, null, null);
      }
    });

})();

// Centro de formação por campus. O valor gravado na planilha (coluna N) é a
// sigla; o campus já vai em outra coluna, então "IHAC" basta.
(function () {
  var form = document.getElementById('sindiForm');
  if (!form) { return; }

  var CENTROS_POR_CAMPUS = {
    'Campus Jorge Amado':     ['IHAC', 'CFCAF', 'CFTCI', 'CFPPTS'],
    'Campus Sosígenes Costa': ['IHAC', 'CFAC', 'CFCAM', 'CFCHS'],
    'Campus Paulo Freire':    ['IHAC', 'CFDT', 'CFCS'],
    'Campus Maria Filipa':    ['IHAC']
  };

  var campus = document.getElementById('campus');
  var centro = document.getElementById('centro_formacao');

  function popularCentros() {
    var anterior = centro.value;
    var centros = CENTROS_POR_CAMPUS[campus.value] || [];
    centro.innerHTML = '';
    if (!centros.length) {
      centro.appendChild(new Option('Selecione o campus primeiro', ''));
      centro.disabled = true;
      return;
    }
    centro.disabled = false;
    if (centros.length > 1) centro.appendChild(new Option('Selecione', ''));
    centros.forEach(function (c) { centro.appendChild(new Option(c, c)); });
    if (centros.indexOf(anterior) > -1) centro.value = anterior;
  }

  campus.addEventListener('change', popularCentros);
  // form.reset() depois do envio volta o campus ao vazio: repopula em seguida.
  form.addEventListener('reset', function () { setTimeout(popularCentros, 0); });
  popularCentros();
})();
