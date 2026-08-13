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
        ok: '<svg class="sei-agr-toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/><path d="M8 12.5l2.5 2.5 5.5-5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        erro: '<svg class="sei-agr-toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        neutro: '<svg class="sei-agr-toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
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
    // Paleta local: teal é ação; amarelo deixa de competir com os botões e
    // fica reservado para destaques do produto/estado.
    // Especificidade alta (classe dupla) para vencer as regras do CKEditor.
    var B = 'button.sei-agr-btn.sei-agr-btn';
    var CSS = [
        // ── Tokens locais ─────────────────────────────────────────────────
        ':root{--sei-agr-accent:#0B6E8D;--sei-agr-accent-hover:#095D75;',
        '--sei-agr-accent-link:#0B6E8D;--sei-agr-accent-soft:rgba(11,110,141,.10);',
        '--sei-agr-ink:#17313D;--sei-agr-muted:#5A6D7C;--sei-agr-border:#C7D7DE;',
        '--sei-agr-surface:#FFFFFF;--sei-agr-subtle:#F4F8FA;--sei-agr-focus:#0B2A3A;',
        '--sei-agr-on-accent:#FFFFFF;--sei-agr-success:#0B6B3A;--sei-agr-danger:#B42318;',
        '--sei-agr-overlay:rgba(13,32,41,.52);--sei-agr-shadow:rgba(13,32,41,.16)}',
        '@media (prefers-color-scheme:dark){:root{--sei-agr-accent-link:#7BD3E4;',
        '--sei-agr-accent-soft:rgba(123,211,228,.16);--sei-agr-ink:#F2F7F8;',
        '--sei-agr-muted:#B4C5CC;--sei-agr-border:#3D5964;--sei-agr-surface:#14252E;',
        '--sei-agr-subtle:#1C333D;--sei-agr-focus:#D7F3FA;--sei-agr-overlay:rgba(0,0,0,.68);',
        '--sei-agr-shadow:rgba(0,0,0,.42);--sei-agr-success:#49D39A;--sei-agr-danger:#FF8B82}}',

        // ── Botão principal ──────────────────────────────────────────────
        B + '{position:relative;overflow:hidden;isolation:isolate;',
        'display:inline-flex;align-items:center;justify-content:center;align-self:center;',
        'gap:6px;height:30px;padding:0 10px;margin:0 4px 0 auto;',
        'border:1px solid var(--sei-agr-accent);border-radius:6px;cursor:pointer;white-space:nowrap;',
        'font:600 11px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.01em;',
        'color:var(--sei-agr-on-accent) !important;-webkit-text-fill-color:currentColor !important;',
        'background:var(--sei-agr-accent);',
        'box-shadow:0 1px 2px var(--sei-agr-shadow);',
        'transition:background-color .16s ease,border-color .16s ease,box-shadow .16s ease,',
        'transform .16s ease;box-sizing:border-box}',

        // Os ícones usam currentColor para que o secundário possa ser escuro.
        B + ' *{color:inherit !important;-webkit-text-fill-color:currentColor !important}',
        B + '>*{position:relative;z-index:1}',
        B + ' svg{flex:none}',
        // Rótulo: transição suave para esconder em telas estreitas
        B + ' .sei-agr-rotulo{transition:opacity .16s ease;',
        'overflow:hidden;max-width:200px;opacity:1}',

        // ── Hover ────────────────────────────────────────────────────────
        B + ':hover{background:var(--sei-agr-accent-hover);border-color:var(--sei-agr-accent-hover);',
        'box-shadow:0 3px 8px var(--sei-agr-shadow);',
        'transform:translateY(-1px)}',

        // ── Active ───────────────────────────────────────────────────────
        B + ':active{transform:translateY(0) scale(.97);',
        'box-shadow:0 1px 2px var(--sei-agr-shadow);',
        'transition-duration:.08s}',

        // ── Focus ────────────────────────────────────────────────────────
        B + ':focus-visible{outline:2px solid var(--sei-agr-focus);outline-offset:2px;',
        'box-shadow:0 0 0 4px var(--sei-agr-surface)}',

        // ── Loading ──────────────────────────────────────────────────────
        B + '[disabled]{cursor:default;background:var(--sei-agr-accent-hover);',
        'box-shadow:none;transform:none;border-color:var(--sei-agr-accent-hover);opacity:.78}',
        B + '.sei-agr-loading{background:var(--sei-agr-accent-hover)}',
        '.sei-agr-inline-spinner{display:inline-flex;align-items:center}',

        // ── Keyframes ────────────────────────────────────────────────────
        '@keyframes sei-agr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
        '.sei-agr-spinner{animation:sei-agr-spin .7s linear infinite;transform-origin:center}',

        // ── Fallback (fora da toolbar) ───────────────────────────────────
        B + '.solto{position:fixed;bottom:24px;right:24px;z-index:2147483000;margin:0;',
        'padding:7px 12px;font-size:13px;border-radius:8px;',
        'box-shadow:0 6px 18px var(--sei-agr-shadow)}',

        // ── Toast ────────────────────────────────────────────────────────
        'div.sei-agr-toast{position:fixed;top:60px;right:16px;z-index:2147483000;',
        'width:auto;max-width:min(380px,calc(100vw - 32px));',
        'padding:12px 38px 12px 14px;border-radius:10px;',
        'background:var(--sei-agr-surface);',
        'color:var(--sei-agr-ink);border:1px solid var(--sei-agr-border);',
        'font:500 13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
        'box-shadow:0 8px 24px var(--sei-agr-shadow);',
        'display:flex;align-items:flex-start;gap:10px;overflow:hidden;',
        'box-sizing:border-box;',
        'animation:sei-agr-toast-in .35s cubic-bezier(.16,1,.3,1)}',

        // Toast saindo
        'div.sei-agr-toast.saindo{animation:sei-agr-toast-out .3s cubic-bezier(.4,0,.6,1) forwards}',

        // Ícone de status do toast
        '.sei-agr-toast-icon{flex:none;margin-top:1px;color:var(--sei-agr-accent-link)}',
        '.sei-agr-toast.ok .sei-agr-toast-icon{color:var(--sei-agr-success)}',
        '.sei-agr-toast.erro .sei-agr-toast-icon{color:var(--sei-agr-danger)}',

        // Texto do toast
        '.sei-agr-toast-msg{flex:1;line-height:1.45;word-break:break-word;min-width:0}',
        // Números de protocolo destacados
        '.sei-agr-num{font-weight:700;font-variant-numeric:tabular-nums;',
        'color:var(--sei-agr-ink) !important;letter-spacing:.02em}',

        // Botão fechar do toast
        '.sei-agr-toast-close{position:absolute;top:8px;right:8px;',
        'width:28px;height:28px;border:0;border-radius:6px;cursor:pointer;',
        'background:transparent;color:var(--sei-agr-muted) !important;font:500 16px/1 sans-serif;',
        'display:flex;align-items:center;justify-content:center;',
        'transition:background-color .14s ease,color .14s ease}',
        '.sei-agr-toast-close:hover{background:var(--sei-agr-accent-soft);color:var(--sei-agr-ink) !important}',

        // Toast keyframes
        '@keyframes sei-agr-toast-in{from{opacity:0;transform:translateY(-6px)}',
        'to{opacity:1;transform:translateY(0)}}',
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
        '.sei-agr-toast-close{top:6px;right:6px;width:28px;height:28px;font-size:14px}',
        '}',

        // ── Botão secundário (Importar Resolução): outline ───────────────
        B + '.sei-agr-btn-2{margin-left:0;',
        'background:transparent;color:var(--sei-agr-accent-link) !important;',
        'border-color:var(--sei-agr-accent-link);box-shadow:none}',
        B + '.sei-agr-btn-2:hover{background:var(--sei-agr-accent-soft);',
        'color:var(--sei-agr-accent-link) !important;border-color:var(--sei-agr-accent-link);',
        'box-shadow:none}',

        // ── Modal de importação ──────────────────────────────────────────
        '.sei-agr-overlay{position:fixed;inset:0;z-index:2147483100;',
        'background:var(--sei-agr-overlay);',
        'display:flex;align-items:flex-start;justify-content:center;padding:8vh 16px 16px;',
        'animation:sei-agr-toast-in .2s ease}',
        '.sei-agr-modal{width:100%;max-width:480px;max-height:76vh;display:flex;flex-direction:column;',
        'background:var(--sei-agr-surface);border-radius:10px;overflow:hidden;',
        'box-shadow:0 20px 48px var(--sei-agr-shadow);',
        'font:400 13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--sei-agr-ink)}',
        '.sei-agr-modal h2{margin:0;padding:14px 44px 14px 16px;font:600 14px/1.3 inherit;color:var(--sei-agr-ink);',
        'border-bottom:1px solid var(--sei-agr-border);background:var(--sei-agr-subtle)}',
        '.sei-agr-modal-x{position:absolute;top:10px;right:10px;width:26px;height:26px;border:0;',
        'border-radius:7px;background:transparent;color:var(--sei-agr-muted);font:500 19px/1 sans-serif;cursor:pointer;',
        'display:flex;align-items:center;justify-content:center}',
        '.sei-agr-modal-x:hover{background:var(--sei-agr-accent-soft);color:var(--sei-agr-ink)}',
        '.sei-agr-busca{display:flex;gap:6px;padding:12px 16px}',
        '.sei-agr-busca input{flex:1;min-width:0;height:32px;padding:0 10px;border-radius:7px;',
        'border:1px solid var(--sei-agr-border);background:var(--sei-agr-surface);',
        'font:400 13px/1 inherit;color:var(--sei-agr-ink);',
        'font-variant-numeric:tabular-nums;box-sizing:border-box}',
        '.sei-agr-busca input:focus{outline:2px solid var(--sei-agr-focus);outline-offset:1px;',
        'border-color:var(--sei-agr-accent-link)}',
        '.sei-agr-lista{flex:1;overflow-y:auto;padding:0 8px 8px;margin:0;list-style:none}',
        '.sei-agr-lista li{margin:0 0 3px}',
        '.sei-agr-item{display:block;width:100%;text-align:left;border:0;background:transparent;',
        'padding:9px 10px;border-radius:8px;cursor:pointer;font:400 13px/1.35 inherit;color:var(--sei-agr-ink)}',
        '.sei-agr-item:hover,.sei-agr-item:focus-visible{background:var(--sei-agr-accent-soft);outline:none}',
        '.sei-agr-item b{font-weight:600;font-variant-numeric:tabular-nums}',
        '.sei-agr-item span{display:block;color:var(--sei-agr-muted);font-size:11.5px;margin-top:2px;',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.sei-agr-msg{padding:14px 16px;color:var(--sei-agr-muted);text-align:center}',
        '.sei-agr-msg a{color:var(--sei-agr-accent-link);font-weight:600}',
        '.sei-agr-modal h2{position:relative}',

        // ── Reduced motion ───────────────────────────────────────────────
        '@media (prefers-reduced-motion:reduce){',
        B + ',.sei-agr-toast,.sei-agr-spinner,' + B + '.sei-agr-loading,.sei-agr-overlay',
        '{animation:none !important;transition:none !important}',
        B + ':active{transform:none}}',
    ].join('');
    var estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    // ── Ícone principal: corrente/elo moderno ─────────────────────────────
    var ICONE = '<svg class="sei-agr-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
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

    // ═══════════════════════════════════════════════════════════════════════
    // Importar Resolucao Gerada
    //
    // Busca a minuta no Gestao de Autos IA (gestao-autos.duckdns.org) e cola
    // ementa / considerandos / artigos nos blocos correspondentes do modelo de
    // Resolucao do SEI.
    // ═══════════════════════════════════════════════════════════════════════

    // ── Canal com o service worker, via ponte.js ─────────────────────────
    // Este arquivo roda no mundo MAIN e nao tem chrome.runtime; ponte.js roda
    // no mundo ISOLATED e repassa. O token nunca chega aqui.
    var seqApi = 0;
    function api(acao, arg) {
        return new Promise(function (resolve) {
            var id = 'sei-agr-' + (++seqApi);
            var expirou = setTimeout(function () {
                window.removeEventListener('message', ouvir);
                resolve({ ok: false, erro: 'A extensão não respondeu. Recarregue a página (F5).' });
            }, 20000);
            function ouvir(ev) {
                if (ev.source !== window || !ev.data || ev.data.seiAgrResposta !== id) return;
                clearTimeout(expirou);
                window.removeEventListener('message', ouvir);
                resolve(ev.data.payload);
            }
            window.addEventListener('message', ouvir);
            window.postMessage({ seiAgrPedido: id, acao: acao, arg: arg }, location.origin);
        });
    }

    function avisarErroApi(r) {
        if (r.semSessao) {
            return aviso('Entre no Gestão de Autos IA (' + r.loginUrl + ') e tente de novo.', 'erro');
        }
        aviso(r.erro || 'Falha ao consultar o Gestão de Autos IA.', 'erro');
    }

    // ── Mapeamento dos blocos da Resolucao ───────────────────────────────
    // O documento do SEI 5 e multi-root: cada bloco do modelo (ementa,
    // considerandos, RESOLVE:, artigos) e um root separado. A ordem de
    // getRootNames() e a de registro, nao a visual -- por isso a ordenacao sai
    // da posicao real no DOM.
    function rootsEmOrdem(ed) {
        return ed.model.document.getRootNames()
            .map(function (nome) {
                var el;
                try { el = ed.ui.getEditableElement(nome); } catch (e) { el = null; }
                if (!el) return null;
                return {
                    nome: nome,
                    el: el,
                    editavel: el.getAttribute('contenteditable') === 'true',
                    texto: (el.innerText || '').replace(/\s+/g, ' ').trim(),
                    // A classe do editable identifica a seção principal
                    // ('infra-editor__secao-principal' = os artigos).
                    classe: el.className || '',
                    // O estilo do parágrafo identifica a ementa
                    // ('Texto_Ementa'), e é o que a colagem tem que preservar.
                    estilo: estiloDoRoot(ed, nome),
                };
            })
            .filter(Boolean)
            .sort(function (a, b) {
                var p = a.el.compareDocumentPosition(b.el);
                if (p & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (p & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });
    }

    // mapearBlocos/blocosOcupados vem de blocos.js (funcao pura, testada em
    // test-blocos.js). Aqui so a leitura do DOM.
    function blocosResolucao(ed) {
        return mapearBlocos(rootsEmOrdem(ed));
    }

    // ── Colagem ──────────────────────────────────────────────────────────

    // O atributo de modelo `estilo` do primeiro paragrafo do root. E o plugin
    // Estilo do SEI que o converte na classe do <p> ('Texto_Ementa',
    // 'Texto_Justificado_Recuo_Primeira_Linha', ...).
    function estiloDoRoot(ed, nome) {
        try {
            var primeiro = ed.model.document.getRoot(nome).getChild(0);
            return primeiro && primeiro.getAttribute('estilo');
        } catch (e) { return undefined; }
    }

    // Carrega o estilo do bloco de destino na propria classe dos <p> colados.
    //
    // O plugin Estilo do SEI faz upcast de class="Texto_Ementa" para o atributo
    // de modelo `estilo` -- e como o documento inteiro e carregado desse mesmo
    // HTML, esse conversor existe com certeza.
    //
    // Medido no editor, substituir o conteudo inteiro do root ja preserva o
    // estilo em TODOS os paragrafos sozinho, sem isto. Fica porque e uma linha e
    // cobre o caso em que a minuta traz mais paragrafos do que o bloco tem: aí
    // o CKEditor cria paragrafo novo, e paragrafo novo o plugin Estilo estiliza
    // com o proximo estilo da tabela dele, nao com o do destino.
    // So o `<p>` pelado, que e o que dividir_documento() emite. Casar tambem
    // `<p ...>` produziria dois atributos `class` no mesmo elemento se a minuta
    // um dia trouxer um; sem casar, o estilo apenas nao e injetado, e a heranca
    // do paragrafo de destino continua valendo.
    function comEstilo(html, estilo) {
        if (!estilo) return html;
        return html.split('<p>').join('<p class="' + estilo + '">');
    }

    // Converte HTML pelo mesmo caminho que o Ctrl+V usa: o data processor gera a
    // view, o upcast do editor gera o modelo. O contexto '$clipboardHolder' e o
    // mesmo que o ClipboardPipeline passa -- e o que faz o conversor de `class`
    // para o atributo `estilo` do SEI rodar aqui igual.
    function fragmentoDe(ed, html, estilo) {
        return ed.data.toModel(ed.data.processor.toView(comEstilo(html, estilo)), '$clipboardHolder');
    }

    // Insere cada bloco no SEU root, numa transacao unica. Devolve os nomes dos
    // blocos que nao mudaram.
    //
    // Por `insertContent` com o range EXPLICITO, e nao disparando um evento de
    // colagem. O pipeline de clipboard insere onde esta a selecao do DOCUMENTO,
    // e num documento multi-root nao ha como mover essa selecao para outro root
    // de forma confiavel: `el.focus()` e assincrono e o CKEditor ressincroniza a
    // selecao a partir do DOM depois, desfazendo o setSelection. Na pratica as
    // tres colagens caiam todas no root da secao principal
    // (infra-editor__secao-principal), duplicadas -- porque a verificacao olhava
    // o root pretendido, nao via mudanca e ainda tentava a segunda via.
    //
    // `insertContent` e exatamente o passo final do pipeline de colagem
    // (contentInsertion), so sem o chute da selecao: a formatacao herdada
    // continua a do paragrafo de destino.
    function colarBlocos(ed, itens) {
        var antes = itens.map(function (it) { return ed.getData({ rootName: it.bloco.nome }); });
        // Os fragmentos saem TODOS antes do model.change: se a conversao de um
        // deles estourar, o documento nao foi tocado.
        var frags = itens.map(function (it) { return fragmentoDe(ed, it.html, it.bloco.estilo); });

        // Uma transacao: um unico Ctrl+Z desfaz a importacao inteira.
        ed.model.change(function () {
            itens.forEach(function (it, i) {
                var root = ed.model.document.getRoot(it.bloco.nome);
                // Range no root inteiro: insertContent apaga o que esta
                // selecionado antes de inserir, entao isto SUBSTITUI o bloco em
                // vez de acrescentar. E o que faz reimportar nao empilhar.
                ed.model.insertContent(frags[i], ed.model.createRangeIn(root));
            });
        });

        return itens
            .filter(function (it, i) { return ed.getData({ rootName: it.bloco.nome }) === antes[i]; })
            .map(function (it) { return it.nome; });
    }

    function importar(numero) {
        var ed = editorAtual();
        if (!ed) return aviso('Editor do SEI não encontrado nesta página.', 'erro');

        var blocos = blocosResolucao(ed);
        if (!blocos) {
            console.warn('[sei-agr] roots desta página:', rootsEmOrdem(ed));
            return aviso('Este documento não parece ser uma Resolução: não encontrei os blocos ' +
                         'ementa / considerandos / RESOLVE: / artigos.', 'erro');
        }

        // Sobrescrever texto que o usuario escreveu custa o trabalho dele. Um
        // Ctrl+Z devolve, mas so se ele perceber a tempo -- por isso pergunta
        // antes, e so quando ha algo de verdade para perder.
        var ocupados = blocosOcupados(blocos);
        if (ocupados.length && !window.confirm(
            'Os blocos ' + ocupados.join(', ') + ' já têm texto escrito.\n\n' +
            'Substituir pelo conteúdo da minuta?')) {
            return;
        }

        aviso('Buscando a minuta do processo ' + numero + '…');
        return api('resolucao', numero).then(function (r) {
            if (!r.ok) return avisarErroApi(r);

            var itens = [
                { nome: 'ementa', bloco: blocos.ementa, html: r.dados.ementa },
                { nome: 'considerandos', bloco: blocos.considerandos, html: r.dados.considerandos },
                { nome: 'artigos', bloco: blocos.artigos, html: r.dados.artigos },
            ].filter(function (it) { return it.html; });

            if (!itens.length) return aviso('A minuta deste processo veio vazia.', 'erro');

            var falhou;
            try {
                falhou = colarBlocos(ed, itens);
            } catch (e) {
                console.error('[sei-agr] colagem falhou', e);
                return aviso('O editor do SEI recusou a colagem: ' + e.message +
                             '. Nada foi alterado.', 'erro');
            }

            if (falhou.length === itens.length) {
                return aviso('O editor do SEI não aceitou nenhum dos blocos.', 'erro');
            }
            var msg = (itens.length - falhou.length) + ' de ' + itens.length +
                      ' blocos preenchidos. Revise e use "Linkar protocolos" para os números. ' +
                      'Ctrl+Z desfaz a importação inteira.';
            if (falhou.length) msg = 'Atenção: ' + falhou.join(', ') + ' não colou. ' + msg;
            aviso(msg, falhou.length ? 'erro' : 'ok');
        });
    }

    // O processo deste documento, para o modal já vir preenchido.
    // A extração é de detectar.js (pura, testada em test-deteccao.js).
    function processoDaPagina() {
        try { return processoDeReferencia(document.body.innerText || ''); }
        catch (e) { return ''; }
    }

    // ── Modal ────────────────────────────────────────────────────────────
    function fecharModal() {
        var o = document.getElementById('seiAgrOverlay');
        if (o) o.remove();
        document.removeEventListener('keydown', escFecha, true);
    }
    function escFecha(e) {
        if (e.key === 'Escape') { e.stopPropagation(); fecharModal(); }
    }

    function abrirModal() {
        fecharModal();
        var overlay = document.createElement('div');
        overlay.id = 'seiAgrOverlay';
        overlay.className = 'sei-agr-overlay';
        overlay.innerHTML =
            '<div class="sei-agr-modal" role="dialog" aria-modal="true" aria-label="Importar resolução gerada">' +
            '<h2>Importar Resolução Gerada' +
            '<button type="button" class="sei-agr-modal-x" aria-label="Fechar">&times;</button></h2>' +
            '<div class="sei-agr-busca">' +
            '<input type="text" inputmode="numeric" placeholder="Número do processo" aria-label="Número do processo">' +
            '</div><ul class="sei-agr-lista"></ul>' +
            '<div class="sei-agr-msg">Carregando os processos recentes…</div></div>';

        overlay.onclick = function (e) { if (e.target === overlay) fecharModal(); };
        overlay.querySelector('.sei-agr-modal-x').onclick = fecharModal;
        document.addEventListener('keydown', escFecha, true);
        document.body.appendChild(overlay);

        var input = overlay.querySelector('input');
        var lista = overlay.querySelector('.sei-agr-lista');
        var msg = overlay.querySelector('.sei-agr-msg');

        function dizer(html) { msg.innerHTML = html; msg.style.display = ''; }
        function calar() { msg.style.display = 'none'; }

        function render(itens) {
            lista.textContent = '';
            if (!itens.length) return dizer('Nenhum processo encontrado.');
            calar();
            itens.forEach(function (it) {
                var d = it.data || {};
                var num = d.processo || String(it.id);
                var li = document.createElement('li');
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'sei-agr-item';
                // textContent nos dois: razao social e nome de arquivo vem do
                // PDF do usuario e nao podem virar HTML dentro do SEI.
                var forte = document.createElement('b');
                forte.textContent = num;
                var sub = document.createElement('span');
                sub.textContent = [d.razao_social, d.numero_auto && 'Auto ' + d.numero_auto, it.fileName]
                    .filter(Boolean).join(' · ');
                b.appendChild(forte);
                b.appendChild(sub);
                b.onclick = function () { fecharModal(); importar(num); };
                li.appendChild(b);
                lista.appendChild(li);
            });
        }

        function carregar(acao, arg) {
            lista.textContent = '';
            dizer('Buscando…');
            api(acao, arg).then(function (r) {
                if (!r.ok) {
                    if (r.semSessao) {
                        return dizer('Sem sessão no Gestão de Autos IA.<br><a href="' + r.loginUrl +
                                     '" target="_blank" rel="noopener">Entrar no sistema</a>, ' +
                                     'depois reabra esta janela.');
                    }
                    return dizer(r.erro || 'Falha na consulta.');
                }
                render(Array.isArray(r.dados) ? r.dados : []);
            });
        }

        // Enter com um número de processo completo importa direto, sem lista:
        // é o caminho de quem já sabe o número.
        var buscaTimer;
        input.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            var v = input.value.replace(/\D/g, '');
            if (v.length >= 15) { fecharModal(); importar(v); }
        });
        input.addEventListener('input', function () {
            clearTimeout(buscaTimer);
            var v = input.value.trim();
            buscaTimer = setTimeout(function () {
                carregar(v ? 'buscar' : 'recentes', v);
            }, 350);
        });

        var n = processoDaPagina();
        if (n) input.value = n;

        input.focus();
        input.select();
        carregar('recentes', '');
    }

    // ── Botao ────────────────────────────────────────────────────────────
    var ICONE_IMPORTAR = '<svg class="sei-agr-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>';

    var botaoImportar = document.createElement('button');
    botaoImportar.type = 'button';
    botaoImportar.className = 'sei-agr-btn sei-agr-btn-2';
    botaoImportar.innerHTML = ICONE_IMPORTAR + '<span class="sei-agr-rotulo">Importar Resolução</span>';
    botaoImportar.title = 'Cola a minuta gerada pelo Gestão de Autos IA nos blocos da Resolução';
    botaoImportar.onclick = abrirModal;

    // Entra ao lado do primeiro botao. `botao` ja carrega o margin-left:auto
    // que empurra a dupla para a direita da toolbar.
    var tentativas2 = 0;
    (function encaixar2() {
        if (botao.parentNode) {
            return botao.parentNode.insertBefore(botaoImportar, botao.nextSibling);
        }
        if (++tentativas2 > 45) { // ~22s, um pouco depois do primeiro botao desistir
            botaoImportar.classList.add('solto');
            botaoImportar.style.right = '210px';
            return document.body.appendChild(botaoImportar);
        }
        setTimeout(encaixar2, 500);
    })();

    console.log('[sei-agr] carregado - Ctrl+Shift+K ou botoes na toolbar');
})();
