import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as jsxRuntime from "react/jsx-runtime";

export type ConsoleLevel = "log" | "info" | "debug" | "warn" | "error";

// Playground のコードから import できるモジュール
const modules: Record<string, unknown> = {
  react: React,
  "react-dom": ReactDOM,
  "react-dom/client": ReactDOMClient,
  "react/jsx-runtime": jsxRuntime,
};

function requireModule(name: string): unknown {
  if (name in modules) return modules[name];
  throw new Error(
    `"${name}" は Playground では import できません(使えるのは ${Object.keys(modules).join(" / ")})`,
  );
}

const AsyncFunction = Object.getPrototypeOf(async () => {})
  .constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

/** 変換済みのコードを実行し、export default された値を返す */
export async function execute(
  runCode: string,
  playgroundConsole: Console,
): Promise<unknown> {
  const module = { exports: {} as Record<string, unknown> };
  // async 関数として実行するので、トップレベルの await も使える
  const run = new AsyncFunction(
    "require",
    "module",
    "exports",
    "console",
    runCode,
  );
  await run(requireModule, module, module.exports, playgroundConsole);
  return module.exports.default;
}

const MAX_DEPTH = 3;
const MAX_ITEMS = 30;
const MAX_WIDTH = 72;

function formatList(
  open: string,
  items: string[],
  close: string,
  indent: string,
): string {
  if (items.length === 0) return open + close;
  const oneLine = `${open} ${items.join(", ")} ${close}`;
  if (oneLine.length <= MAX_WIDTH && !oneLine.includes("\n")) return oneLine;
  const inner = `${indent}  `;
  return `${open}\n${inner}${items.join(`,\n${inner}`)}\n${indent}${close}`;
}

function format(
  value: unknown,
  depth: number,
  indent: string,
  seen: Set<unknown>,
): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "function") {
    const kind = /^class\b/.test(Function.prototype.toString.call(value))
      ? "class"
      : "Function";
    return `[${kind}: ${value.name || "(anonymous)"}]`;
  }
  if (typeof value !== "object" || value === null) return String(value);

  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  }
  if (value instanceof RegExp) return String(value);
  if (value instanceof Promise) return "Promise {}";
  if (value instanceof Element) {
    const html = value.outerHTML;
    return html.length > 200 ? `${html.slice(0, 200)}…` : html;
  }
  if (seen.has(value)) return "[Circular]";

  const isArray = Array.isArray(value);
  const name = isArray ? "" : (value.constructor?.name ?? "");
  const label = name && name !== "Object" ? `${name} ` : "";
  if (depth >= MAX_DEPTH) return isArray ? "[…]" : `${label}{…}`;

  seen.add(value);
  const child = (item: unknown) => format(item, depth + 1, `${indent}  `, seen);
  let entries: string[];
  if (isArray) {
    entries = value.map(child);
  } else if (value instanceof Map) {
    entries = [...value].map(([key, item]) => `${child(key)} => ${child(item)}`);
  } else if (value instanceof Set) {
    entries = [...value].map(child);
  } else {
    entries = Object.entries(value).map(
      ([key, item]) => `${key}: ${child(item)}`,
    );
  }
  seen.delete(value);

  if (entries.length > MAX_ITEMS) {
    entries = [
      ...entries.slice(0, MAX_ITEMS),
      `… 他 ${entries.length - MAX_ITEMS} 件`,
    ];
  }
  return isArray
    ? formatList("[", entries, "]", indent)
    : formatList(`${label}{`, entries, "}", indent);
}

/** console.log の引数1つを、ブラウザのコンソールに近い見た目の文字列にする */
export function formatValue(value: unknown): string {
  return typeof value === "string" ? value : format(value, 0, "", new Set());
}

/** 出力を画面にも流す console。ブラウザ本来のコンソール(開発者ツール)にもそのまま出す */
export function createConsole(
  onEntry: (level: ConsoleLevel, text: string) => void,
  onClear: () => void,
): Console {
  const method =
    (level: ConsoleLevel) =>
    (...args: unknown[]) => {
      window.console[level](...args);
      onEntry(level, args.map(formatValue).join(" "));
    };
  return {
    ...window.console,
    log: method("log"),
    info: method("info"),
    debug: method("debug"),
    warn: method("warn"),
    error: method("error"),
    table: method("log"),
    clear: () => {
      window.console.clear();
      onClear();
    },
  };
}
