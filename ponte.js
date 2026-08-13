// Ponte entre o content.js (que roda no mundo MAIN, para ver a instancia do
// CKEditor) e o service worker (que tem os chrome.* e faz o fetch).
//
// Existe porque um content script com "world": "MAIN" nao enxerga chrome.runtime
// -- ele compartilha o contexto da pagina. Este roda no mundo ISOLATED (o
// padrao), onde chrome.runtime existe, e so repassa mensagens.
//
// O que trafega por aqui e deliberadamente pequeno: tres acoes de LEITURA, e
// nenhuma credencial. O token fica no service worker e nunca chega ao contexto
// da pagina do SEI.
(function () {
    'use strict';

    window.addEventListener('message', function (ev) {
        // Somente mensagens desta janela e desta origem: um iframe do SEI nao
        // deve conseguir usar a ponte.
        if (ev.source !== window || ev.origin !== location.origin) return;
        var m = ev.data;
        if (!m || typeof m.seiAgrPedido !== 'string') return;

        chrome.runtime.sendMessage({ acao: m.acao, arg: m.arg }, function (resp) {
            // runtime.lastError acontece quando o service worker foi encerrado
            // no meio do caminho. Sem este tratamento o modal ficaria girando.
            var payload = resp || {
                ok: false,
                erro: (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Sem resposta da extensão.',
            };
            window.postMessage({ seiAgrResposta: m.seiAgrPedido, payload: payload }, location.origin);
        });
    });
})();
