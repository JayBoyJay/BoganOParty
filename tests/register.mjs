// The browser finds 'three' through the import map in index.html; give node the same mapping so the
// tests can import map files (which pull in the 3D modelling helpers).
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    if (spec === 'three') return { url: ${JSON.stringify(new URL('../vendor/three.module.js', import.meta.url).href)}, shortCircuit: true };
    return next(spec, ctx);
  }`));
