// Diagnostico 5 - identificar quais roots sao o corpo do documento.
// Cole no Console (F12) da janela do editor do SEI.
(() => {
    const els = [...document.querySelectorAll('.ck-editor__editable, .ck-content')];
    const ed = els.map((e) => e.ckeditorInstance).find(Boolean);
    if (!ed) return console.log('instancia nao encontrada');
    window.__ed = ed;

    const linhas = ed.model.document.getRootNames().map((nome) => {
        const info = { root: nome };
        try {
            info.texto = ed.getData({ rootName: nome }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
        } catch (e) { info.texto = 'ERRO'; }
        try {
            const el = ed.ui.getEditableElement(nome);
            if (el) {
                info.el_class = el.className;
                info.el_id = el.id;
                // Atributos data-* costumam carregar a identificacao da secao no SEI.
                info.el_data = JSON.stringify(Object.assign({}, el.dataset));
                // Sobe a arvore: o container pai geralmente diz cabecalho/corpo/rodape.
                const anc = [];
                for (let p = el.parentElement, i = 0; p && i < 4; p = p.parentElement, i++) {
                    anc.push((p.tagName || '') + (p.id ? '#' + p.id : '') +
                             (p.className ? '.' + String(p.className).split(/\s+/).join('.') : ''));
                }
                info.ancestrais = anc.join(' < ');
                info.readonly = el.getAttribute('contenteditable');
            } else {
                info.el_class = 'sem elemento editavel';
            }
        } catch (e) { info.el_class = 'ERRO: ' + e.message; }
        return info;
    });

    console.table(linhas);
    const txt = JSON.stringify(linhas, null, 2);
    console.log(txt);
    copy(txt);
    return linhas;
})();
