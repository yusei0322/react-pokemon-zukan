import {
  Component,
  createElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentType, ReactNode } from "react";
import { LANGS, fileNameOf, transpile, typeCheck } from "./compiler";
import type { Lang, Problem } from "./compiler";
import Editor from "./Editor.tsx";
import { createConsole, execute, formatValue } from "./runner";
import type { ConsoleLevel } from "./runner";
import { DESCRIPTIONS, SAMPLES } from "./samples";
import "./playground.css";

const STORAGE_KEY = "playground:v1";
const MAX_ENTRIES = 500;
const TYPE_CHECK_DELAY_MS = 400;

type Saved = { lang: Lang; codes: Record<Lang, string> };

type ConsoleEntry = { id: number; level: ConsoleLevel; text: string };

type Preview = { runId: number; node: ReactNode };

type Checked = { lang: Lang; code: string; problems: Problem[] };

function loadSaved(): Saved {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<Saved> | null;
    return {
      lang: saved?.lang && LANGS.includes(saved.lang) ? saved.lang : "js",
      codes: { ...SAMPLES, ...saved?.codes },
    };
  } catch {
    return { lang: "js", codes: { ...SAMPLES } };
  }
}

/** プレビュー中のコンポーネントが描画エラーを起こしても、Playground ごと落ちないようにする */
class PreviewBoundary extends Component<
  { children: ReactNode },
  { error: unknown }
> {
  state = { error: undefined as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error !== undefined) {
      return (
        <p className="pg-preview-error">
          描画中にエラーが発生しました: {formatValue(this.state.error)}
        </p>
      );
    }
    return this.props.children;
  }
}

