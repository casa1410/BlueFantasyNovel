/**
 * Publica una versión nueva en GitHub con un solo comando.
 *
 *   npm run release                 → sube el último número (0.5.0 → 0.5.1)
 *   npm run release -- minor        → 0.5.0 → 0.6.0
 *   npm run release -- major        → 0.5.0 → 1.0.0
 *   npm run release -- 0.7.2        → versión exacta
 *   npm run release -- --dry-run    → solo muestra lo que haría, sin cambiar nada
 *
 * Pasos:
 *  1. Comprueba que no haya cambios sin guardar en git y que `gh` tenga sesión.
 *  2. Cambia la versión en package.json y package-lock.json.
 *  3. Comprueba los tipos y genera los .exe (`npm run dist`).
 *  4. Crea el commit "Versión X" y la etiqueta vX, y los sube a GitHub.
 *  5. Crea la Release con el instalador y la versión portable adjuntos y, como
 *     notas, los mensajes de los commits desde la versión anterior.
 *
 * Requisitos: git y GitHub CLI (`gh`) con la sesión iniciada (`gh auth login`).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const requested = args.find((a) => !a.startsWith('--')) ?? 'patch'

const log = (message) => console.log(`\n▸ ${message}`)
const fail = (message) => {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

/** Ejecuta un comando y devuelve su salida (lanza si falla). */
const output = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8' }).trim()

/** Ejecuta un comando mostrando su salida en pantalla. */
function run(cmd, cmdArgs) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE // ver scripts/electron-vite.mjs
  // En Windows, npm es un .cmd y necesita la consola; git y gh no, y sin ella
  // los argumentos con espacios ("Versión 1.2.3") llegan intactos.
  const shell = process.platform === 'win32' && cmd === 'npm'
  const result = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', env, shell })
  if (result.status !== 0) fail(`Falló: ${cmd} ${cmdArgs.join(' ')}`)
}

function nextVersion(current, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind
  const [major, minor, patch] = current.split('.').map(Number)
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`
  fail(`Versión no válida: «${kind}». Usa patch, minor, major o un número como 1.2.3.`)
}

// ---------------------------------------------------------------- 1. Comprobaciones
if (output('git', ['status', '--porcelain'])) {
  fail('Hay cambios sin guardar en git. Haz commit de ellos (o descártalos) antes de publicar.')
}
try {
  output('gh', ['auth', 'status'])
} catch {
  fail('GitHub CLI no tiene la sesión iniciada. Ejecuta: gh auth login')
}

const pkgPath = path.join(root, 'package.json')
const lockPath = path.join(root, 'package-lock.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const version = nextVersion(pkg.version, requested)
const tag = `v${version}`
if (output('git', ['tag', '--list', tag])) fail(`La etiqueta ${tag} ya existe.`)

const previousTag = output('git', ['tag', '--list', 'v*', '--sort=-v:refname']).split('\n')[0] || ''
const range = previousTag ? [`${previousTag}..HEAD`] : []
const changes = output('git', ['log', ...range, '--no-merges', '--format=%s'])
  .split('\n')
  .filter((line) => line && !/^Versión \d/.test(line))

console.log(`Versión actual: ${pkg.version}  →  nueva: ${version}`)
console.log(changes.length ? `Cambios desde ${previousTag || 'el inicio'}:\n  - ${changes.join('\n  - ')}` : 'Sin commits nuevos desde la última versión.')

if (dryRun) {
  console.log('\n(--dry-run: no se ha cambiado nada)')
  process.exit(0)
}

// ---------------------------------------------------------------- 2. Versión
log(`Cambiando la versión a ${version}`)
pkg.version = version
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  lock.version = version
  if (lock.packages?.['']) lock.packages[''].version = version
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
}

// ---------------------------------------------------------------- 3. Compilar
log('Comprobando tipos')
run('npm', ['run', 'typecheck'])
log('Generando los .exe (tarda un par de minutos)')
run('npm', ['run', 'dist'])

const setup = path.join(root, 'release', `BlueFantasyNovel-Setup-${version}.exe`)
const portable = path.join(root, 'release', `BlueFantasyNovel-Portable-${version}.exe`)
for (const file of [setup, portable]) if (!existsSync(file)) fail(`No se encontró ${file}`)

// ---------------------------------------------------------------- 4. Git
log('Creando commit y etiqueta, y subiendo a GitHub')
run('git', ['add', 'package.json', 'package-lock.json'])
run('git', ['commit', '-m', `Versión ${version}`])
run('git', ['tag', '-a', tag, '-m', `Versión ${version}`])
run('git', ['push', 'origin', 'HEAD', '--follow-tags'])

// ---------------------------------------------------------------- 5. Release
log('Creando la Release en GitHub')
const notes = `## Novedades

${changes.length ? changes.map((c) => `- ${c}`).join('\n') : '- Mejoras y correcciones.'}

## Descarga

| Archivo | Para qué |
|---|---|
| **BlueFantasyNovel-Setup-${version}.exe** | Instalador (recomendado). Crea accesos directos y se desinstala desde Windows. |
| **BlueFantasyNovel-Portable-${version}.exe** | Portable: un solo archivo que funciona sin instalar. |

Para Windows 10 y 11. Si aparece «Windows protegió su PC», pulsa **Más información → Ejecutar de todas formas** (el programa no está firmado con un certificado de pago).

Tus historias están en \`Documentos\\BlueFantasyNovel\`: actualizar el programa no las toca.
`
const notesFile = path.join(mkdtempSync(path.join(tmpdir(), 'bfn-release-')), 'notas.md')
writeFileSync(notesFile, notes)
run('gh', ['release', 'create', tag, setup, portable, '--title', `BlueFantasyNovel ${version}`, '--notes-file', notesFile])

console.log(`\n✔ Publicada la versión ${version}`)
