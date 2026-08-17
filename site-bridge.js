// Ponte de comunicação e identificação com o site Gestão de Autos IA.
// Executado em document_start nos domínios do sistema.
(function () {
    'use strict';

    // Match pattern do Chrome ignora a porta: "http://localhost/*" injeta esta
    // ponte em TODO servidor de desenvolvimento da máquina. Em localhost só
    // seguem as portas do próprio app (docker: 5000, `python app.py`: 8080,
    // `npm run dev` do frontend Vite: 5173 — é nela que o React roda com hot
    // reload, e sem ela na lista a extensão nunca se anuncia durante o
    // desenvolvimento normal do frontend).
    var PORTAS_APP = ['5000', '8080', '5173'];
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
        && PORTAS_APP.indexOf(location.port) === -1) {
        return;
    }

    var manifest = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
        ? chrome.runtime.getManifest()
        : { version: '0.2.0' };
    var versao = manifest.version || '0.2.0';

    function marcarPresenca() {
        if (document.documentElement) {
            document.documentElement.dataset.seiAgrExtensao = versao;
        }
        try {
            window.dispatchEvent(new CustomEvent('sei-agr-extensao-presente', {
                detail: { versao: versao, status: 'conectado' }
            }));
        } catch (e) {}
        // Avisa o service worker qual instância do app está ativa (produção,
        // docker local ou o dev server do Vite) — é o que "Importar Resolução"
        // no SEI usa para saber ONDE buscar. Sem isto ele sempre buscava em
        // produção, mesmo com o site local mostrando "Conectada".
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ acao: 'presenca', arg: location.origin });
            }
        } catch (e) {}
    }

    marcarPresenca();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', marcarPresenca);
    }

    // Escuta evento customizado de ping
    window.addEventListener('sei-agr-ping', function () {
        marcarPresenca();
        try {
            window.dispatchEvent(new CustomEvent('sei-agr-pong', {
                detail: { versao: versao, status: 'conectado' }
            }));
        } catch (e) {}
    });

    // Escuta postMessage de ping
    window.addEventListener('message', function (ev) {
        if (!ev || !ev.data) return;
        if (ev.data.tipo === 'SEI_AGR_PING') {
            marcarPresenca();
            window.postMessage({
                tipo: 'SEI_AGR_PONG',
                versao: versao,
                status: 'conectado'
            }, '*');
        }
    });
})();
