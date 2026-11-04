// Vercel Function entry: the whole Express API (compiled to lib/ by `npm run build`).
// vercel.json rewrites every path here; Express sees the original URL (/api/v1/...).
const { createApp } = require("../lib/app");

module.exports = createApp();
