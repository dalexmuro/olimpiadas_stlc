"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
} from "react";
import { sanitizeHtml } from "@/lib/security";

export interface RichTextEditorHandle {
  insertText: (text: string) => void;
}

export interface RichTextEditorProps {
  id: string;
  label: string;
  /** Change this key when switching to a different document/template so editor HTML resets cleanly */
  contentKey: string;
  value: string;
  onChange: (nextHtml: string) => void;
  readOnly?: boolean;
  minHeightClass?: string;
}

export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>(function RichTextEditor(
  {
    id,
    label,
    contentKey,
    value,
    onChange,
    readOnly = false,
    minHeightClass = "min-h-64",
  },
  ref
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<string>("");

  // Hydrate contentEditable only when switching documents or external value updates
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastEmittedRef.current || el.innerHTML === "") {
      const safe = sanitizeHtml(value);
      el.innerHTML = safe;
      lastEmittedRef.current = safe;
    }
  }, [contentKey, value]);

  function emitChange() {
    const el = editorRef.current;
    if (!el) return;
    const safe = sanitizeHtml(el.innerHTML);
    lastEmittedRef.current = safe;
    onChange(safe);
  }

  function exec(command: string, commandValue?: string) {
    if (readOnly) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function handleBlockChange(event: ChangeEvent<HTMLSelectElement>) {
    const tag = event.target.value;
    if (!tag) return;
    exec("formatBlock", tag);
    event.target.value = "";
  }

  function handleFontSizeChange(event: ChangeEvent<HTMLSelectElement>) {
    const size = event.target.value;
    if (!size) return;
    exec("fontSize", size);
    event.target.value = "";
  }

  function handleInsertLink() {
    if (readOnly) return;
    const rawUrl = window.prompt(
      "Ingresa la dirección del enlace (https:// o mailto:):",
      "https://"
    );
    if (!rawUrl) return;
    const trimmed = rawUrl.trim();
    if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      return;
    }
    exec("createLink", trimmed);
  }

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      if (readOnly) return;
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const inserted = document.execCommand("insertText", false, text);
      if (!inserted) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const node = document.createTextNode(text);
          range.insertNode(node);
          range.setStartAfter(node);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          el.appendChild(document.createTextNode(text));
        }
      }
      emitChange();
    },
  }));

  const toolbarBtnClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-input border border-rule bg-surface text-ink transition hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>

      <div className="mt-2 overflow-hidden rounded-card border border-ink bg-paper">
        {!readOnly && (
          <div
            role="toolbar"
            aria-label={`Formato de ${label}`}
            className="flex flex-wrap items-center gap-1.5 border-b border-rule bg-paper-2 px-3 py-2"
          >
            <select
              aria-label="Estilo de texto"
              defaultValue=""
              onChange={handleBlockChange}
              className="h-9 rounded-input border border-rule bg-surface px-2.5 text-xs font-medium text-ink"
            >
              <option value="" disabled>
                Estilo
              </option>
              <option value="P">Párrafo</option>
              <option value="H2">Título (H2)</option>
              <option value="H3">Subtítulo (H3)</option>
            </select>

            <select
              aria-label="Tamaño de texto"
              defaultValue=""
              onChange={handleFontSizeChange}
              className="h-9 rounded-input border border-rule bg-surface px-2.5 text-xs font-medium text-ink"
            >
              <option value="" disabled>
                Tamaño
              </option>
              <option value="2">Pequeño</option>
              <option value="3">Normal</option>
              <option value="4">Mediano</option>
              <option value="5">Grande</option>
            </select>

            <span
              className="mx-1 h-5 w-px bg-rule"
              aria-hidden="true"
            />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("bold")}
              title="Negrita"
              aria-label="Negrita"
              className={toolbarBtnClass}
            >
              <Bold className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("italic")}
              title="Cursiva"
              aria-label="Cursiva"
              className={toolbarBtnClass}
            >
              <Italic className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("underline")}
              title="Subrayado"
              aria-label="Subrayado"
              className={toolbarBtnClass}
            >
              <Underline className="h-4 w-4" aria-hidden="true" />
            </button>

            <span
              className="mx-1 h-5 w-px bg-rule"
              aria-hidden="true"
            />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("justifyLeft")}
              title="Alinear a la izquierda"
              aria-label="Alinear a la izquierda"
              className={toolbarBtnClass}
            >
              <AlignLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("justifyCenter")}
              title="Centrar"
              aria-label="Centrar"
              className={toolbarBtnClass}
            >
              <AlignCenter className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("justifyRight")}
              title="Alinear a la derecha"
              aria-label="Alinear a la derecha"
              className={toolbarBtnClass}
            >
              <AlignRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("justifyFull")}
              title="Justificar"
              aria-label="Justificar"
              className={toolbarBtnClass}
            >
              <AlignJustify className="h-4 w-4" aria-hidden="true" />
            </button>

            <span
              className="mx-1 h-5 w-px bg-rule"
              aria-hidden="true"
            />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("insertUnorderedList")}
              title="Lista con viñetas"
              aria-label="Lista con viñetas"
              className={toolbarBtnClass}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("insertOrderedList")}
              title="Lista numerada"
              aria-label="Lista numerada"
              className={toolbarBtnClass}
            >
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleInsertLink}
              title="Insertar enlace"
              aria-label="Insertar enlace"
              className={toolbarBtnClass}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("removeFormat")}
              title="Limpiar formato"
              aria-label="Limpiar formato"
              className={toolbarBtnClass}
            >
              <RemoveFormatting className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div
          id={id}
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-readonly={readOnly}
          aria-label={label}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          className={`riso-prose ${minHeightClass} w-full bg-paper p-4 text-sm text-ink outline-none ${
            readOnly ? "cursor-default bg-paper-2/40" : ""
          }`}
        />
      </div>
    </div>
  );
});
