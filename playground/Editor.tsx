import { useRef } from "react";
import type { KeyboardEvent } from "react";

type EditorProps = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
};

// execCommand は非推奨だが、textarea の「元に戻す」履歴を保ったまま文字を挿入できる
const insertText = (text: string) =>
  document.execCommand("insertText", false, text);

export default function Editor({ value, onChange, onRun }: EditorProps) {
  const gutterRef = useRef<HTMLPreElement>(null);
  const lineCount = value.split("\n").length;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語入力の変換確定の Enter などは素通しする
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onRun();
    } else if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      insertText("  ");
    } else if (event.key === "Enter") {
      // 改行しても前の行のインデントを引き継ぐ
      const { value: text, selectionStart } = event.currentTarget;
      const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
      const indent = /^[ \t]*/.exec(text.slice(lineStart, selectionStart))![0];
      event.preventDefault();
      insertText(`\n${indent}`);
    }
  };

  return (
    <div className="pg-editor">
      <pre className="pg-gutter" ref={gutterRef} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
      </pre>
      <textarea
        className="pg-code"
        aria-label="コード"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={(event) => {
          if (gutterRef.current) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }
        }}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
    </div>
  );
}
