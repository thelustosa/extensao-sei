// Valida a colagem nos TRES blocos, exatamente como a extensao faz agora:
// converte o HTML pelo upcast do editor e insere com `insertContent` passando o
// range de cada root. Nao dispara evento de colagem -- foi justamente o que
// fazia as tres cairem todas no root da secao principal, duplicadas.
//
// Confirma, sem depender da API:
//   1. cada bloco recebe o SEU conteudo (ementa/considerandos/artigos separados);
//   2. o estilo de cada paragrafo e o do bloco de destino;
//   3. substitui em vez de acrescentar (reimportar nao empilha);
//   4. UM Ctrl+Z desfaz a importacao inteira.
//
// Como usar: editor do SEI com a Resolucao aberta, F12 -> Console, cole e Enter.
// Nao destrutivo: desfaz no fim e confere que voltou ao original.
(() => {
    const els = [...document.querySelectorAll('.ck-editor__editable, .ck-content')];
    const ed = els.map((e) => e.ckeditorInstance).find(Boolean);
    if (!ed) return console.log('instancia do CKEditor nao encontrada');
    window.__ed = ed;

    const out = {};

    // ── Mapeia os blocos como blocos.js mapeia ────────────────────────────
    const roots = ed.model.document.getRootNames()
        .map((nome) => {
            const el = ed.ui.getEditableElement(nome);
            if (!el) return null;
            const p0 = ed.model.document.getRoot(nome).getChild(0);
            return {
                nome, el,
                editavel: el.getAttribute('contenteditable') === 'true',
                classe: el.className || '',
                texto: (el.innerText || '').replace(/​/g, '').replace(/\s+/g, ' ').trim(),
                estilo: p0 && p0.getAttribute('estilo'),
            };
        })
        .filter(Boolean)
        .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

    const iResolve = roots.findIndex((r) => /^resolve\s*:?$/i.test(r.texto));
    if (iResolve < 0) return console.log('bloco RESOLVE: nao encontrado — nao e uma Resolucao');
    const antesR = roots.slice(0, iResolve).filter((r) => r.editavel);
    const depoisR = roots.slice(iResolve + 1).filter((r) => r.editavel);

    const considerandos = antesR[antesR.length - 1];
    const ementa = antesR.find((r) => r.estilo === 'Texto_Ementa') || antesR[antesR.length - 2];
    const artigos = depoisR.find((r) => r.classe.includes('infra-editor__secao-principal')) || depoisR[0];
    if (!ementa || !considerandos || !artigos) return console.log('blocos incompletos');

    out.mapeamento = {
        ementa: ementa.nome, considerandos: considerandos.nome, artigos: artigos.nome,
        resolve_divisor: roots[iResolve].nome,
    };

    // ── O que a API devolve, na forma real: <p> pelado ────────────────────
    const itens = [
        { nome: 'ementa', bloco: ementa, html: '<p>SEIAGR_EMENTA Dispõe sobre o <b>Auto de Infração nº 43042</b> (55766343).</p>' },
        { nome: 'considerandos', bloco: considerandos, html: '<p>SEIAGR_CONSID_1 O Conselho Regulador da AGR;</p><p>SEIAGR_CONSID_2 A notificada interpôs recurso</p>' },
        { nome: 'artigos', bloco: artigos, html: '<p>SEIAGR_ART_1 Art. 1º. <b>Ratificar</b> a decisão.</p><p>SEIAGR_ART_2 Art. 2º. Entra em vigor.</p>' },
    ];

    const comEstilo = (html, estilo) =>
        estilo ? html.split('<p>').join(`<p class="${estilo}">`) : html;
    const estilos = (nome) => [...ed.model.document.getRoot(nome).getChildren()]
        .map((p) => p.getAttribute('estilo') || '(sem estilo)');

    const original = {};
    roots.forEach((r) => { original[r.nome] = ed.getData({ rootName: r.nome }); });

    try {
        const frags = itens.map((it) => ed.data.toModel(
            ed.data.processor.toView(comEstilo(it.html, it.bloco.estilo)), '$clipboardHolder'));

        ed.model.change(() => {
            itens.forEach((it, i) => {
                const root = ed.model.document.getRoot(it.bloco.nome);
                ed.model.insertContent(frags[i], ed.model.createRangeIn(root));
            });
        });
    } catch (e) {
        out.erro_insercao = e.message;
        console.log(JSON.stringify(out, null, 2));
        return;
    }

    // (1) cada marcador tem que estar SO no seu bloco.
    out.cada_bloco_recebeu_o_seu = {};
    const marcas = { ementa: 'SEIAGR_EMENTA', considerandos: 'SEIAGR_CONSID_1', artigos: 'SEIAGR_ART_1' };
    itens.forEach((it) => {
        const meu = ed.getData({ rootName: it.bloco.nome });
        const vazouPara = roots
            .filter((r) => r.nome !== it.bloco.nome)
            .filter((r) => ed.getData({ rootName: r.nome }).includes(marcas[it.nome]))
            .map((r) => r.nome);
        out.cada_bloco_recebeu_o_seu[it.nome] = {
            root: it.bloco.nome,
            recebeu: meu.includes(marcas[it.nome]),
            vazou_para: vazouPara,
        };
    });

    // (2) estilo por paragrafo, e (3) nada do placeholder sobrou.
    out.estilos = {};
    out.substituiu_em_vez_de_acrescentar = {};
    itens.forEach((it) => {
        out.estilos[it.nome] = { esperado: it.bloco.estilo, obtido: estilos(it.bloco.nome) };
        const agora = ed.getData({ rootName: it.bloco.nome });
        out.substituiu_em_vez_de_acrescentar[it.nome] =
            !agora.includes('Elaborar o Texto') && !/Considerando,\s*Considerando/.test(agora);
    });

    // Os roots que NAO eram destino nao podem ter mudado (titulo, data, rodape).
    out.roots_intocados_mudaram = roots
        .filter((r) => !itens.some((it) => it.bloco.nome === r.nome))
        .filter((r) => ed.getData({ rootName: r.nome }) !== original[r.nome])
        .map((r) => r.nome);

    // (4) um unico undo.
    try { ed.execute('undo'); } catch (e) { out.erro_undo = e.message; }
    setTimeout(() => {
        out.um_undo_desfez_tudo = roots.every((r) => ed.getData({ rootName: r.nome }) === original[r.nome]);
        if (!out.um_undo_desfez_tudo) {
            out.ainda_diferentes = roots
                .filter((r) => ed.getData({ rootName: r.nome }) !== original[r.nome])
                .map((r) => r.nome);
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