function ProblemList({ problems }: { problems: Problem[] }) {
  return (
    <ul className="pg-problems">
      {problems.map((problem, index) => (
        <li key={index}>
          <span className="pg-problem-position">
            {problem.line}行目 {problem.column}文字目
          </span>
          <span className="pg-problem-code">{problem.code}</span>
          <span className="pg-problem-message">{problem.message}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Playground() {
  const [saved, setSaved] = useState(loadSaved);
  const { lang } = saved;
  const code = saved.codes[lang];

  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [running, setRunning] = useState(false);
  const [outputTab, setOutputTab] = useState<"result" | "compiled">("result");
  const [checked, setChecked] = useState<Checked | null>(null);

  // 実行のたびに増やす番号。前回の実行があとから出したログを混ぜないために使う
  const runIdRef = useRef(0);
  const entryIdRef = useRef(0);

  const compiled = useMemo(() => transpile(lang, code), [lang, code]);
  const hasSyntaxError = compiled.problems.length > 0;
  const isTypeScript = lang === "ts" || lang === "tsx";

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  // 入力が止まってから型チェックする
  useEffect(() => {
    if (!isTypeScript || hasSyntaxError) return;
    let stale = false;
    const timer = setTimeout(() => {
      typeCheck(lang, code)
        .catch((error: unknown): Problem[] => [
          {
            line: 1,
            column: 1,
            code: "ERROR",
            message: `型チェックを実行できませんでした: ${formatValue(error)}`,
          },
        ])
        .then((problems) => {
          if (!stale) setChecked({ lang, code, problems });
        });
    }, TYPE_CHECK_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [lang, code, isTypeScript, hasSyntaxError]);

  const addEntry = useCallback((level: ConsoleLevel, text: string) => {
    const entry = { id: ++entryIdRef.current, level, text };
    setEntries((prev) => [...prev, entry].slice(-MAX_ENTRIES));
  }, []);

  // setTimeout やクリック時の処理など、あとから起きたエラーもコンソールに出す
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      addEntry("error", `Uncaught ${formatValue(event.error ?? event.message)}`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      addEntry("error", `Uncaught (in promise) ${formatValue(event.reason)}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [addEntry]);

  const resetOutput = () => {
    runIdRef.current += 1;
    setEntries([]);
    setPreview(null);
    setRunning(false);
    return runIdRef.current;
  };

  const run = async () => {
    const runId = resetOutput();
    setOutputTab("result");
    if (hasSyntaxError) {
      addEntry(
        "error",
        "構文エラーがあるため実行できません。左下の「問題」を確認してください。",
      );
      return;
    }

    const isCurrent = () => runIdRef.current === runId;
    const playgroundConsole = createConsole(
      (level, text) => {
        if (isCurrent()) addEntry(level, text);
      },
      () => {
        if (isCurrent()) setEntries([]);
      },
    );

    setRunning(true);
    try {
      const exported = await execute(compiled.runCode, playgroundConsole);
      if (!isCurrent()) return;
      if (typeof exported === "function") {
        const node = createElement(exported as ComponentType);
        setPreview({ runId, node });
      } else if (isValidElement(exported)) {
        setPreview({ runId, node: exported });
      } else if (exported !== undefined) {
        addEntry("info", `export default → ${formatValue(exported)}`);
      }
    } catch (error) {
      if (isCurrent()) addEntry("error", `Uncaught ${formatValue(error)}`);
    } finally {
      if (isCurrent()) setRunning(false);
    }
  };

  const changeLang = (next: Lang) => {
    if (next === lang) return;
    resetOutput();
    setSaved((prev) => ({ ...prev, lang: next }));
  };

  const changeCode = (next: string) => {
    setSaved((prev) => ({ ...prev, codes: { ...prev.codes, [lang]: next } }));
  };

  const resetCode = () => {
    if (code === SAMPLES[lang]) return;
    if (window.confirm(`${fileNameOf(lang)} をサンプルコードに戻しますか?`)) {
      changeCode(SAMPLES[lang]);
    }
  };

  const typeResult =
    isTypeScript && !hasSyntaxError && checked?.lang === lang ? checked : null;
  const typeProblems = typeResult?.problems ?? [];
  const typeChecking =
    isTypeScript && !hasSyntaxError && typeResult?.code !== code;

  let problemStatus: string;
  if (hasSyntaxError) {
    problemStatus = `構文エラー ${compiled.problems.length} 件(実行できません)`;
  } else if (!isTypeScript) {
    problemStatus = `構文エラーなし(.${lang} は型チェックされません)`;
  } else if (typeChecking) {
    problemStatus = "型チェック中…";
  } else if (typeProblems.length > 0) {
    problemStatus = `型エラー ${typeProblems.length} 件(実行はできますが、npm run build は失敗します)`;
  } else {
    problemStatus = "問題なし";
  }

  return (
    <div className="pg">
      <header className="pg-header">
        <h1>Playground</h1>
        <nav className="pg-tabs" aria-label="ファイルの種類">
          {LANGS.map((item) => (
            <button
              key={item}
              type="button"
              className="pg-tab"
              aria-pressed={item === lang}
              onClick={() => changeLang(item)}
            >
              {fileNameOf(item)}
            </button>
          ))}
        </nav>
        <div className="pg-actions">
          <button type="button" className="pg-button" onClick={resetCode}>
            サンプルに戻す
          </button>
          <button
            type="button"
            className="pg-button pg-button-primary"
            onClick={run}
            title="⌘ / Ctrl + Enter"
          >
            ▶ 実行
          </button>
        </div>
        <p className="pg-description">{DESCRIPTIONS[lang]}</p>
      </header>

      <main className="pg-main">
        <section className="pg-pane">
          <Editor value={code} onChange={changeCode} onRun={run} />
          <div className="pg-panel pg-problem-panel">
            <h2 className="pg-panel-title">
              問題
              <span
                className="pg-status"
                data-level={
                  hasSyntaxError
                    ? "error"
                    : typeProblems.length > 0
                      ? "warn"
                      : "ok"
                }
              >
                {problemStatus}
              </span>
            </h2>
            <ProblemList
              problems={hasSyntaxError ? compiled.problems : typeProblems}
            />
          </div>
        </section>

        <section className="pg-pane">
          <nav className="pg-tabs pg-output-tabs" aria-label="出力の種類">
            <button
              type="button"
              className="pg-tab"
              aria-pressed={outputTab === "result"}
              onClick={() => setOutputTab("result")}
            >
              実行結果
            </button>
            <button
              type="button"
              className="pg-tab"
              aria-pressed={outputTab === "compiled"}
              onClick={() => setOutputTab("compiled")}
            >
              変換後の JavaScript
            </button>
          </nav>

          {outputTab === "result" ? (
            <>
              {preview && (
                <div className="pg-panel pg-preview-panel">
                  <h2 className="pg-panel-title">
                    プレビュー(export default したコンポーネント)
                  </h2>
                  <div className="pg-preview">
                    <PreviewBoundary key={preview.runId}>
                      {preview.node}
                    </PreviewBoundary>
                  </div>
                </div>
              )}
              <div className="pg-panel pg-console-panel">
                <h2 className="pg-panel-title">
                  コンソール
                  {running && <span className="pg-status">実行中…</span>}
                </h2>
                {entries.length === 0 && !running ? (
                  <p className="pg-empty">
                    「▶ 実行」を押すと、console.log
                    の出力がここに表示されます。
                  </p>
                ) : (
                  <ol className="pg-console">
                    {entries.map((entry) => (
                      <li key={entry.id} data-level={entry.level}>
                        {entry.text}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          ) : (
            <div className="pg-panel pg-compiled-panel">
              <h2 className="pg-panel-title">
                ブラウザが実際に実行するコード(型や JSX
                は、実行前にこの形に変換されます)
              </h2>
              <pre className="pg-compiled">{compiled.displayCode}</pre>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
