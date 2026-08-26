// Diagnostico do modelo de RESOLUCAO — estrutura + mapeamento + colagem.
//
// O modelo do SEI mudou: nao existe mais o bloco 'RESOLVE:' que servia de
// divisor. Pela imagem, os blocos editaveis sao, em ordem:
//   0 titulo ("RESOLUCAO AGR Nº 1, DE ...")
//   1 EMENTA          ("Elaborar o Texto, ...")
//   2 CORPO           ("Considerando, ..., resolve:")
//   3 ARTIGOS         ("CAPITULO I / Secao I / Art.1º ... / DISPOSICOES FINAIS")
//
// Este script (a) despeja a estrutura real, (b) aplica o mapeamento NOVO, sem
// divisor, e diz quais roots escolheu, (c) testa a insercao nos tres e desfaz.
//
// Como usar: editor do SEI com a Resolucao aberta, F12 -> Console, cole e Enter.
// Nao destrutivo: desfaz no fim e confere que voltou ao original.
(() => {
    const els = [...document.querySelectorAll('.ck-editor__editable, .ck-content')];
    const ed = els.map((e) => e.ckeditorInstance).find(Boolean);
    if (!ed) return console.log('instancia do CKEditor nao encontrada');
    window.__ed = ed;

    const out = { versao: window.CKEDITOR_VERSION || '?' };
    // As imagens do timbre sao data:base64 de dezenas de KB: fora daqui.
    const limpar = (s) => String(s || '')
        .replace(/src="data:[^"]*"/g, 'src="data:…"')
        .replace(/\s+/g, ' ').trim();

    // ── (a) Estrutura real, em ordem visual ───────────────────────────────
    const roots = ed.model.document.getRootNames()
        .map((nome) => {
            const el = ed.ui.getEditableElement(nome);
            if (!el) return null;
            const root = ed.model.document.getRoot(nome);
            return {
                nome, el, root,
                editavel: el.getAttribute('contenteditable') === 'true',
                classe: el.className || '',
                texto: (el.innerText || '').replace(/​/g, '').replace(/\s+/g, ' ').trim(),
                estilo: root.getChild(0) && root.getChild(0).getAttribute('estilo'),
                paragrafos: [...root.getChildren()].map((c) => ({
                    tipo: c.name,
                    estilo: c.getAttribute('estilo') || null,
                    texto: limpar(c.is('element')
                        ? [...c.getChildren()].map((n) => n.data || `<${n.name}>`).join('')
                        : '').slice(0, 100),
                })),
            };
        })
        .filter(Boolean)
        .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

    const editaveis = roots.filter((r) => r.editavel);

    out.estrutura = roots.map((r, i) => ({
        i, root: r.nome, editavel: r.editavel,
        estilo: r.estilo,
        // So as classes que identificam algo; o resto e ruido do CKEditor.
        marcas: (r.classe.match(/infra-[\w-]+/g) || []).join(' '),
        texto: r.texto.slice(0, 130),
        paragrafos: r.paragrafos,
    }));
    out.tem_bloco_resolve = roots.some((r) => /^resolve\s*:?$/i.test(r.texto));
    out.indice_dos_editaveis = editaveis.map((r, i) => `${i}=${r.nome}`).join('  ');

    // ── (b) Mapeamento NOVO, sem depender do 'RESOLVE:' ───────────────────
    // Artigos: a secao principal que o SEI marca; reserva, o 4o editavel.
    // Ementa:  o estilo proprio do modelo;        reserva, o 2o editavel.
    // Corpo:   o editavel logo antes dos artigos.
    const artigos = editaveis.find((r) => r.classe.includes('infra-editor__secao-principal'))
        || editaveis[3];
    const ementa = editaveis.find((r) => r.estilo === 'Texto_Ementa') || editaveis[1];
    const iArt = editaveis.indexOf(artigos);
    const corpo = iArt > 0 ? editaveis[iArt - 1] : undefined;

    out.mapeamento = {
        ementa: ementa && ementa.nome,
        corpo: corpo && corpo.nome,
        artigos: artigos && artigos.nome,
        por_estilo_Texto_Ementa: !!editaveis.find((r) => r.estilo === 'Texto_Ementa'),
        por_classe_secao_principal: !!editaveis.find((r) => r.classe.includes('infra-editor__secao-principal')),
        ordem_coerente: !!(ementa && corpo && artigos)
            && editaveis.indexOf(ementa) < editaveis.indexOf(corpo)
            && editaveis.indexOf(corpo) < iArt,
    };

    if (!out.mapeamento.ordem_coerente) {
        console.log(JSON.stringify(out, null, 2));
        try { copy(JSON.stringify(out, null, 2)); } catch (e) {}
        return console.log('>>> mapeamento incoerente: NAO testei colagem. Copiado.');
    }

    // ── (c) Insercao nos tres, como a extensao faz ────────────────────────
    const itens = [
        { nome: 'ementa', bloco: ementa, html: '<p>SEIAGR_EMENTA Dispõe sobre o <b>Auto de Infração nº 43042</b> (55766343).</p>' },
        { nome: 'corpo', bloco: corpo, html: '<p>SEIAGR_CORPO_1 O Conselho Regulador da AGR;</p><p>SEIAGR_CORPO_2 A notificada interpôs recurso, resolve:</p>' },
        { nome: 'artigos', bloco: artigos, html: '<p>SEIAGR_ART_1 Art. 1º. <b>Ratificar</b> a decisão.</p><p>SEIAGR_ART_2 Art. 2º. Entra em vigor.</p>' },
    ];
    const comEstilo = (h, e) => (e ? h.split('<p>').join(`<p class="${e}">`) : h);
    const original = {};
    roots.forEach((r) => { original[r.nome] = ed.getData({ rootName: r.nome }); });

    // Estilo do texto corrido = o do paragrafo MAIS LONGO, nao o do primeiro.
    // No bloco de artigos o primeiro e 'CAPÍTULO I' (centralizado).
    const estiloCorpo = (r) => {
        let melhor, maior = -1;
        r.paragrafos.forEach((p) => { if (p.texto.length > maior) { maior = p.texto.length; melhor = p; } });
        return melhor && melhor.estilo;
    };
    // Alcance = ate o ultimo paragrafo com esse estilo. Depois dele mora a
    // assinatura ('[Nome do (a) usuário (a)]'), que nao pode ser apagada.
    const alcance = (r, est) => {
        let ultimo = -1;
        r.paragrafos.forEach((p, i) => { if (p.estilo === est) ultimo = i; });
        const root = ed.model.document.getRoot(r.nome);
        return ultimo < 0 ? ed.model.createRangeIn(root)
            : ed.model.createRange(ed.model.createPositionAt(root, 0),
                                   ed.model.createPositionAt(root, ultimo + 1));
    };
    itens.forEach((it) => { it.estilo = estiloCorpo(it.bloco); });
    out.estilo_do_corpo = itens.map((it) => ({
        bloco: it.nome,
        primeiro_paragrafo: it.bloco.paragrafos[0] && it.bloco.paragrafos[0].estilo,
        mais_longo: it.estilo,
        difere: (it.bloco.paragrafos[0] || {}).estilo !== it.estilo,
    }));

    try {
        const frags = itens.map((it) => ed.data.toModel(
            ed.data.processor.toView(comEstilo(it.html, it.estilo)), '$clipboardHolder'));
        ed.model.change(() => {
            itens.forEach((it, i) => {
                ed.model.insertContent(frags[i], alcance(it.bloco, it.estilo));
            });
        });
    } catch (e) {
        out.erro_insercao = e.message;
        console.log(JSON.stringify(out, null, 2));
        return;
    }

    const marcas = { ementa: 'SEIAGR_EMENTA', corpo: 'SEIAGR_CORPO_1', artigos: 'SEIAGR_ART_1' };
    out.colagem = {};
    itens.forEach((it) => {
        out.colagem[it.nome] = {
            root: it.bloco.nome,
            recebeu: ed.getData({ rootName: it.bloco.nome }).includes(marcas[it.nome]),
            vazou_para: roots.filter((r) => r.nome !== it.bloco.nome)
                .filter((r) => ed.getData({ rootName: r.nome }).includes(marcas[it.nome]))
                .map((r) => r.nome),
            estilo_esperado: it.estilo,
            estilo_obtido: [...ed.model.document.getRoot(it.bloco.nome).getChildren()]
                .map((p) => p.getAttribute('estilo') || '(sem estilo)'),
        };
    });
    // O que vinha DEPOIS do texto corrido tem que continuar la. No modelo novo
    // a assinatura mora dentro do root dos artigos.
    out.cauda_preservada = itens.map((it) => {
        const cauda = it.bloco.paragrafos
            .slice(it.bloco.paragrafos.map((p) => p.estilo).lastIndexOf(it.estilo) + 1)
            .map((p) => p.texto).filter(Boolean);
        const agora = ed.getData({ rootName: it.bloco.nome });
        return { bloco: it.nome, cauda, sobreviveu: cauda.every((t) => agora.includes(t)) };
    });
    out.roots_intocados_mudaram = roots
        .filter((r) => !itens.some((it) => it.bloco.nome === r.nome))
        .filter((r) => ed.getData({ rootName: r.nome }) !== original[r.nome])
        .map((r) => r.nome);

    try { ed.execute('undo'); } catch (e) { out.erro_undo = e.message; }
    setTimeout(() => {
        out.um_undo_desfez_tudo = roots.every((r) => ed.getData({ rootName: r.nome }) === original[r.nome]);
        if (!out.um_undo_desfez_tudo) {
            for (let i = 0; i < 4 && !roots.every((r) => ed.getData({ rootName: r.nome }) === original[r.nome]); i++) {
                try { ed.execute('undo'); } catch (e) { break; }
            }
            out.voltou_com_undos_extras = roots.every((r) => ed.getData({ rootName: r.nome }) === original[r.nome]);
        }
        const txt = JSON.stringify(out, null, 2);
        console.log(txt);
        try { copy(txt); console.log('>>> copiado para o clipboard'); } catch (e) {}
    }, 400);
})();
