"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { MediaPickerDialog } from "./MediaPicker";

/**
 * Rich text editor. Output is still sanitised by the API (allow-list) before storage,
 * so the editor is a convenience, not a security boundary.
 */
export function RichEditor({ id, value, onChange }: { id: string; value: string; onChange: (html: string) => void }) {
  const [picker, setPicker] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ["https", "mailto"], HTMLAttributes: { rel: "noopener noreferrer nofollow" } }),
      Image,
    ],
    content: value,
    editorProps: { attributes: { id, "aria-label": "Editor de conteúdo", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            ul: e.isActive("bulletList"),
            ol: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
          }
        : null,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return <div className="editor" style={{ minHeight: 300 }} />;

  const btn = (label: string, title: string, active: boolean | undefined, run: () => void) => (
    <button type="button" title={title} aria-label={title} aria-pressed={!!active} onClick={run}>
      {label}
    </button>
  );

  return (
    <div className="editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Formatação">
        {btn("B", "Negrito", state?.bold, () => editor.chain().focus().toggleBold().run())}
        {btn("I", "Itálico", state?.italic, () => editor.chain().focus().toggleItalic().run())}
        {btn("H2", "Título", state?.h2, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {btn("H3", "Subtítulo", state?.h3, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        {btn("•", "Lista", state?.ul, () => editor.chain().focus().toggleBulletList().run())}
        {btn("1.", "Lista numerada", state?.ol, () => editor.chain().focus().toggleOrderedList().run())}
        {btn("❝", "Citação", state?.quote, () => editor.chain().focus().toggleBlockquote().run())}
        {btn("🔗", "Inserir link", state?.link, () => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Endereço do link (https://…)", prev ?? "https://");
          if (url === null) return;
          if (!url) return void editor.chain().focus().unsetLink().run();
          if (!/^(https:\/\/|mailto:)/i.test(url)) return void window.alert("Use um link https:// ou mailto:");
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        })}
        {btn("🖼", "Inserir imagem da biblioteca", false, () => setPicker(true))}
        {btn("↶", "Desfazer", false, () => editor.chain().focus().undo().run())}
        {btn("↷", "Refazer", false, () => editor.chain().focus().redo().run())}
      </div>
      <EditorContent editor={editor} className="editor-content prose" />
      <MediaPickerDialog
        open={picker}
        kind="image"
        onClose={() => setPicker(false)}
        onSelect={([m]) => {
          setPicker(false);
          if (m) editor.chain().focus().setImage({ src: `/api/v1/public/media/${m.id}`, alt: m.name }).run();
        }}
      />
    </div>
  );
}
