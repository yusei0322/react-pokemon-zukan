import type { Lang } from "./compiler";

export const DESCRIPTIONS: Record<Lang, string> = {
  js: "JavaScript — ブラウザがそのまま実行できる、すべての土台になる言語",
  ts: "TypeScript — JavaScript に「型」を足したもの。型は実行前にすべて取り除かれる",
  jsx: "JSX — JavaScript の中に HTML のようなタグを書けるようにした記法。React の画面を作るのに使う",
  tsx: "TSX — TypeScript + JSX。このプロジェクトの src/ で使っている形式",
};

const js = `// JavaScript(.js)
// ▶ 実行(⌘/Ctrl + Enter)を押すと、右側のコンソールに console.log の結果が出ます

// 変数: 再代入しないなら const、するなら let
const name = "ピカチュウ";
let level = 5;
level += 1;
console.log(\`\${name} は Lv.\${level} になった!\`);

// オブジェクトと分割代入
const pokemon = { id: 25, name, types: ["でんき"] };
const { id, types } = pokemon;
console.log(id, types, pokemon);

// 配列の map / filter(React で一覧を表示するときによく使う)
const party = [
  { name: "フシギダネ", type: "くさ", hp: 45 },
  { name: "ヒトカゲ", type: "ほのお", hp: 39 },
  { name: "ゼニガメ", type: "みず", hp: 44 },
];
console.log(party.map((p) => p.name));
console.log(party.filter((p) => p.hp >= 44));

// 関数(アロー関数)とスプレッド構文
const levelUp = (p) => ({ ...p, hp: p.hp + 10 });
console.log(levelUp(party[0]));

// JS には型がないので、間違った使い方をしても実行するまで気づけない
console.log(levelUp("ピカチュウ")); // ← 意図しない結果になるがエラーにはならない

// 非同期処理: await で結果が返ってくるのを待つ(PokeAPI からデータを取得)
const response = await fetch("https://pokeapi.co/api/v2/pokemon/25");
const data = await response.json();
console.log(data.name, \`高さ: \${data.height}\`, \`重さ: \${data.weight}\`);
`;

const tsSample = `// TypeScript(.ts)
// JavaScript に「型」を書き足したもの。右の「変換後の JavaScript」タブを見ると、
// 型の部分だけが消えて普通の JavaScript になっているのがわかります

// 変数や引数に : 型 を付けられる(書かなくても右辺から推論される)
const name: string = "ピカチュウ";
let level = 5; // number と推論される
level += 1;
console.log(\`\${name} は Lv.\${level} になった!\`);

// type でオブジェクトの形に名前を付ける
type PokemonType = "くさ" | "ほのお" | "みず"; // この3つの文字列だけを許す型
type Pokemon = {
  name: string;
  type: PokemonType;
  hp: number;
  nickname?: string; // ? は「無くてもよい」
};

const party: Pokemon[] = [
  { name: "フシギダネ", type: "くさ", hp: 45 },
  { name: "ヒトカゲ", type: "ほのお", hp: 39, nickname: "ひーくん" },
  { name: "ゼニガメ", type: "みず", hp: 44 },
];

// 引数と戻り値に型を付けた関数
const levelUp = (p: Pokemon): Pokemon => ({ ...p, hp: p.hp + 10 });
console.log(levelUp(party[0]));

// ↓ コメントを外すと、左下の「問題」に型エラーが出る(実行する前に間違いに気づける)
// levelUp("ピカチュウ");
// party.push({ name: "コダック", type: "エスパー", hp: 50 });

// ジェネリクス: 型を引数のように受け取る
const first = <T>(items: T[]): T | undefined => items[0];
const head = first(party); // Pokemon | undefined と推論される
console.log(head?.nickname ?? head?.name);

// fetch の結果のように型がわからないものには、自分で型を付ける
type ApiPokemon = { id: number; name: string; height: number; weight: number };
const response = await fetch("https://pokeapi.co/api/v2/pokemon/25");
const data: ApiPokemon = await response.json();
console.log(data.id, data.name);
`;

