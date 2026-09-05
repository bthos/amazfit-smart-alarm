// Backing store is module-level so every `new LocalStorage()` (no custom
// path) shares state, same as the real device where they all hit the same
// default file.
const backing = new Map()

export class LocalStorage {
  constructor(path = 'default') {
    this._path = path
    if (!backing.has(path)) backing.set(path, {})
  }

  _store() {
    return backing.get(this._path)
  }

  getItem(key, defaultValue) {
    const store = this._store()
    return key in store ? store[key] : defaultValue
  }

  setItem(key, value) {
    this._store()[key] = value
  }

  removeItem(key) {
    delete this._store()[key]
  }

  clear() {
    backing.set(this._path, {})
  }
}

// Clears the *contents* of each backing path in place, rather than
// `backing.clear()` - alarm-store.js constructs its `LocalStorage` once at
// module load and keeps calling `this._store()` (= `backing.get(this._path)`)
// on that same instance for the whole process, so replacing the Map itself
// would leave that instance pointing at a path key that no longer exists.
export function __resetAllMockStorage() {
  for (const path of backing.keys()) {
    backing.set(path, {})
  }
}
