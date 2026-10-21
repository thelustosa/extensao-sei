// Roda no MAIN world da pagina do editor do SEI (acesso direto a instancia do CKEditor 5).
//
// O SEI 5 usa CKEditor 5 com o plugin LinkProtocoloSei: o link e um elemento de modelo
// `SEILink` com os atributos { id, text }, onde `id` e o id_protocolo interno devolvido
// pelo servidor -- nao o numero visivel. Por isso todo candidato passa pelo endpoint
// `protocolo_link_editor` (o mesmo que o botao nativo usa). Numero que o SEI nao
// reconhece nao vira link.
(function () {
    'use strict';

    // O content script pode ser reinjetado pelo ciclo de vida do SEI. Repetir a
    // inicialização duplicaria CSS, botões e listeners na mesma página.
    if (document.getElementById('seiAgrEstilos')) return;

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
    var consultasEmAndamento = new Map(); // numero -> Promise<{id, text} | null>

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
        if (consultasEmAndamento.has(numero)) return consultasEmAndamento.get(numero);

        var consulta = fetch(cfg.urlBuscarProtocoloSei, {
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
            .catch(function (e) { console.error('[sei-agr] consulta falhou', numero, e); return null; })
            .then(function (resultado) {
                consultasEmAndamento.delete(numero);
                return resultado;
            });
        consultasEmAndamento.set(numero, consulta);
        return consulta;
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

    // Evita abrir uma conexão por candidato quando a minuta é grande. Seis
    // consultas mantêm a interface responsiva sem sobrecarregar o endpoint SEI.
    function resolverAlvos(alvos, cfg) {
        var respostas = new Array(alvos.length);
        var proximo = 0;
        var trabalhadores = Math.min(6, alvos.length);

        function trabalhar() {
            if (proximo >= alvos.length) return Promise.resolve();
            var indice = proximo++;
            return resolverProtocolo(alvos[indice].num, cfg).then(function (resultado) {
                respostas[indice] = resultado;
                return trabalhar();
            });
        }

        var fila = [];
        for (var i = 0; i < trabalhadores; i++) fila.push(trabalhar());
        return Promise.all(fila).then(function () { return respostas; });
    }

    function linkarTudo(ed) {
        var cfg = cfgSei(ed);
        if (!cfg.urlBuscarProtocoloSei) {
            return aviso('Configuração do editor do SEI indisponível. Recarregue a página.', 'erro');
        }

        var alvos = coletarAlvos(ed);
        if (!alvos.length) return aviso('Nenhum número de processo ou documento no texto.', '', 'Linkar protocolos');
        aviso('Consultando ' + alvos.length + (alvos.length === 1 ? ' número' : ' números') + ' no SEI…',
              '', 'Linkar protocolos');
        sessaoRejeitada = false;

        return resolverAlvos(alvos, cfg)
            .then(function (protocolos) {
                var pares = alvos
                    .map(function (a, i) { return { alvo: a, p: protocolos[i] }; })
                    .filter(function (x) { return x.p; });

                if (!pares.length) {
                    if (sessaoRejeitada) {
                        return aviso('O SEI recusou a consulta. Recarregue a página (F5) e tente de novo.', 'erro');
                    }
                    return aviso(['Nenhum dos ' + alvos.length + ' números existe neste SEI.',
                                  'Tentados: ' + unicos(alvos.map(numDoAlvo)).join(', ')],
                                 'erro', 'Linkar protocolos');
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
                // O painel presta contas dos dois lados: o que foi tentado e o
                // que virou link de fato. Números repetidos no texto contam uma
                // vez só na listagem, mas a contagem de links é a real.
                var n = pares.length;
                var aplicados = unicos(pares.map(function (x) { return x.alvo.num; }));
                var ausentes = unicos(alvos.map(numDoAlvo)).filter(function (num) {
                    return aplicados.indexOf(num) < 0;
                });
                var linhas = [alvos.length + (alvos.length === 1 ? ' número tentado, ' : ' números tentados, ') +
                              n + (n === 1 ? ' link aplicado.' : ' links aplicados.'),
                              'Vinculados: ' + aplicados.join(', ')];
                if (ausentes.length) linhas.push('Sem correspondência no SEI: ' + ausentes.join(', '));
                aviso(linhas, ausentes.length ? '' : 'ok', 'Linkar protocolos');
                return { linksAplicados: n };
            });
    }

    function unicos(lista) {
        return lista.filter(function (v, i) { return lista.indexOf(v) === i; });
    }

    function numDoAlvo(a) { return a.num; }

    function inserirTextoComProtocolos(destino, texto) {
        var padrao = /(\d{5}\.\d{6}\/\d{4}-\d{2}|\d{7,17})/g;
        var msg = String(texto || '');
        var inicio = 0, achado;
        while ((achado = padrao.exec(msg))) {
            destino.appendChild(document.createTextNode(msg.slice(inicio, achado.index)));
            var numero = document.createElement('strong');
            numero.className = 'sei-agr-num';
            numero.textContent = achado[0];
            destino.appendChild(numero);
            inicio = achado.index + achado[0].length;
        }
        destino.appendChild(document.createTextNode(msg.slice(inicio)));
    }

    // ── Área de mensagens do painel ──────────────────────────────────────
    // Toda a conversa da extensão acontece dentro do próprio painel: retorno
    // da linkagem, busca/histórico da importação e as conclusões. Não há mais
    // toast flutuante nem modal sobre a página.
    var TITULO_PADRAO = { ok: 'Concluído', erro: 'Não foi possível', '': 'Em andamento' };

    // corpo: string ou lista de linhas. tipo: 'ok' | 'erro' | '' (neutro).
    function aviso(corpo, tipo, titulo) {
        var caixa = document.createElement('div');
        caixa.className = 'sei-agr-msg ' + (tipo || '');

        var cabecalho = document.createElement('span');
        cabecalho.className = 'sei-agr-msg-titulo';
        cabecalho.textContent = titulo || TITULO_PADRAO[tipo || ''] || 'SEI AGR';
        caixa.appendChild(cabecalho);

        // Texto vindo de API entra só como nó de texto; os números viram
        // <strong> por inserirTextoComProtocolos, nunca por innerHTML.
        (Array.isArray(corpo) ? corpo : [corpo]).forEach(function (linha) {
            var p = document.createElement('span');
            p.className = 'sei-agr-msg-corpo';
            inserirTextoComProtocolos(p, linha);
            caixa.appendChild(p);
        });

        mostrarNaArea(caixa, tipo);
    }

    // Substitui o conteúdo da área e garante o painel aberto — mensagem que
    // ninguém vê não é mensagem. A região viva é a área, que já existe no DOM:
    // um elemento com aria-live criado junto com o texto não é anunciado.
    function mostrarNaArea(no, tipo) {
        area.setAttribute('aria-live', tipo === 'erro' ? 'assertive' : 'polite');
        area.textContent = '';
        area.appendChild(no);
        abrirMenu(false);
    }

    function areaVazia() {
        area.textContent = '';
        var vazio = document.createElement('span');
        vazio.className = 'sei-agr-area-vazia';
        vazio.textContent = 'Área de mensagens';
        area.appendChild(vazio);
    }

    // ── Estado dos botões de ação ────────────────────────────────────────
    // A marca à esquerda do rótulo é o ponto do design; vira spinner enquanto
    // trabalha e check quando conclui.
    function marcar(btn, estado) {
        var marca = btn.querySelector('.sei-agr-marca');
        marca.className = 'sei-agr-marca sei-agr-marca-' + estado;
        marca.innerHTML = estado === 'spin' ? SPINNER_ICONE : estado === 'ok' ? ICONE_CONFIRMADO : '';
    }

    function rotular(btn, texto) {
        btn.querySelector('.sei-agr-rotulo').textContent = texto;
        btn.setAttribute('aria-label', texto);
    }

    var confirmacaoTimer;
    var linkagemEmAndamento = false;

    function confirmarLinkagem(quantidade) {
        clearTimeout(confirmacaoTimer);
        marcar(botao, 'ok');
        rotular(botao, quantidade + (quantidade === 1 ? ' link aplicado' : ' links aplicados'));
        confirmacaoTimer = setTimeout(function () {
            if (botao.disabled) return;
            marcar(botao, 'ponto');
            rotular(botao, 'Linkar protocolos');
        }, 1800);
    }

    function ocupado(sim) {
        if (sim) clearTimeout(confirmacaoTimer);
        linkagemEmAndamento = sim;
        botao.disabled = sim;
        if (botaoImportar) botaoImportar.disabled = sim || importacaoEmAndamento;
        botao.setAttribute('aria-busy', String(sim));
        marcar(botao, sim ? 'spin' : 'ponto');
        rotular(botao, sim ? 'Vinculando…' : 'Linkar protocolos');
    }

    function executar() {
        var ed = editorAtual();
        if (!ed) return aviso('Editor do SEI não encontrado nesta página.', 'erro');
        if (botao.disabled) return;
        ocupado(true);
        Promise.resolve()
            .then(function () { return linkarTudo(ed); })
            .then(function (resultado) {
                ocupado(false);
                if (resultado && resultado.linksAplicados) confirmarLinkagem(resultado.linksAplicados);
            })
            .catch(function (e) {
                ocupado(false);
                console.error('[sei-agr]', e);
                aviso('Não foi possível concluir a linkagem. Recarregue a página e tente novamente.', 'erro');
            });
    }

    // ── CSS ────────────────────────────────────────────────────────────────
    // Identidade SEI AGR, amostrada dos logos oficiais pixel a pixel:
    // o verde #008C59 e o ouro #F9DA2A vêm do brasão da AGR; o selo "sei!"
    // é vazado em branco sobre o verde, com a exclamação em ouro.
    //
    // Todo seletor daqui é prefixado por #seiAgrMenu, e não é preciosismo: o
    // CKEditor do SEI aplica `.ck.ck-reset_all *{background:transparent;border:0;
    // margin:0;padding:0}` a tudo que estiver dentro da toolbar. Isso é (0,2,0)
    // e ATROPELA qualquer seletor de classe simples — o painel perde fundo,
    // borda e espaçamento e desmonta. O id garante (1,x,y) e vence sempre.
    var M = '#seiAgrMenu';
    var B = M + ' button.sei-agr-btn';
    var CSS = [
        // ── Tokens ────────────────────────────────────────────────────────
        // #008C59 e #F9DA2A saem do brasão da AGR. O verde da marca só carrega texto branco a 4.29:1 — abaixo do
        // mínimo — então quem tem texto em cima usa --sa-verde (#007A4E, 5.4:1)
        // e a marca fica nos acentos sem texto. Conferido em contraste.js.
        ':root{--sa-verde:#007A4E;--sa-verde-h:#00663F;--sa-verde-a:#005434;',
        '--sa-verde-txt:#00754A;--sa-marca:#008C59;',
        '--sa-amarelo:#F9DA2A;',
        '--sa-tinta:#1C231E;--sa-texto:#39423C;--sa-mudo:#6E756E;',
        '--sa-borda:#DCDED9;--sa-campo:#858B85;--sa-linha:#ECEEE9;--sa-sup:#FFFFFF;',
        '--sa-suave:#EFF8F3;--sa-suave-h:#E0F1E8;--sa-suave-borda:#C9E2D4;',
        '--sa-erro:#B3261E;--sa-erro-suave:#FDF3F2;--sa-erro-borda:#EBC9C6;',
        '--sa-fonte:Nunito,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',

        // ── Raiz: alinhada à direita da barra de ferramentas ──────────────
        M + '{position:relative;display:inline-flex;align-items:center;align-self:center;',
        'margin:0 4px 0 auto;padding:0;border:0;background:transparent;box-sizing:border-box;',
        'font:600 13px/1.45 var(--sa-fonte);text-align:left;vertical-align:middle}',
        M + ' *{box-sizing:border-box}',

        // ── Selo "sei!" ───────────────────────────────────────────────────
        // Como no design: branco a 16% sobre o verde, "!" em ouro. É um selo
        // vazado dentro do botão, não o logo do SEI reproduzido.
        M + ' .sei-agr-selo{display:inline-flex;align-items:center;justify-content:center;',
        'flex:none;padding:0;border:0;border-radius:6px;background:rgba(255,255,255,.16);',
        'color:#FFF !important;-webkit-text-fill-color:currentColor !important;',
        'font:900 10px/1 var(--sa-fonte);letter-spacing:-.02em}',
        M + ' .sei-agr-selo i{margin-left:.1em;font-style:normal;color:var(--sa-amarelo) !important;',
        '-webkit-text-fill-color:currentColor !important}',

        // ── Gatilho na toolbar ────────────────────────────────────────────
        // Medidas do bloco "Aplicação" do design: selo 22px, gap 8px,
        // padding 9px à esquerda / 14px à direita, raio 9px.
        M + ' button.sei-agr-menu-gatilho{display:inline-flex;align-items:center;gap:8px;',
        'height:32px;min-height:32px;margin:0;padding:0 14px 0 9px;border:0;border-radius:9px;',
        'background:var(--sa-verde);color:#FFF !important;-webkit-text-fill-color:currentColor !important;',
        'font:800 13px/1 var(--sa-fonte);white-space:nowrap;cursor:pointer;',
        'box-shadow:none;transition:background-color .12s ease}',
        M + ' button.sei-agr-menu-gatilho .sei-agr-selo{width:22px;height:22px}',
        // Cor explicita no rotulo: heranca PERDE para `.ck-reset_all *`, que
        // casa direto no span e o pintaria com a cor de texto do editor.
        M + ' .sei-agr-menu-nome{color:#FFF !important;-webkit-text-fill-color:currentColor !important}',
        M + ' button.sei-agr-menu-gatilho:hover{background:var(--sa-verde-h)}',
        M + ' button.sei-agr-menu-gatilho:active{background:var(--sa-verde-a)}',
        M + ' button.sei-agr-menu-gatilho:focus-visible{outline:2px solid var(--sa-tinta);outline-offset:2px}',

        // ── Painel ────────────────────────────────────────────────────────
        M + ' .sei-agr-menu-acoes{display:block;position:absolute;top:calc(100% + 6px);right:0;',
        'z-index:2147483000;width:420px;max-width:calc(100vw - 24px);margin:0;padding:0;overflow:hidden;',
        'background:var(--sa-sup);border:1px solid var(--sa-borda);border-radius:14px;',
        'box-shadow:none;transform-origin:top right;',
        'font:600 13px/1.45 var(--sa-fonte);color:var(--sa-tinta);text-align:left;white-space:normal}',
        // display explicito vence o [hidden] do agente de usuario: sem isto,
        // esconder o painel ou a mensagem da busca nao surtiria efeito.
        M + ' .sei-agr-menu-acoes[hidden],' + M + ' .sei-agr-msg[hidden]{display:none !important}',
        M + '.sei-agr-menu-aberto .sei-agr-menu-acoes{animation:sei-agr-painel-entra .16s cubic-bezier(.16,1,.3,1)}',
        '@keyframes sei-agr-painel-entra{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}',

        M + ' .sei-agr-menu-cab{display:flex;align-items:center;gap:10px;margin:0;padding:14px 16px;',
        'background:var(--sa-verde)}',
        M + ' .sei-agr-menu-cab .sei-agr-selo{width:30px;height:30px;border-radius:8px;font-size:13px}',
        M + ' .sei-agr-menu-cab-nome{display:flex;align-items:baseline;color:#FFF !important;',
        '-webkit-text-fill-color:currentColor !important;font:900 16px/1 var(--sa-fonte)}',
        M + ' .sei-agr-menu-cab-nome i{font-style:normal;color:var(--sa-amarelo) !important;',
        'margin-left:5px;letter-spacing:.1em}',
        M + ' .sei-agr-menu-corpo{display:flex;flex-direction:column;gap:10px;width:100%;min-width:0;',
        'margin:0;padding:16px;max-height:calc(100vh - 160px);overflow-x:hidden;overflow-y:auto;white-space:normal}',

        // ── Ações do painel ───────────────────────────────────────────────
        B + '{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;margin:0;',
        'padding:12px 14px;border:0;border-radius:10px;cursor:pointer;',
        'background:var(--sa-verde);color:#FFF !important;-webkit-text-fill-color:currentColor !important;',
        'font:800 14px/1.2 var(--sa-fonte);text-align:left;white-space:nowrap;',
        'transition:background-color .12s ease}',
        B + ' *{color:inherit !important;-webkit-text-fill-color:currentColor !important}',
        B + ':hover{background:var(--sa-verde-h)}',
        B + ':active{background:var(--sa-verde-a)}',
        B + ':focus-visible{outline:2px solid var(--sa-verde-a);outline-offset:2px}',
        B + '[disabled]{cursor:default;background:var(--sa-verde-h)}',
        B + '.sei-agr-btn-2[disabled]{background:var(--sa-sup);border-color:var(--sa-mudo);',
        'color:var(--sa-mudo) !important}',
        B + ' .sei-agr-rotulo{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}',

        // Secundário (Importar Resolução): contorno, mesma altura de toque.
        B + '.sei-agr-btn-2{padding:10px 12px;border:2px solid var(--sa-verde-txt);',
        'background:var(--sa-sup);color:var(--sa-verde-txt) !important}',
        B + '.sei-agr-btn-2:hover{background:var(--sa-suave)}',
        B + '.sei-agr-btn-2:active{background:var(--sa-suave-h)}',
        B + '.sei-agr-btn-2:focus-visible{outline:2px solid var(--sa-verde-txt);outline-offset:2px}',

        // Marca: ponto do design, spinner enquanto trabalha, check ao concluir.
        B + ' .sei-agr-marca{flex:none;width:6px;height:6px;padding:0;border:0;border-radius:3px;',
        'background:var(--sa-amarelo)}',
        B + '.sei-agr-btn-2 .sei-agr-marca{background:var(--sa-marca)}',
        B + ' .sei-agr-marca-spin,' + B + ' .sei-agr-marca-ok{width:16px;height:16px;border-radius:0;',
        'background:transparent;display:inline-flex;align-items:center;justify-content:center}',
        B + ' .sei-agr-marca svg{flex:none;display:block}',
        M + ' .sei-agr-icone-confirmacao path{stroke-dasharray:18;stroke-dashoffset:18;',
        'animation:sei-agr-traco .32s cubic-bezier(.16,1,.3,1) .06s forwards}',
        M + ' .sei-agr-spinner{animation:sei-agr-spin .7s linear infinite;transform-origin:center}',
        '@keyframes sei-agr-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}',
        '@keyframes sei-agr-traco{to{stroke-dashoffset:0}}',

        // ── Área de mensagens / importação ────────────────────────────────
        M + ' .sei-agr-area{display:flex;flex-direction:column;gap:8px;width:100%;min-width:0;min-height:120px;',
        'margin:4px 0 0;padding:12px 0 0;overflow-x:hidden;border-top:1px solid var(--sa-linha);white-space:normal}',
        M + ' .sei-agr-area-vazia{font:700 12px/1.4 var(--sa-fonte);color:var(--sa-mudo)}',

        M + ' .sei-agr-msg{display:flex;flex-direction:column;gap:4px;width:100%;min-width:0;margin:0;padding:12px 14px;',
        'border:1px solid var(--sa-suave-borda);border-radius:10px;background:var(--sa-suave);',
        'animation:sei-agr-msg-entra .18s ease-out}',
        '@keyframes sei-agr-msg-entra{from{opacity:0}to{opacity:1}}',
        M + ' .sei-agr-msg-titulo{font:800 11px/1.2 var(--sa-fonte);letter-spacing:.12em;',
        'text-transform:uppercase;color:var(--sa-verde-txt) !important}',
        M + ' .sei-agr-msg-corpo{min-width:0;font:600 13px/1.45 var(--sa-fonte);color:var(--sa-texto) !important;',
        'white-space:normal;overflow-wrap:anywhere;word-break:normal}',
        M + ' .sei-agr-msg.erro{background:var(--sa-erro-suave);border-color:var(--sa-erro-borda)}',
        M + ' .sei-agr-msg.erro .sei-agr-msg-titulo{color:var(--sa-erro) !important}',
        M + ' .sei-agr-msg a{color:var(--sa-verde) !important;font-weight:800;text-decoration:underline}',
        M + ' .sei-agr-num{font-weight:800;font-variant-numeric:tabular-nums;color:var(--sa-tinta) !important}',

        // Busca e histórico da importação vivem na mesma área.
        M + ' .sei-agr-busca{display:flex;flex-direction:column;gap:6px;width:100%;min-width:0;margin:0;padding:0;white-space:normal}',
        M + ' .sei-agr-busca input{width:100%;height:38px;margin:0;padding:0 12px;',
        'border:1px solid var(--sa-campo);border-radius:10px;background:var(--sa-sup);',
        'font:700 13px/1 var(--sa-fonte);color:var(--sa-tinta) !important;',
        '-webkit-text-fill-color:currentColor !important;font-variant-numeric:tabular-nums}',
        M + ' .sei-agr-busca input:focus{outline:2px solid var(--sa-verde-txt);outline-offset:1px;',
        'border-color:var(--sa-verde-txt)}',
        M + ' .sei-agr-busca input::placeholder{color:var(--sa-mudo);opacity:1;font-weight:600}',
        M + ' .sei-agr-busca-ajuda{min-width:0;margin:0;padding:0;font:600 11px/1.4 var(--sa-fonte);',
        'color:var(--sa-mudo);white-space:normal;overflow-wrap:anywhere}',
        M + ' .sei-agr-lista{display:flex;flex-direction:column;gap:2px;width:100%;min-width:0;max-height:200px;',
        'overflow-x:hidden;overflow-y:auto;margin:0;padding:0;list-style:none;white-space:normal}',
        M + ' .sei-agr-lista li{margin:0;padding:0;list-style:none}',
        M + ' .sei-agr-lista li::marker{content:""}',
        M + ' button.sei-agr-item{display:block;width:100%;min-width:0;max-width:100%;min-height:44px;margin:0;padding:8px 10px;',
        'border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer;',
        'font:600 13px/1.35 var(--sa-fonte);color:var(--sa-tinta) !important;',
        '-webkit-text-fill-color:currentColor !important}',
        M + ' button.sei-agr-item:hover{background:var(--sa-suave)}',
        M + ' button.sei-agr-item:focus-visible{background:var(--sa-suave);',
        'outline:2px solid var(--sa-verde-txt);outline-offset:-2px}',
        // Sem isto o `b` e o `span` recebem a cor do editor direto do reset.
        M + ' button.sei-agr-item *{color:inherit !important;-webkit-text-fill-color:currentColor !important}',
        M + ' button.sei-agr-item b{display:block;max-width:100%;font:800 13px/1.3 var(--sa-fonte);',
        'font-variant-numeric:tabular-nums}',
        M + ' button.sei-agr-item span{display:block;max-width:100%;margin-top:2px;font:600 11.5px/1.3 var(--sa-fonte);',
        'color:var(--sa-mudo) !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',

        // ── Fallback: toolbar não encontrada ──────────────────────────────
        '#seiAgrAcoesFlutuantes{position:fixed;z-index:2147483000;',
        'right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom))}',
        M + '.sei-agr-menu-solto{margin:0}',
        M + '.sei-agr-menu-solto .sei-agr-menu-acoes{top:auto;bottom:calc(100% + 6px);',
        'transform-origin:bottom right}',

        // ── Telas estreitas ───────────────────────────────────────────────
        '@media (max-width:600px){',
        M + ' .sei-agr-menu-acoes{width:min(420px,calc(100vw - 24px))}',
        M + ' button.sei-agr-menu-gatilho{position:relative;justify-content:center;width:44px;height:44px;',
        'min-height:44px;padding:0;background:transparent}',
        M + ' button.sei-agr-menu-gatilho:hover,' + M + ' button.sei-agr-menu-gatilho:active{background:transparent}',
        M + ' button.sei-agr-menu-gatilho::before{content:"";position:absolute;inset:6px;z-index:0;',
        'border-radius:9px;background:var(--sa-verde)}',
        M + ' button.sei-agr-menu-gatilho:hover::before{background:var(--sa-verde-h)}',
        M + ' button.sei-agr-menu-gatilho:active::before{background:var(--sa-verde-a)}',
        M + ' button.sei-agr-menu-gatilho .sei-agr-selo{position:relative;z-index:1}',
        M + ' .sei-agr-menu-nome{display:none}',
        M + ' .sei-agr-busca input{height:44px;font-size:16px}',
        '}',

        '@media (prefers-reduced-motion:reduce){',
        M + ' .sei-agr-menu-acoes,' + M + ' .sei-agr-msg,' + M + ' .sei-agr-spinner,',
        M + ' .sei-agr-icone-confirmacao path,' + B + ',' + M + ' button.sei-agr-menu-gatilho',
        '{animation:none !important;transition:none !important}}',
    ].join('');
    var estilo = document.createElement('style');
    estilo.id = 'seiAgrEstilos';
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    // Confirma a escrita dos vínculos no lugar da marca do botão.
    var ICONE_CONFIRMADO = '<svg class="sei-agr-icone-confirmacao" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M5.5 12.5l4.1 4.1 8.9-9"/></svg>';

    // ── Spinner circular fluido ──────────────────────────────────────────
    var SPINNER_ICONE = '<svg class="sei-agr-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-opacity=".22" stroke-width="2.5"/>' +
        '<path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
        '</svg>';

    var SELO = '<span class="sei-agr-selo" aria-hidden="true">sei<i>!</i></span>';

    function criarAcao(classe, rotulo, titulo) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sei-agr-btn ' + classe;
        b.innerHTML = '<span class="sei-agr-marca sei-agr-marca-ponto" aria-hidden="true"></span>' +
                      '<span class="sei-agr-rotulo"></span>';
        b.querySelector('.sei-agr-rotulo').textContent = rotulo;
        b.setAttribute('aria-label', rotulo);
        b.title = titulo;
        return b;
    }

    var botao = criarAcao('sei-agr-btn-1', 'Linkar protocolos',
        'Vincula números de processo e documento como links do SEI · Ctrl+Shift+K');
    // O painel continua aberto: é nele que a mensagem de retorno aparece.
    botao.onclick = executar;

    var botaoMenu = document.createElement('button');
    botaoMenu.type = 'button';
    botaoMenu.className = 'sei-agr-menu-gatilho';
    botaoMenu.innerHTML = SELO + '<span class="sei-agr-menu-nome">SEI AGR</span>';
    botaoMenu.setAttribute('aria-expanded', 'false');
    botaoMenu.setAttribute('aria-controls', 'seiAgrMenuAcoes');
    botaoMenu.setAttribute('aria-label', 'Ações SEI AGR');
    botaoMenu.title = 'Ações SEI AGR';

    var menu = document.createElement('div');
    menu.id = 'seiAgrMenu';
    menu.className = 'sei-agr-menu';

    var menuAcoes = document.createElement('div');
    menuAcoes.id = 'seiAgrMenuAcoes';
    menuAcoes.className = 'sei-agr-menu-acoes';
    menuAcoes.setAttribute('role', 'region');
    menuAcoes.setAttribute('aria-label', 'SEI AGR');
    menuAcoes.hidden = true;
    menuAcoes.innerHTML =
        '<div class="sei-agr-menu-cab">' + SELO +
        '<span class="sei-agr-menu-cab-nome">SEI<i>AGR</i></span></div>' +
        '<div class="sei-agr-menu-corpo"></div>';

    var corpoMenu = menuAcoes.querySelector('.sei-agr-menu-corpo');
    // Área única: mensagens da linkagem, busca/histórico da importação e as
    // conclusões, todas no mesmo lugar do painel.
    var area = document.createElement('div');
    area.className = 'sei-agr-area';
    // Sem role="status": ele implica aria-atomic e faria o leitor reler a busca
    // inteira a cada tecla. Só aria-live, anunciando o que de fato mudou.
    area.setAttribute('aria-live', 'polite');

    menu.appendChild(botaoMenu);
    menu.appendChild(menuAcoes);

    function abrirMenu(focarPrimeiro) {
        menuAcoes.hidden = false;
        menu.classList.add('sei-agr-menu-aberto');
        botaoMenu.setAttribute('aria-expanded', 'true');
        if (focarPrimeiro) botao.focus();
    }

    function fecharMenu(devolverFoco) {
        menu.classList.remove('sei-agr-menu-aberto');
        menuAcoes.hidden = true;
        botaoMenu.setAttribute('aria-expanded', 'false');
        if (devolverFoco) botaoMenu.focus();
    }

    botaoMenu.onclick = function () {
        if (menuAcoes.hidden) abrirMenu(false);
        else fecharMenu(false);
    };
    botaoMenu.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            abrirMenu(true);
        } else if (e.key === 'Escape') {
            fecharMenu(false);
        }
    });
    menuAcoes.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        fecharMenu(true);
    });
    document.addEventListener('pointerdown', function (e) {
        if (!menuAcoes.hidden && !menu.contains(e.target)) fecharMenu(false);
    }, true);

    function painelFlutuante() {
        var painel = document.getElementById('seiAgrAcoesFlutuantes');
        if (painel) return painel;
        painel = document.createElement('div');
        painel.id = 'seiAgrAcoesFlutuantes';
        painel.setAttribute('role', 'group');
        painel.setAttribute('aria-label', 'Ações da extensão SEI AGR');
        document.body.appendChild(painel);
        return painel;
    }

    // A extensão entra como um único comando do editor; as ações vivem no menu.
    var tentativas = 0;
    (function encaixar() {
        var toolbar = document.querySelector('.ck-toolbar__items') || document.querySelector('.ck-toolbar');
        if (toolbar) return toolbar.appendChild(menu);
        if (++tentativas > 40) { // ~20s
            menu.classList.add('sei-agr-menu-solto');
            return painelFlutuante().appendChild(menu);
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
    // Busca a minuta no Gestao de Autos IA (ia-regulatoria.duckdns.org) e cola
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
    // O documento do SEI 5 e multi-root: cada bloco do modelo (titulo, ementa,
    // corpo, artigos, assinatura) e um root separado. A ordem de getRootNames()
    // e a de registro, nao a visual -- por isso a ordenacao sai da posicao real
    // no DOM.
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
                    estilo: estiloDoCorpo(paragrafosDoRoot(ed, nome)),
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

    // Os paragrafos do root como blocos.js os espera: [{ estilo, texto }].
    // So paragraph -- tabela e imagem nao entram na conta do texto corrido.
    function paragrafosDoRoot(ed, nome) {
        try {
            return [...ed.model.document.getRoot(nome).getChildren()].map(function (p) {
                if (!p.is('element', 'paragraph')) return { estilo: null, texto: '' };
                var t = '';
                for (const n of p.getChildren()) t += (n.data || '');
                return { estilo: p.getAttribute('estilo') || null, texto: t };
            });
        } catch (e) { return []; }
    }

    // Limpa a cauda do bloco depois da colagem, na ordem que importa:
    //
    //   1. a linha '[Nome do (a) usuário (a)]' que o modelo deixa -- e marcador
    //      do modelo, nao conteudo, ja que quem assina no SEI e a acao Assinar;
    //   2. os paragrafos vazios que sobram no fim, que sem a assinatura viram
    //      espaco solto no fim do documento.
    //
    // Nessa ordem porque a assinatura fica ENTRE os vazios: tirando ela
    // primeiro, os tres vazios do bloco de artigos ficam contiguos no fim e
    // saem juntos. De tras pra frente nos dois, para os indices dos paragrafos
    // anteriores continuarem validos depois de cada remocao.
    function limparCauda(ed, w, nome) {
        var root = ed.model.document.getRoot(nome);
        var paras = paragrafosDoRoot(ed, nome);
        for (var i = paras.length - 1; i >= 0; i--) {
            if (ehAssinaturaModelo(paras[i].texto)) w.remove(root.getChild(i));
        }
        vaziosDoFim(paragrafosDoRoot(ed, nome)).forEach(function (i) {
            w.remove(root.getChild(i));
        });
    }

    // Ate onde a substituicao pode ir. estiloDoCorpo/ultimoDoCorpo vem de
    // blocos.js (puros, testados com os paragrafos reais do modelo).
    function alcanceDoCorpo(ed, nome, estilo) {
        var root = ed.model.document.getRoot(nome);
        var ultimo = ultimoDoCorpo(paragrafosDoRoot(ed, nome), estilo);
        if (ultimo < 0) return ed.model.createRangeIn(root);
        return ed.model.createRange(
            ed.model.createPositionAt(root, 0),
            ed.model.createPositionAt(root, ultimo + 1));
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
        ed.model.change(function (w) {
            itens.forEach(function (it, i) {
                // insertContent apaga o que esta no range antes de inserir,
                // entao isto SUBSTITUI o bloco em vez de acrescentar -- e o que
                // faz reimportar nao empilhar. O range para no ultimo paragrafo
                // do texto corrido: o que vem depois nao e substituido em
                // bloco -- limparCauda tira so a assinatura do modelo e os
                // vazios do fim.
                ed.model.insertContent(frags[i],
                    alcanceDoCorpo(ed, it.bloco.nome, it.bloco.estilo));
                limparCauda(ed, w, it.bloco.nome);
            });
        });

        return itens
            .filter(function (it, i) { return ed.getData({ rootName: it.bloco.nome }) === antes[i]; })
            .map(function (it) { return it.nome; });
    }

    var importacaoEmAndamento = false;

    function ocupadoImportacao(sim) {
        importacaoEmAndamento = sim;
        botaoImportar.disabled = sim;
        botao.disabled = sim || linkagemEmAndamento;
        botaoImportar.setAttribute('aria-busy', String(sim));
        marcar(botaoImportar, sim ? 'spin' : 'ponto');
        rotular(botaoImportar, sim ? 'Importando…' : 'Importar Resolução');
    }

    function importar(numero) {
        if (importacaoEmAndamento) return;
        var ed = editorAtual();
        if (!ed) return aviso('Editor do SEI não encontrado nesta página.', 'erro');

        var blocos = blocosResolucao(ed);
        if (!blocos) {
            console.warn('[sei-agr] roots desta página:', rootsEmOrdem(ed));
            return aviso('Este documento não parece ser uma Resolução: não encontrei os ' +
                         'blocos de ementa, corpo e artigos. Veja o console (F12) para os ' +
                         'blocos que a extensão enxergou.', 'erro');
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

        ocupadoImportacao(true);
        aviso('Buscando a minuta do processo ' + numero + '…', '', 'Importar Resolução');
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
            var linhas = [
                'Processo ' + numero + ': ' + (itens.length - falhou.length) + ' de ' + itens.length +
                ' blocos preenchidos.',
                'Revise e use "Linkar protocolos" para os números. Ctrl+Z desfaz a importação inteira.',
            ];
            if (falhou.length) linhas.unshift('Não colou: ' + falhou.join(', ') + '.');
            aviso(linhas, falhou.length ? 'erro' : 'ok', 'Importar Resolução');
        }).catch(function (e) {
            console.error('[sei-agr] importação falhou', e);
            aviso('Não foi possível importar a minuta. Tente novamente.', 'erro');
        }).then(function (resultado) {
            ocupadoImportacao(false);
            return resultado;
        });
    }

    // O processo deste documento, para a busca já vir preenchida.
    // A extração é de detectar.js (pura, testada em test-deteccao.js).
    var processoDaPaginaCache;
    var processoDaPaginaCalculado = false;
    function processoDaPagina() {
        if (processoDaPaginaCalculado) return processoDaPaginaCache;
        processoDaPaginaCalculado = true;
        try { processoDaPaginaCache = processoDeReferencia(document.body.innerText || ''); }
        catch (e) { processoDaPaginaCache = ''; }
        return processoDaPaginaCache;
    }

    // ── Vista de importação, dentro da própria área do painel ────────────
    // Busca, histórico e conclusão no mesmo lugar das mensagens de linkagem:
    // sem overlay, sem foco preso, sem segunda janela sobre o editor.
    var buscaTimer;
    var consultaAtual = 0;

    function vistaImportar() {
        clearTimeout(buscaTimer);
        area.textContent = '';

        var busca = document.createElement('div');
        busca.className = 'sei-agr-busca';
        busca.innerHTML =
            '<input type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="32" ' +
            'placeholder="Número do processo" aria-label="Número do processo" aria-describedby="seiAgrBuscaAjuda">' +
            '<p class="sei-agr-busca-ajuda" id="seiAgrBuscaAjuda">Digite para buscar ou informe o número ' +
            'completo e pressione Enter.</p>';

        var lista = document.createElement('ul');
        lista.className = 'sei-agr-lista';

        var msg = document.createElement('div');
        msg.className = 'sei-agr-msg';

        area.appendChild(busca);
        area.appendChild(lista);
        area.appendChild(msg);

        var input = busca.querySelector('input');

        // Mesma caixa de mensagem do resto do painel; devolve o nó de corpo
        // para quem precisar acrescentar um link.
        function dizer(texto, tipo) {
            msg.className = 'sei-agr-msg ' + (tipo || '');
            area.setAttribute('aria-live', tipo === 'erro' ? 'assertive' : 'polite');
            msg.textContent = '';
            var titulo = document.createElement('span');
            titulo.className = 'sei-agr-msg-titulo';
            titulo.textContent = 'Importar Resolução';
            var corpo = document.createElement('span');
            corpo.className = 'sei-agr-msg-corpo';
            corpo.textContent = String(texto || '');
            msg.appendChild(titulo);
            msg.appendChild(corpo);
            msg.hidden = false;
            return corpo;
        }

        function dizerSemSessao(loginUrl) {
            var corpo = dizer('Sem sessão no Gestão de Autos IA. ', 'erro');
            var url;
            try { url = new URL(loginUrl, location.href); } catch (e) { url = null; }
            if (url && (url.protocol === 'https:' ||
                (url.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/i.test(url.hostname)))) {
                var link = document.createElement('a');
                link.href = url.href;
                link.target = '_blank';
                link.rel = 'noopener';
                link.textContent = 'Entrar no sistema';
                corpo.appendChild(link);
                corpo.appendChild(document.createTextNode(', depois tente de novo.'));
            } else {
                corpo.appendChild(document.createTextNode('Entre no sistema e tente de novo.'));
            }
        }

        function calar() { msg.hidden = true; }

        function render(itens) {
            lista.textContent = '';
            if (!itens.length) return dizer('Nenhum processo encontrado.');
            calar();
            var fragmento = document.createDocumentFragment();
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
                b.onclick = function () { importar(num); };
                li.appendChild(b);
                fragmento.appendChild(li);
            });
            lista.appendChild(fragmento);
        }

        function carregar(acaoApi, arg) {
            var consulta = ++consultaAtual;
            lista.textContent = '';
            dizer('Buscando…');
            api(acaoApi, arg).then(function (r) {
                // A área pode ter virado mensagem de conclusão no meio da
                // consulta: só escreve se esta vista ainda estiver em tela.
                if (consulta !== consultaAtual || !area.contains(lista)) return;
                if (!r.ok) {
                    if (r.semSessao) return dizerSemSessao(r.loginUrl);
                    return dizer(r.erro || 'Falha na consulta.', 'erro');
                }
                render(Array.isArray(r.dados) ? r.dados : []);
            }).catch(function () {
                if (consulta === consultaAtual && area.contains(lista)) {
                    dizer('Não foi possível concluir a consulta. Tente novamente.', 'erro');
                }
            });
        }

        // Enter com um número de processo completo importa direto, sem lista:
        // é o caminho de quem já sabe o número.
        input.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            var v = input.value.replace(/\D/g, '');
            if (v.length < 15) {
                return dizer('Informe um número de processo com pelo menos 15 dígitos.', 'erro');
            }
            importar(v);
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

    // ── Montagem do painel ───────────────────────────────────────────────
    var botaoImportar = criarAcao('sei-agr-btn-2', 'Importar Resolução',
        'Cola a minuta gerada pelo Gestão de Autos IA nos blocos da Resolução');
    botaoImportar.onclick = function () {
        abrirMenu(false);
        vistaImportar();
    };

    corpoMenu.appendChild(botao);
    corpoMenu.appendChild(botaoImportar);
    corpoMenu.appendChild(area);
    areaVazia();

    console.log('[sei-agr] carregado - Ctrl+Shift+K ou botão SEI AGR na toolbar');
})();
