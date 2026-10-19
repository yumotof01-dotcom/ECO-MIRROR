import type { Plugin } from "vite";
import { readBrowserMetadata } from "./metadata.ts";
import { resolve } from "node:path";
import { ROOT } from "../data/io.ts";

export function browserContextPlugin(): Plugin {
  const publicId = "virtual:eco-mirror-context", resolvedId = `\0${publicId}`;
  let checked: Awaited<ReturnType<typeof readBrowserMetadata>> | null = null;
  return {
    name: "eco-mirror-verified-browser-context",
    resolveId(id) { if (id === publicId) return resolvedId; },
    async load(id) {
      if (id !== resolvedId) return;
      const metadata = await readBrowserMetadata();
      checked = metadata;
      for (const path of [...Object.keys(metadata.code_input_sha256), ...Object.keys(metadata.application_input_sha256)]) this.addWatchFile(resolve(ROOT, path));
      return `export default ${JSON.stringify(metadata)};`;
    },
    handleHotUpdate({ server, file }) {
      if (/\/(src|scripts\/browser|docs\/simulation|data)\//.test(file) || file.endsWith("vite.config.ts")) {
        for (const environment of Object.values(server.environments)) environment.moduleGraph.invalidateAll();
        // Reset workers as well: a dirty HMR snapshot must not retain a verified badge.
        server.ws.send({ type: "full-reload" });
        return [];
      }
    },
    async buildEnd(error) {
      if (error || checked?.verification !== "verified") return;
      const latest = await readBrowserMetadata();
      if (latest.verification !== "verified" || JSON.stringify(latest.application_input_sha256) !== JSON.stringify(checked.application_input_sha256)) this.error("ビルド中に実装入力が変更されました。再ビルドしてください。");
    },
  };
}
