# BlueFantasyNovel

**Un estudio de escritura para novelistas, gratuito, sin conexión y sin suscripciones.**

Escribe tu novela y construye su mundo en el mismo sitio: capítulos y escenas,
personajes, relaciones, linajes, razas, lore, glosario, bestiario, tramas,
línea temporal, mapas, cubierta en 3D… Todo se guarda **en tu ordenador**, en
archivos que puedes abrir y copiar. No hay cuentas, no hay anuncios y nadie lee
lo que escribes.

Es de **dominio público**: úsalo, modifícalo, compártelo o haz tu propia
versión sin pedir permiso a nadie (ver [Licencia](#licencia)).

---

## Descargar

Ve a la página de **[Releases](../../releases)** y descarga:

| Archivo | Para qué |
|---|---|
| `BlueFantasyNovel-Setup-<versión>.exe` | **Instalador** (recomendado). Crea accesos directos y se desinstala desde Windows |
| `BlueFantasyNovel-Portable-<versión>.exe` | **Portable**: un solo archivo que funciona sin instalar, también desde un pendrive |

Funciona en **Windows 10 y 11**. En macOS y Linux se puede compilar desde el
código, aunque no está probado.

> **«Windows protegió su PC».** Aparece porque el programa no está firmado con un
> certificado de pago, no porque sea peligroso. Pulsa **Más información →
> Ejecutar de todas formas**. Si prefieres no fiarte de un .exe, puedes
> compilarlo tú mismo desde el código (ver [Para desarrolladores](#para-desarrolladores)).

---

## Qué puedes hacer

### Escribir
- **Editor sin distracciones** con formato, autoguardado y modo enfoque a pantalla completa (F11).
- **Capítulos y escenas**: separa escenas con ✦ ✦ ✦ y aparecen bajo cada capítulo; un clic te lleva a ellas.
- **Borradores**: ideas, escenas descartadas o finales alternativos que no cuentan para el libro.
- **Comentarios al margen**: selecciona un fragmento y déjate una nota para la revisión.
- **Historial de versiones** de cada capítulo, con vista previa y restaurar.
- **Buscar y reemplazar** en todo el manuscrito (Ctrl+Mayús+F).
- **Detector de muletillas**, corrector ortográfico en español, contador de palabras y tiempo de lectura.
- **Sprints de escritura** con cronómetro, **objetivo diario** y rachas.

### Construir el mundo
- **Personajes** con retrato, raza, linaje, psicología, motivaciones y arco.
- **Mapa de relaciones** interactivo y **árbol genealógico** que se dibuja solo, coloreado por linaje.
- **Linajes** (casas, dinastías, clanes) y **razas**.
- **Lore** por categorías, **glosario** de términos inventados y **bestiario** con nivel de peligro.
- **Línea temporal** con zoom y **calendario propio** del mundo (meses y era a tu medida).
- **Mapas**: sube tu mapa y clava chinchetas enlazadas a los lugares.
- **Tableros de inspiración** con imágenes de referencia.
- **Mapa de tramas**: qué avanza cada trama en cada capítulo.

### Mientras escribes
- Los nombres de tus personajes, lugares, criaturas y términos se **reconocen en el texto**; pasa el ratón por encima y verás su ficha.
- **Panel de consulta** junto al texto para repasar fichas sin cambiar de pantalla.
- Cada ficha te dice **en qué capítulos aparece**.

### Sagas
Une varias novelas en una **saga** y compartirán el mismo mundo: si cambias una
raza o un personaje en un libro, cambia en todos.

### Compartir
- Exporta el manuscrito a **Word, PDF (formato libro), ePub, página web, Markdown o texto**.
- Exporta la **Biblia del Mundo** (todo el worldbuilding con imágenes) a PDF, Word o página web.
- **Diseña la cubierta** y mírala en **3D**, como quedaría impresa.
- Crea **tarjetas para redes sociales**: citas, cubierta, personajes, mapas, resumen del mundo y cifras.

---

## Tus historias están a salvo

- Se guardan en **`Documentos\BlueFantasyNovel`**, una carpeta por historia.
  Actualizar o desinstalar el programa no las toca.
- **Copias en la nube en un clic**: si tienes OneDrive (viene con Windows),
  Google Drive para ordenadores, Dropbox o iCloud, la aplicación los detecta.
  Pulsa **Activar copias** y elige uno: desde entonces se hace una copia al
  abrir y al cerrar el programa, y se guardan las de los últimos 14 días.
- **¿Ordenador nuevo?** Instala el programa, inicia sesión en tu nube y pulsa
  **Restaurar desde una copia**.
- Nada sale de tu equipo: el programa **no se conecta a internet** (salvo lo que
  sincronice tu propio servicio de nube).

---

## Primeros pasos

1. Crea una historia con **Nueva historia**.
2. Escribe en el primer capítulo. Para empezar una escena nueva, pulsa el botón
   del separador (✦) en la barra de herramientas.
3. Crea algún personaje en **Personajes** y vuelve al texto: su nombre aparecerá
   subrayado y verás su ficha al pasar el ratón.
4. Activa las copias de seguridad cuando te lo proponga la biblioteca.

### Atajos de teclado

| Atajo | Acción |
|---|---|
| Ctrl+S | Guardar ahora (aunque se guarda solo) |
| Ctrl+Mayús+F | Buscar y reemplazar en todo el manuscrito |
| F11 | Modo enfoque |
| Ctrl+B / Ctrl+I / Ctrl+U | Negrita / cursiva / subrayado |
| Ctrl+Z / Ctrl+Y | Deshacer / rehacer |
| Doble clic en un capítulo o en el título de la historia | Renombrar |
| Ctrl + rueda (línea temporal) · rueda (mapas) | Acercar / alejar |

---

## Preguntas frecuentes

**¿Es gratis de verdad?** Sí, y lo seguirá siendo: es de dominio público.

**¿Necesito internet?** No. Solo si quieres copias en la nube, y eso lo hace tu
propio servicio (OneDrive, Google Drive…).

**¿Puedo usar lo que escriba aquí para publicar?** Por supuesto. Tus textos son
tuyos y el programa no reclama nada sobre ellos.

**¿Puedo abrir mis historias sin el programa?** Sí. Son archivos JSON legibles,
y además puedes exportarlas a Word, PDF, ePub, etc. cuando quieras.

**¿Puedo usarlo en dos ordenadores?** Sí, con la copia en la nube y
«Restaurar». No edites la misma historia en los dos a la vez.

---

## Para desarrolladores

Hecho con [Electron](https://www.electronjs.org/), [React](https://react.dev/) y
[TypeScript](https://www.typescriptlang.org/). Editor con [TipTap](https://tiptap.dev/),
diagramas con [React Flow](https://reactflow.dev/), exportación con
[docx](https://docx.js.org/) y [JSZip](https://stuk.github.io/jszip/), iconos de
[Lucide](https://lucide.dev/).

Necesitas [Node.js](https://nodejs.org/) 20 o superior.

```bash
npm install        # instala dependencias (descarga Electron, ~100 MB)
npm run dev        # abre la aplicación en modo desarrollo con recarga en caliente
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Modo desarrollo (la interfaz se recarga sola al guardar) |
| `npm run build` | Compila todo a `out/` |
| `npm run preview` | Ejecuta la versión compilada |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm run dist` | Genera el instalador y la versión portable en `release/` |
| `npm run release` | Publica una versión nueva en GitHub (ver abajo) |

### Publicar una versión nueva

Con todos los cambios ya en commits y [GitHub CLI](https://cli.github.com/)
con la sesión iniciada (`gh auth login`):

```bash
npm run release              # 0.5.0 → 0.5.1 (correcciones)
npm run release -- minor     # 0.5.0 → 0.6.0 (funciones nuevas)
npm run release -- major     # 0.5.0 → 1.0.0
npm run release -- --dry-run # muestra lo que haría, sin cambiar nada
```

El comando sube el número de versión, comprueba los tipos, genera los .exe,
crea el commit y la etiqueta, los sube a GitHub y publica la Release con los
instaladores adjuntos y la lista de cambios (los mensajes de los commits
desde la versión anterior). Ver `scripts/release.mjs`.

- **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**: cómo está organizado el código,
  el formato de los datos y recetas paso a paso para añadir funciones.
- **[docs/ROADMAP.md](docs/ROADMAP.md)**: lo que ya está hecho e ideas para el futuro.

### Contribuir

Cualquier aportación es bienvenida: correcciones, mejoras, traducciones,
funciones nuevas… Haz un *fork*, crea una rama y abre un *pull request*. Si
encuentras un fallo, abre una *issue* contando qué hiciste y qué pasó.

Y si prefieres llevártelo y hacer tu propia versión, adelante: para eso es de
dominio público.

---

## Licencia

**Dominio público** ([The Unlicense](LICENSE)). Puedes copiar, modificar,
distribuir y usar este programa con cualquier fin, comercial o no, sin pedir
permiso y sin citar a nadie.

Las librerías de terceros que incluye (Electron, React, TipTap, React Flow,
docx, JSZip, Lucide y otras) mantienen sus propias licencias libres (MIT, ISC y
similares), que permiten este uso.
