import { createRoot } from "react-dom/client";
import Playground from "./Playground.tsx";

// StrictMode は付けていない(付けると useEffect などが開発中に2回実行され、実行結果が読みにくくなるため)
createRoot(document.getElementById("root")!).render(<Playground />);
