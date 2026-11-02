import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// The site's TypeScript imports siblings the bundler way ("./copy/de", "@/lib/locale"); Node needs the file. Test-only:
// resolves those specifiers to the .ts file so plain modules can be loaded with --experimental-strip-types.
const root = new URL("../../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    let target;
    if (specifier.startsWith("@/")) target = new URL(specifier.slice(2), root);
    else if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts"))
      target = new URL(specifier, context.parentURL);
    if (target && !/\.[cm]?[jt]s$/.test(target.pathname)) {
      const file = `${fileURLToPath(target)}.ts`;
      if (existsSync(file)) return next(pathToFileURL(file).href, context);
    }
    return next(target ? target.href : specifier, context);
  },
});