const jsx = `// JSX(.jsx)
// JavaScript の中に HTML のようなタグを書ける記法。
// export default したコンポーネントが、右側の「プレビュー」に表示されます
import { useState } from "react";

const party = [
  { id: 1, name: "フシギダネ", type: "くさ" },
  { id: 4, name: "ヒトカゲ", type: "ほのお" },
  { id: 7, name: "ゼニガメ", type: "みず" },
];

// コンポーネント = JSX を返す関数(名前は大文字で始める)。引数の props で値を受け取る
function PokemonCard({ name, type, onPick }) {
  return (
    <li>
      {/* { } の中には JavaScript の式が書ける */}
      <strong>{name}</strong>({type}タイプ){" "}
      <button onClick={onPick}>きみにきめた!</button>
    </li>
  );
}

export default function App() {
  // useState: 値が変わると画面が再描画される「状態」
  const [picked, setPicked] = useState(null);

  return (
    <div>
      <h2>さいしょの ポケモン</h2>
      <ul>
        {/* 配列を map でタグの配列に変換する。key には一意な値を渡す */}
        {party.map((p) => (
          <PokemonCard
            key={p.id}
            name={p.name}
            type={p.type}
            onPick={() => setPicked(p.name)}
          />
        ))}
      </ul>
      {/* 条件によって表示を切り替える */}
      {picked ? <p>{picked} を えらんだ!</p> : <p>まだ えらんでいません</p>}
    </div>
  );
}

// JSX のタグの正体はただのオブジェクト(「変換後の JavaScript」タブも見てみよう)
console.log(<PokemonCard name="ピカチュウ" type="でんき" />);
`;

const tsx = `// TSX(.tsx)
// TypeScript + JSX。props や state に型を付けられるので、
// 渡し忘れや打ち間違いを実行する前に見つけられます
import { useState } from "react";
import type { ChangeEvent } from "react";

type Pokemon = {
  id: number;
  name: string;
  type: "くさ" | "ほのお" | "みず";
};

const party: Pokemon[] = [
  { id: 1, name: "フシギダネ", type: "くさ" },
  { id: 4, name: "ヒトカゲ", type: "ほのお" },
  { id: 7, name: "ゼニガメ", type: "みず" },
];

// props の型を定義しておく
type PokemonCardProps = {
  pokemon: Pokemon;
  selected: boolean;
  onPick: (pokemon: Pokemon) => void;
};

function PokemonCard({ pokemon, selected, onPick }: PokemonCardProps) {
  return (
    <li style={{ fontWeight: selected ? "bold" : "normal" }}>
      {pokemon.name}({pokemon.type}タイプ){" "}
      <button onClick={() => onPick(pokemon)}>きみにきめた!</button>
    </li>
  );
}

export default function App() {
  // state の型は <> で指定する(最初は何も選んでいないので null も許す)
  const [picked, setPicked] = useState<Pokemon | null>(null);
  const [keyword, setKeyword] = useState("");

  // イベントにも型がある
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setKeyword(event.target.value);
  };

  const filtered = party.filter((p) => p.name.includes(keyword));

  return (
    <div>
      <h2>さいしょの ポケモン</h2>
      <input value={keyword} onChange={handleChange} placeholder="なまえで しぼりこむ" />
      <ul>
        {filtered.map((p) => (
          <PokemonCard
            key={p.id}
            pokemon={p}
            selected={picked?.id === p.id}
            onPick={setPicked}
          />
        ))}
      </ul>
      <p>{picked ? \`\${picked.name} を えらんだ!\` : "まだ えらんでいません"}</p>

      {/* ↓ コメントを外すと型エラー(必要な props が足りない) */}
      {/* <PokemonCard pokemon={party[0]} /> */}
    </div>
  );
}
`;

export const SAMPLES: Record<Lang, string> = { js, ts: tsSample, jsx, tsx };
