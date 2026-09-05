// Two things the app's real source files need that plain Node's ESM loader
// doesn't give them out of the box:
//
// 1. Zepp OS's own bundler (rollup) resolves extensionless relative imports
//    like `../utils/alarm-store`, but Node's native ESM resolver doesn't -
//    so retry those with `.js` appended.
// 2. `@zos/*` isn't a real npm package (it only exists inside the Zepp OS
//    device runtime), so bare `@zos/ui` etc. imports are redirected to the
//    hand-written mocks committed under test/mocks/@zos/ - deliberately
//    *not* node_modules/@zos, since node_modules is gitignored and these
//    mocks need to ship with the repo for `npm test` to work after a clone.
import { pathToFileURL } from 'node:url'

const ZOS_MOCKS_DIR = new URL('./mocks/@zos/', import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@zos/')) {
    const moduleName = specifier.slice('@zos/'.length)
    return nextResolve(pathToFileURL(`${ZOS_MOCKS_DIR.pathname}${moduleName}/index.js`).href, context)
  }

  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && (specifier.startsWith('./') || specifier.startsWith('../'))) {
      return nextResolve(`${specifier}.js`, context)
    }
    throw err
  }
}
