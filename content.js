// Roda no MAIN world da pagina do editor do SEI (acesso direto a instancia do CKEditor 5).
//
// O SEI 5 usa CKEditor 5 com o plugin LinkProtocoloSei: o link e um elemento de modelo
// `SEILink` com os atributos { id, text }, onde `id` e o id_protocolo interno devolvido
// pelo servidor -- nao o numero visivel. Por isso todo candidato passa pelo endpoint
// `protocolo_link_editor` (o mesmo que o botao nativo usa). Numero que o SEI nao
// reconhece nao vira link.
(function () {
    'use strict';

    function editorAtual() {
        var els = document.querySelectorAll('.ck-editor__editable, .ck-content');
        for (var i = 0; i < els.length; i++) {
            if (els[i].ckeditorInstance) return els[i].ckeditorInstance;
        }
        return null;
    }

    function cfgSei(ed) {
        try { return ed.config.get('sei') || {}; } catch (e) { return {}; }
    }

    var cache = new Map(); // numero -> {id, text} | null

    // A resposta e XML. Sucesso traz IdProtocolo/ProtocoloFormatado; numero inexistente
    // volta como <erros><erro descricao="Protocolo nao encontrado.">.
    // Retorna {id, text} | 'nao-encontrado' | null (resposta ilegivel).
    function parseProtocolo(corpo) {
        var mId = corpo.match(/IdProtocolo["'\]\s:=>,]+([0-9]+)/i);
        if (mId) {
            var mTx = corpo.match(/ProtocoloFormatado["'\]\s:=>,]+([0-9./-]+)/i);
            return { id: mId[1], text: mTx ? mTx[1] : '' };
        }
        return /<erros?[\s>]/i.test(corpo) ? 'nao-encontrado' : null;
    }

    var sessaoRejeitada = false;

    // Os parametros vao no CORPO, nunca na query string: a URL ja carrega um
    // infra_hash que o SEI valida: acrescentar parametro nela invalida o hash e
    // o servidor responde redirecionando para o login.
    function resolverProtocolo(numero, cfg) {
        if (cache.has(numero)) return Promise.resolve(cache.get(numero));
        return fetch(cfg.urlBuscarProtocoloSei, {
            method: 'POST',
            credentials: 'same-origin',
            redirect: 'manual', // nao seguir o redirect para o login
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: 'idProtocoloDigitado=' + encodeURIComponent(numero) +
                  '&idProcedimento=' + encodeURIComponent(cfg.idProcedimento || ''),
        })
            .then(function (r) {
                if (r.type === 'opaqueredirect' || r.redirected || !r.ok) {
                    sessaoRejeitada = true;
                    throw new Error('o SEI recusou a consulta (HTTP ' + r.status + ')');
                }
                return r.text();
            })
            .then(function (t) {
                var p = parseProtocolo(t);
                if (!p) console.warn('[sei-agr] resposta ilegivel para', numero, JSON.stringify(t.slice(0, 600)));
                var res = (p && p !== 'nao-encontrado') ? p : null;
                cache.set(numero, res); // so cacheia o que o servidor respondeu de fato
                return res;
            })
            // Falha de sessao/rede nao entra no cache: senao uma nova tentativa
            // (apos o F5) devolveria o null antigo sem reconsultar.
            .catch(function (e) { console.error('[sei-agr] consulta falhou', numero, e); return null; });
    }

    // Cabecalho, rodape de referencia e separadores sao roots read-only: o SEI os gera
    // a partir do modelo. So o corpo redigido pelo usuario deve receber link.
    function rootEditavel(ed, nome) {
        var el = ed.ui.getEditableElement(nome);
        return !!el && el.getAttribute('contenteditable') === 'true';
    }

    // Percorre os roots do editor (o documento do SEI 5 e multi-root).
    function coletarAlvos(ed) {
        var alvos = [];
        ed.model.document.getRootNames().forEach(function (nome) {
            if (!rootEditavel(ed, nome)) return;
            var root = ed.model.document.getRoot(nome);
            for (const item of ed.model.createRangeIn(root).getItems()) {
                if (!item.is('$textProxy')) continue;
                candidatosProtocolo(item.data).forEach(function (c) {
                    alvos.push({
                        num: c.num,
                        parent: item.parent,
                        offset: item.startOffset + c.start,
                        len: c.len
                    });
                });
            }
        });
        return alvos;
    }

    function linkarTudo(ed) {
        var cfg = cfgSei(ed);
        if (!cfg.urlBuscarProtocoloSei) {
            return aviso('Configuração do editor do SEI indisponível. Recarregue a página.', 'erro');
        }

        var alvos = coletarAlvos(ed);
        if (!alvos.length) return aviso('Nenhum número de processo ou documento no texto.');
        aviso('Consultando ' + alvos.length + (alvos.length === 1 ? ' número' : ' números') + ' no SEI…');
        sessaoRejeitada = false;

        return Promise.all(alvos.map(function (a) { return resolverProtocolo(a.num, cfg); }))
            .then(function (protocolos) {
                var pares = alvos
                    .map(function (a, i) { return { alvo: a, p: protocolos[i] }; })
                    .filter(function (x) { return x.p; });

                if (!pares.length) {
                    if (sessaoRejeitada) {
                        return aviso('O SEI recusou a consulta. Recarregue a página (F5) e tente de novo.', 'erro');
                    }
                    return aviso('Nenhum dos ' + alvos.length + ' números existe neste SEI.');
                }
                // Uma unica transacao: um Ctrl+Z desfaz tudo de uma vez.
                ed.model.change(function (writer) {
                    // De tras pra frente: os offsets dos alvos anteriores continuam validos.
                    for (var i = pares.length - 1; i >= 0; i--) {
                        var a = pares[i].alvo, p = pares[i].p;
                        writer.remove(writer.createRange(
                            writer.createPositionAt(a.parent, a.offset),
                            writer.createPositionAt(a.parent, a.offset + a.len)));
                        writer.insert(writer.createElement('SEILink', { id: p.id, text: p.text }),
                                      a.parent, a.offset);
                    }
                });
                var n = pares.length;
                var faltaram = alvos.length - n;
                var msg = n + (n === 1 ? ' link aplicado: ' : ' links aplicados: ') +
                          pares.map(function (x) { return x.alvo.num; }).join(', ');
                if (faltaram) {
                    msg += '. ' + faltaram + (faltaram === 1 ? ' número não existe' : ' números não existem') +
                           ' neste SEI.';
                }
                aviso(msg, 'ok');
            });
    }

    // Ícones SVG de status para os toasts
    var TOAST_ICONS = {
        ok: '<svg class="sei-agr-toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#00A859" opacity="0.12"/><path d="M8 12.5l2.5 2.5 5.5-5.5" stroke="#00A859" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        erro: '<svg class="sei-agr-toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#EF4444" opacity="0.12"/><path d="M15 9l-6 6M9 9l6 6" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/></svg>',
        neutro: '<svg class="sei-agr-toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#2596be" opacity="0.12"/><path d="M12 8v4M12 16h.01" stroke="#2596be" stroke-width="2" stroke-linecap="round"/></svg>'
    };

    // tipo: 'ok' | 'erro' | '' (neutro). Recria o elemento a cada aviso para que a
    // animacao de entrada e saida rode de forma fluida.
    var avisoTimer;
    function aviso(msg, tipo) {
        var antigo = document.getElementById('seiAgrAviso');
        if (antigo) antigo.remove();
        clearTimeout(avisoTimer);

        var el = document.createElement('div');
        el.id = 'seiAgrAviso';
        el.className = 'sei-agr-toast ' + (tipo || '');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');

        // Ícone de status + texto com números em destaque + botão fechar
        var icone = tipo === 'ok' ? TOAST_ICONS.ok : tipo === 'erro' ? TOAST_ICONS.erro : TOAST_ICONS.neutro;
        // Destaca números de protocolo no texto (negrito + tabular-nums)
        var msgHtml = msg.replace(/(\d{5}\.\d{6}\/\d{4}-\d{2}|\d{7,17})/g,
            '<strong class="sei-agr-num">$1</strong>');
        el.innerHTML = icone +
            '<span class="sei-agr-toast-msg">' + msgHtml + '</span>' +
            '<button type="button" class="sei-agr-toast-close" aria-label="Fechar" title="Fechar">&times;</button>';
        el.querySelector('.sei-agr-toast-close').onclick = function () {
            el.classList.add('saindo');
            setTimeout(function () { if (el.parentNode) el.remove(); }, 300);
        };

        // Posicionamento dinâmico: alinha o toast com o botão
        posicionarToast(el);
        document.body.appendChild(el);

        avisoTimer = setTimeout(function () {
            el.classList.add('saindo');
            setTimeout(function () { if (el.parentNode) el.remove(); }, 300);
        }, 7000);
    }

    // Calcula top e right do toast a partir da posição real do botão no viewport.
    // Fallback seguro caso o botão não esteja no DOM.
    function posicionarToast(el) {
        var rect;
        try { rect = botao.getBoundingClientRect(); } catch (e) { rect = null; }
        if (rect && rect.bottom > 0 && rect.right > 0) {
            el.style.top = Math.round(rect.bottom + 8) + 'px';
            // Alinha a borda direita do toast com a borda direita do botão,
            // mas garante pelo menos 12px de margem da borda da viewport.
            var rightOffset = Math.max(12, window.innerWidth - rect.right);
            el.style.right = rightOffset + 'px';
        }
        // Sem rect: o CSS base (top:60px;right:16px) serve de fallback.
    }

    function ocupado(sim) {
        botao.disabled = sim;
        botao.classList.toggle('sei-agr-loading', sim);
        var spinnerEl = botao.querySelector('.sei-agr-inline-spinner');
        if (sim && !spinnerEl) {
            // Insere spinner ao lado do ícone, sem substituí-lo
            var span = document.createElement('span');
            span.className = 'sei-agr-inline-spinner';
            span.innerHTML = SPINNER_ICONE;
            botao.insertBefore(span, botao.querySelector('.sei-agr-rotulo'));
        } else if (!sim && spinnerEl) {
            spinnerEl.remove();
        }
        // Esconde/mostra o ícone principal
        var iconEl = botao.querySelector('.sei-agr-icon');
        if (iconEl) iconEl.style.display = sim ? 'none' : '';
        botao.querySelector('.sei-agr-rotulo').textContent = sim ? 'Vinculando…' : 'Linkar protocolos';
    }

    function executar() {
        var ed = editorAtual();
        if (!ed) return aviso('Editor do SEI não encontrado nesta página.', 'erro');
        if (botao.disabled) return;
        ocupado(true);
        Promise.resolve()
            .then(function () { return linkarTudo(ed); })
            .catch(function (e) {
                console.error('[sei-agr]', e);
                aviso('Erro: ' + e.message, 'erro');
            })
            .then(function () { ocupado(false); });
    }

    // ── CSS ────────────────────────────────────────────────────────────────
    // Cores: Teal primário (#2596be), Amarelo (#FFD100), Âmbar (#FFA800).
    // Especificidade alta (classe dupla) para vencer as regras do CKEditor.
    var B = 'button.sei-agr-btn.sei-agr-btn';
    var CSS = [
        // ── Botão principal ──────────────────────────────────────────────
        B + '{position:relative;overflow:hidden;isolation:isolate;',
        'display:inline-flex;align-items:center;justify-content:center;align-self:center;',
        'gap:5px;height:26px;padding:0 10px;margin:0 4px 0 auto;',
        'border:1px solid rgba(255,255,255,.12);border-radius:5px;cursor:pointer;white-space:nowrap;',
        'font:600 11px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.01em;',
        'color:#fff !important;-webkit-text-fill-color:#fff !important;',
        'background:linear-gradient(145deg,#2596be 0%,#1B7A9E 100%);',
        'box-shadow:0 1px 3px rgba(37,150,190,.22),inset 0 1px 0 rgba(255,255,255,.1);',
        'transition:all .22s cubic-bezier(.4,0,.2,1);box-sizing:border-box}',

        // Cor de texto forçada em todos os filhos
        B + ' *{color:#fff !important;-webkit-text-fill-color:#fff !important}',
        B + '>*{position:relative;z-index:1}',
        B + ' svg{flex:none}',
        // Rótulo: transição suave para esconder em telas estreitas
        B + ' .sei-agr-rotulo{transition:opacity .2s ease,max-width .25s ease;',
        'overflow:hidden;max-width:200px;opacity:1}',

        // Swoosh AGR: tons de amarelo/âmbar varrendo no hover
        B + '::before{content:"";position:absolute;inset:0;z-index:0;',
        'background:linear-gradient(105deg,transparent 15%,rgba(255,168,0,.4) 40%,rgba(255,209,0,.45) 55%,rgba(255,230,100,.3) 70%,transparent 85%);',
        'transform:translateX(-130%)}',

        // ── Hover ────────────────────────────────────────────────────────
        B + ':hover{background:linear-gradient(145deg,#2DAAD0 0%,#208CAB 100%);',
        'box-shadow:0 4px 12px rgba(37,150,190,.35),inset 0 1px 0 rgba(255,255,255,.14);',
        'transform:translateY(-1px)}',
        B + ':hover::before{animation:sei-agr-swoosh .85s cubic-bezier(.22,.61,.36,1)}',

        // ── Active ───────────────────────────────────────────────────────
        B + ':active{transform:translateY(0) scale(.97);',
        'box-shadow:0 1px 2px rgba(15,34,50,.15),inset 0 1px 3px rgba(0,0,0,.1);',
        'transition-duration:.08s}',

        // ── Focus ────────────────────────────────────────────────────────
        B + ':focus-visible{outline:2px solid #FFD100;outline-offset:2px}',

        // ── Loading ──────────────────────────────────────────────────────
        B + '[disabled]{cursor:default;background:linear-gradient(145deg,#2A90B5 0%,#1F7A9B 100%);',
        'box-shadow:none;transform:none;border-color:rgba(255,255,255,.08)}',
        B + '[disabled]::before{animation:none}',
        B + '.sei-agr-loading{animation:sei-agr-pulse 1.8s ease-in-out infinite}',
        '.sei-agr-inline-spinner{display:inline-flex;align-items:center}',

        // ── Keyframes ────────────────────────────────────────────────────
        '@keyframes sei-agr-swoosh{from{transform:translateX(-130%)}to{transform:translateX(130%)}}',
        '@keyframes sei-agr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
        '@keyframes sei-agr-pulse{0%,100%{opacity:1}50%{opacity:.78}}',
        '.sei-agr-spinner{animation:sei-agr-spin .7s linear infinite;transform-origin:center}',

        // ── Fallback (fora da toolbar) ───────────────────────────────────
        B + '.solto{position:fixed;bottom:24px;right:24px;z-index:2147483000;margin:0;',
        'padding:6px 18px;font-size:13px;border-radius:22px;',
        'box-shadow:0 6px 20px rgba(37,150,190,.3)}',

        // ── Toast ────────────────────────────────────────────────────────
        'div.sei-agr-toast{position:fixed;top:60px;right:16px;z-index:2147483000;',
        'width:auto;max-width:min(380px,calc(100vw - 32px));',
        'padding:12px 38px 12px 14px;border-radius:10px;',
        'background:rgba(255,255,255,.97);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
        'color:#1A2F3F;border:1px solid rgba(37,150,190,.12);',
        'font:500 13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
        'box-shadow:0 12px 32px -6px rgba(37,150,190,.18),0 4px 10px -2px rgba(37,150,190,.06);',
        'display:flex;align-items:flex-start;gap:10px;overflow:hidden;',
        'box-sizing:border-box;',
        'animation:sei-agr-toast-in .35s cubic-bezier(.16,1,.3,1)}',

        // Toast saindo
        'div.sei-agr-toast.saindo{animation:sei-agr-toast-out .3s cubic-bezier(.4,0,.6,1) forwards}',

        // Barra lateral de status (5px, arredondada)
        '.sei-agr-toast::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:5px;',
        'border-radius:0 3px 3px 0;background:#2596be}',
        '.sei-agr-toast.ok::before{background:linear-gradient(180deg,#2596be 0%,#FFD100 100%)}',
        '.sei-agr-toast.erro::before{background:#EF4444}',

        // Ícone de status do toast
        '.sei-agr-toast-icon{flex:none;margin-top:1px}',

        // Texto do toast
        '.sei-agr-toast-msg{flex:1;line-height:1.45;word-break:break-word;min-width:0}',
        // Números de protocolo destacados
        '.sei-agr-num{font-weight:700;font-variant-numeric:tabular-nums;',
        'color:#1A2F3F !important;letter-spacing:.02em}',

        // Botão fechar do toast
        '.sei-agr-toast-close{position:absolute;top:8px;right:8px;',
        'width:22px;height:22px;border:0;border-radius:6px;cursor:pointer;',
        'background:transparent;color:#8899A6 !important;font:500 16px/1 sans-serif;',
        'display:flex;align-items:center;justify-content:center;',
        'transition:all .15s ease}',
        '.sei-agr-toast-close:hover{background:rgba(37,150,190,.08);color:#1A2F3F !important}',

        // Toast keyframes
        '@keyframes sei-agr-toast-in{from{opacity:0;transform:translateY(-12px) scale(.94)}',
        'to{opacity:1;transform:translateY(0) scale(1)}}',
        '@keyframes sei-agr-toast-out{from{opacity:1;transform:translateX(0)}',
        'to{opacity:0;transform:translateX(20px)}}',

        // ── Responsivo: tela ≤ 600px — botão ícone-only ──────────────────
        '@media (max-width:600px){',
        B + '{gap:0;padding:5px 8px;border-radius:8px}',
        B + ' .sei-agr-rotulo{max-width:0;opacity:0;padding:0;margin:0;font-size:0}',
        B + '.solto{bottom:16px;right:16px;padding:8px;border-radius:50%}',
        '}',

        // ── Responsivo: tela ≤ 480px — toast compacto ────────────────────
        '@media (max-width:480px){',
        'div.sei-agr-toast{right:8px;left:8px;max-width:none;',
        'font-size:12.5px;padding:10px 34px 10px 12px;border-radius:8px}',
        '.sei-agr-toast-icon{width:16px;height:16px}',
        '.sei-agr-toast-close{top:6px;right:6px;width:20px;height:20px;font-size:14px}',
        '}',

        // ── Reduced motion ───────────────────────────────────────────────
        '@media (prefers-reduced-motion:reduce){',
        B + ',' + B + '::before,.sei-agr-toast,.sei-agr-spinner,' + B + '.sei-agr-loading',
        '{animation:none !important;transition:none !important}',
        B + ':active{transform:none}}',
    ].join('');
    var estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    // ── Ícone principal: corrente/elo moderno ─────────────────────────────
    var ICONE = '<svg class="sei-agr-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff"' +
        ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M15 7h3a5 5 0 0 1 0 10h-3"/>' +
        '<path d="M9 17H6a5 5 0 0 1 0-10h3"/>' +
        '<line x1="8" y1="12" x2="16" y2="12"/></svg>';

    // ── Spinner circular fluido ──────────────────────────────────────────
    var SPINNER_ICONE = '<svg class="sei-agr-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9.5" stroke="rgba(255,255,255,0.2)" stroke-width="2.5"/>' +
        '<path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
        '</svg>';

    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'sei-agr-btn';
    botao.innerHTML = ICONE + '<span class="sei-agr-rotulo">Linkar protocolos</span>';
    botao.title = 'Vincula números de processo e documento como links do SEI · Ctrl+Shift+K';
    botao.onclick = executar;

    // A toolbar do CKEditor 5 e flex: `margin-left:auto` joga o botao para o espaco
    // livre a direita. Se ela nao aparecer, o botao volta a flutuar no canto.
    var tentativas = 0;
    (function encaixar() {
        var toolbar = document.querySelector('.ck-toolbar__items') || document.querySelector('.ck-toolbar');
        if (toolbar) return toolbar.appendChild(botao);
        if (++tentativas > 40) { // ~20s
            botao.classList.add('solto');
            return document.body.appendChild(botao);
        }
        setTimeout(encaixar, 500);
    })();

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
            e.preventDefault();
            executar();
        }
    }, true);

    console.log('[sei-agr] carregado - Ctrl+Shift+K ou botao no canto inferior direito');
})();

