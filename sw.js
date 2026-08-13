// Service worker: e quem fala com o Gestao de Autos IA.
//
// Por que aqui e nao no content script: no MV3 o fetch de um content script
// segue as regras de CORS da PAGINA, ou seja precisaria de
// Access-Control-Allow-Origin no backend. O fetch do service worker, coberto
// por host_permissions, nao precisa -- entao a API nao muda em nada para
// atender a extensao.
//
// Autenticacao: NAO ha senha nesta extensao. O usuario faz login no
// Gestao de Autos IA normalmente, no site, e daqui so lemos o cookie de sessao
// via chrome.cookies e o repassamos como Bearer. O backend aceita as duas vias
// (JWT_TOKEN_LOCATION = ["cookies", "headers"]) -- e o cookie, sendo
// SameSite=Lax, nunca viajaria sozinho numa requisicao cross-site.

const API_PADRAO = 'https://gestao-autos.duckdns.org';
// Nome padrao do cookie do flask-jwt-extended (JWT_ACCESS_COOKIE_NAME).
const COOKIE_JWT = 'access_token_cookie';

async function baseApi() {
    const { apiBase } = await chrome.storage.local.get('apiBase');
    return (apiBase || API_PADRAO).replace(/\/+$/, '');
}

async function token(base) {
    const c = await chrome.cookies.get({ url: base + '/', name: COOKIE_JWT });
    return c && c.value;
}

// Devolve sempre { ok, ... } em vez de lancar: quem chama esta do outro lado de
// um postMessage, onde uma excecao viraria silencio.
async function chamar(caminho) {
    const base = await baseApi();
    const jwt = await token(base);
    if (!jwt) {
        return { ok: false, semSessao: true, loginUrl: base + '/', erro: 'Sem sessão no Gestão de Autos IA.' };
    }

    let r;
    try {
        r = await fetch(base + caminho, {
            headers: { Authorization: 'Bearer ' + jwt },
        });
    } catch (e) {
        return { ok: false, erro: 'Não foi possível alcançar ' + base + '.' };
    }

    // 401/422: token expirado ou revogado (o backend expira em 2h). Mesmo
    // tratamento de "sem sessao": o usuario precisa voltar ao site e entrar.
    if (r.status === 401 || r.status === 422) {
        return { ok: false, semSessao: true, loginUrl: base + '/', erro: 'Sessão expirada no Gestão de Autos IA.' };
    }

    let corpo = null;
    try { corpo = await r.json(); } catch (e) {}
    if (!r.ok) {
        return { ok: false, erro: (corpo && corpo.error) || 'A API respondeu HTTP ' + r.status + '.' };
    }
    return { ok: true, dados: corpo };
}

const ACOES = {
    // Os recentes que o modal mostra antes de qualquer busca.
    recentes: () => chamar('/api/history?limit=8'),
    resolucao: (n) => chamar('/api/processo/' + encodeURIComponent(n) + '/resolucao'),
    buscar: (q) => chamar('/api/history?limit=8&q=' + encodeURIComponent(q)),
};

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
    const acao = ACOES[msg && msg.acao];
    if (!acao) {
        responder({ ok: false, erro: 'Ação desconhecida.' });
        return false;
    }
    // String vazia no lugar de undefined: encodeURIComponent(undefined) viraria
    // a string "undefined" na query.
    acao(typeof msg.arg === 'string' ? msg.arg : '').then(responder);
    return true; // resposta assincrona
});
