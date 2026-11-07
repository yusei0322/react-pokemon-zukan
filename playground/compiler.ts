import ts from "typescript";
import projectTsconfig from "../tsconfig.app.json?raw";

export type Lang = "js" | "ts" | "jsx" | "tsx";

export const LANGS: Lang[] = ["js", "ts", "jsx", "tsx"];

export type Problem = {
  line: number;
  column: number;
  code: string;
  message: string;
};

export type Compiled = {
  /** 構文エラー。1件でもあると実行できない */
  problems: Problem[];
  /** 画面表示用(Vite が実際に出力する形に近い ES Modules) */
  displayCode: string;
  /** 実行用(import を require に置き換えた CommonJS) */
  runCode: string;
};

export const fileNameOf = (lang: Lang) => `main.${lang}`;

const virtualPath = (lang: Lang) => `/playground/${fileNameOf(lang)}`;

// src/ と同じルールで試せるように、プロジェクトの tsconfig.app.json をそのまま読み込む
const projectOptions = ts.convertCompilerOptionsFromJson(
  ts.parseConfigFileTextToJson("tsconfig.app.json", projectTsconfig).config
    .compilerOptions,
  "/",
).options;

const baseOptions: ts.CompilerOptions = {
  ...projectOptions,
  tsBuildInfoFile: undefined,
  types: [],
  allowJs: true,
  // 試し書きでは「未使用の変数」エラーが邪魔になるので切っておく
  noUnusedLocals: false,
  noUnusedParameters: false,
};

const runOptions: ts.CompilerOptions = {
  ...baseOptions,
  module: ts.ModuleKind.CommonJS,
  verbatimModuleSyntax: false,
};

function toProblem(diagnostic: ts.Diagnostic): Problem {
  const position =
    diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      : { line: 0, character: 0 };
  return {
    line: position.line + 1,
    column: position.character + 1,
    code: `TS${diagnostic.code}`,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  };
}

// TypeScript は .js の中の JSX を受け付けるが、Vite は .jsx / .tsx 以外の JSX をエラーにする
function findJsxInJs(code: string): Problem[] {
  const source = ts.createSourceFile(
    "main.js",
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) return [];
  const position = source.getLineAndCharacterOfPosition(
    found.getStart(source),
  );
  return [
    {
      line: position.line + 1,
      column: position.character + 1,
      code: "JSX",
      message:
        "JSX は .js ファイルには書けません。Vite では拡張子を .jsx(TypeScript なら .tsx)にする必要があります。",
    },
  ];
}

// TypeScript は JSX 内の日本語を \uXXXX に書き換えて出力するので、表示用は読める文字に戻す
const unescapeUnicode = (js: string) =>
  js.replace(
    /(\\+)u([0-9A-Fa-f]{4})/g,
    (match, slashes: string, hex: string) => {
      const charCode = parseInt(hex, 16);
      return slashes.length % 2 === 1 && charCode >= 0x80
        ? slashes.slice(1) + String.fromCharCode(charCode)
        : match;
    },
  );

export function transpile(lang: Lang, code: string): Compiled {
  const fileName = virtualPath(lang);
  const display = ts.transpileModule(code, {
    fileName,
    compilerOptions: baseOptions,
    reportDiagnostics: true,
  });
  const run = ts.transpileModule(code, {
    fileName,
    compilerOptions: runOptions,
  });
  const problems = (display.diagnostics ?? []).map(toProblem);
  if (lang === "js") problems.push(...findJsxInJs(code));
  return {
    problems,
    displayCode: unescapeUnicode(display.outputText),
    runCode: run.outputText,
  };
}

// 型チェックに必要な型定義(.d.ts)。最初の型チェック時にだけ読み込む
const typeSources = import.meta.glob<string>(
  [
    "/node_modules/typescript/lib/lib.*.d.ts",
    "/node_modules/@types/{react,react-dom}/**/*.{d.ts,json}",
    "/node_modules/csstype/*.{d.ts,json}",
  ],
  { query: "?raw", import: "default", exhaustive: true },
);

type Checker = (lang: Lang, code: string) => Problem[];

async function createChecker(): Promise<Checker> {
  const files = new Map<string, string>();
  await Promise.all(
    Object.entries(typeSources).map(async ([path, load]) => {
      files.set(path, await load());
    }),
  );

  let current = "";
  let version = 0;
  const service = ts.createLanguageService({
    getCompilationSettings: () => baseOptions,
    getScriptFileNames: () => [current],
    getScriptVersion: (fileName) =>
      fileName === current ? String(version) : "0",
    getScriptSnapshot: (fileName) => {
      const text = files.get(fileName);
      return text === undefined
        ? undefined
        : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: (options) =>
      `/node_modules/typescript/lib/${ts.getDefaultLibFileName(options)}`,
    fileExists: (fileName) => files.has(fileName),
    readFile: (fileName) => files.get(fileName),
  });

  return (lang, code) => {
    current = virtualPath(lang);
    version += 1;
    files.set(current, code);
    return service.getSemanticDiagnostics(current).map(toProblem);
  };
}

let checker: Promise<Checker> | undefined;

/** 型エラーを返す。Vite と同じく、型エラーがあっても実行自体は止めない */
export async function typeCheck(lang: Lang, code: string): Promise<Problem[]> {
  checker ??= createChecker();
  return (await checker)(lang, code);
}
