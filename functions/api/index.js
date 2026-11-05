// Vercel Function entry. The Express API is bundled by `npm run build` into dist/api.cjs
// (esbuild converts ESM-only dependencies to CommonJS). vercel.json rewrites every path
// here; Express still sees the original URL (/api/v1/...).
const mod = require("../dist/api.cjs");

module.exports = mod.default || mod;
