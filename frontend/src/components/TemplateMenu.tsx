import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type DrawingTemplate, type NamedTemplate,
  loadTemplates, loadTemplateDefault, saveTemplateDefault,
  addTemplate, renameTemplate, deleteTemplate,
} from "../lib/templates";

interface Props {
  drawingKey: string;              // clé propre au type de dessin (trend / arrow / vline / channel / brush / fib)
  current: DrawingTemplate;        // config courante du dessin
  factory: DrawingTemplate;        // config d'usine (thème d'origine) pour ce type
  onApply: (t: DrawingTemplate) => void;
}

// Menu déroulant (vers le haut) des modèles d'un dessin — remplace « Définir par défaut ».
export default function TemplateMenu({ drawingKey, current, factory, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  const [naming, setNaming] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [manage, setManage] = useState(false);
  const [presets, setPresets] = useState<NamedTemplate[]>([]);
  const [flash, setFlash] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = () => setPresets(loadTemplates(drawingKey));
  useEffect(() => { refresh(); }, [drawingKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasDefault = !!loadTemplateDefault(drawingKey);

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
      refresh();
      setNaming(false);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!wrapRef.current?.contains(t) && !t.closest(".fib-tpl-menu")) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const flashMsg = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 1400); };
  const apply = (t: DrawingTemplate) => { onApply(t); setOpen(false); };
  const setDefault = () => { saveTemplateDefault(drawingKey, current); setOpen(false); flashMsg("✓ Défini par défaut"); };
  const submitName = () => {
    if (!nameVal.trim()) return;
    addTemplate(drawingKey, nameVal, current);
    setNameVal(""); setNaming(false); setOpen(false); refresh();
    flashMsg("✓ Enregistré");
  };

  return (
    <div className="fib-tpl" ref={wrapRef}>
      <button ref={btnRef} className="is-btn fib-tpl-btn" onClick={toggle}>
        Modèle <span className="fib-tpl-caret">▴</span>
      </button>
      {flash && <span className="fib-tpl-flash">{flash}</span>}

      {open && createPortal(
        <div className="fib-tpl-menu" style={{ position: "fixed", left: pos.left, bottom: pos.bottom }}>
          {naming ? (
            <div className="fib-tpl-name">
              <input
                autoFocus value={nameVal} placeholder="Nom du modèle…"
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitName(); if (e.key === "Escape") setNaming(false); }}
              />
              <div className="fib-tpl-name-row">
                <button className="is-btn" onClick={() => setNaming(false)}>Annuler</button>
                <button className="is-btn primary" onClick={submitName} disabled={!nameVal.trim()}>Enregistrer</button>
              </div>
            </div>
          ) : (
            <>
              <button className="fib-tpl-item" onClick={() => apply(factory)}>Appliquer le thème d'origine</button>
              <button className="fib-tpl-item" disabled={!hasDefault} onClick={() => { const d = loadTemplateDefault(drawingKey); if (d) apply(d); }}>Appliquer le thème par défaut</button>
              <button className="fib-tpl-item" onClick={setDefault}>Définir par défaut</button>
              <button className="fib-tpl-item" onClick={() => { setNameVal(""); setNaming(true); }}>Enregistrer sous…</button>
              <button className="fib-tpl-item" disabled={!presets.length} onClick={() => { setManage(true); setOpen(false); }}>Renommer / Supprimer…</button>
              <div className="fib-tpl-sep" />
              {presets.length === 0 ? (
                <div className="fib-tpl-empty">Aucun modèle enregistré</div>
              ) : presets.map((p) => (
                <button key={p.id} className="fib-tpl-item fib-tpl-preset" title={`Appliquer « ${p.name} »`} onClick={() => apply(p.template)}>{p.name}</button>
              ))}
            </>
          )}
        </div>, document.body)}

      {manage && createPortal(
        <TemplateManageModal drawingKey={drawingKey} onClose={() => { setManage(false); refresh(); }} />, document.body
      )}
    </div>
  );
}

// Fenêtre de gestion : table des modèles, renommer (✎) / supprimer (🗑 + confirmation).
function TemplateManageModal({ drawingKey, onClose }: { drawingKey: string; onClose: () => void }) {
  const [presets, setPresets] = useState<NamedTemplate[]>(loadTemplates(drawingKey));
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const refresh = () => setPresets(loadTemplates(drawingKey));

  const startRename = (p: NamedTemplate) => { setEditId(p.id); setEditVal(p.name); setDelId(null); };
  const commitRename = () => { if (editId) { renameTemplate(drawingKey, editId, editVal); setEditId(null); refresh(); } };
  const confirmDelete = () => { if (delId) { deleteTemplate(drawingKey, delId); setDelId(null); refresh(); } };

  return (
    <div className="fib-manage-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fib-manage">
        <div className="is-head">
          <span className="is-title">Modèles enregistrés</span>
          <button className="is-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="fib-manage-body">
          {presets.length === 0 ? (
            <div className="fib-tpl-empty">Aucun modèle enregistré.</div>
          ) : (
            <table className="fib-manage-tbl">
              <tbody>
                {presets.map((p) => (
                  <tr key={p.id}>
                    <td className="fmt-name">
                      {editId === p.id ? (
                        <input
                          autoFocus value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditId(null); }}
                          onBlur={commitRename}
                        />
                      ) : p.name}
                    </td>
                    <td className="fmt-actions">
                      {delId === p.id ? (
                        <span className="fmt-confirm">
                          Supprimer&nbsp;?
                          <button className="is-btn danger" onClick={confirmDelete}>Oui</button>
                          <button className="is-btn" onClick={() => setDelId(null)}>Non</button>
                        </span>
                      ) : (
                        <>
                          <button className="fmt-ico" title="Renommer" onClick={() => startRename(p)}>✎</button>
                          <button className="fmt-ico" title="Supprimer" onClick={() => { setDelId(p.id); setEditId(null); }}>🗑</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="is-foot">
          <div className="is-foot-right"><button className="is-btn primary" onClick={onClose}>Fermer</button></div>
        </div>
      </div>
    </div>
  );
}
