# Arquitectura

Guía para quien vaya a mantener o ampliar BlueFantasyNovel.

## Visión general

Es una aplicación [Electron](https://www.electronjs.org/), así que el código se
reparte en tres procesos que se compilan por separado (ver `electron.vite.config.ts`):

```
┌──────────────────────────┐   window.api    ┌──────────────┐   IPC    ┌─────────────────────────────┐
│ renderer (React)         │ ──────────────▶ │ preload      │ ───────▶ │ main (Node.js)              │
│ Interfaz. Sin acceso a   │                 │ contextBridge│          │ Ventana, disco, diálogos,    │
│ Node ni al disco.        │ ◀────────────── │              │ ◀─────── │ exportación, copias.         │
└──────────────────────────┘   Promesas      └──────────────┘          └─────────────────────────────┘
                     ▲                                                              ▲
                     └──────────────── src/shared (tipos y utilidades puras) ───────┘
```

- La interfaz **nunca** toca el disco. Todo pasa por `window.api`.
- El proceso principal devuelve **el proyecto completo actualizado** tras cada
  cambio. La interfaz simplemente lo sustituye en su estado; así nunca se
  desincroniza del disco.
- La ventana usa `contextIsolation`, `sandbox` y una política CSP estricta.

## Estructura de carpetas

```
src/
├── shared/                   Código común a los tres procesos (sin dependencias de Node ni del DOM)
│   ├── types.ts              Modelo de datos (Project y todas las fichas, ajustes, búsqueda…)
│   ├── api.ts                Contrato IPC: nombres de canal + interfaz BlueFantasyApi
│   ├── assets.ts             Imágenes: protocolo bfn-asset://, extensiones y validación de nombres
│   ├── assetRefs.ts          Localiza/valida referencias a imágenes dentro de cualquier ficha
│   ├── mentions.ts           Detección de nombres y alias en el texto (editor y análisis)
│   ├── manuscript.ts         Capítulos del manuscrito (sin borradores) y cálculo de escenas
│   ├── cover.ts              Portada: plantillas, tipografías, medidas del libro y grosor del lomo
│   ├── labels.ts             Nombres visibles de roles, categorías, tipos y relaciones
│   ├── calendar.ts           Calendario del mundo: orden y formato de fechas de eventos
│   ├── richText.ts           Conversión del JSON del editor a texto, Markdown y HTML
│   ├── text.ts               Contador de palabras, formato de números, tiempo de lectura
│   └── dates.ts              Claves de día y cálculo de rachas
│
├── main/                     Proceso principal
│   ├── index.ts              Arranque, ventana, cierre seguro, copia de seguridad diaria
│   ├── ipc.ts                Manejadores IPC → repositorio / exportador / ajustes
│   ├── assets.ts             Protocolo bfn-asset:// y diálogo «Elegir imagen(es)»
│   ├── settings.ts           Ajustes de la app (settings.json en %APPDATA%)
│   ├── backup.ts             Copias de seguridad: crear, podar, al abrir/cerrar, restaurar
│   ├── cloudFolders.ts       Detecta Google Drive, OneDrive, Dropbox e iCloud en el equipo
│   ├── storage/
│   │   ├── ProjectRepository.ts   Lectura/escritura de proyectos, versiones, búsqueda, menciones, sagas
│   │   ├── entityDefaults.ts      Valores por defecto de cada tipo de ficha
│   │   ├── manuscriptSearch.ts    Buscar y reemplazar dentro de los capítulos
│   │   ├── fsUtils.ts             Escritura atómica, validación de ids
│   │   └── migrations.ts          Migraciones del formato de datos
│   └── export/
│       ├── index.ts          Diálogo "Guardar como" y registro de formatos
│       ├── manuscript.ts     Carga el proyecto con el texto de todos los capítulos
│       ├── docx.ts           Word
│       ├── pdf.ts            PDF (maqueta HTML e imprime con Chromium) + htmlToPdf genérico
│       ├── epub.ts           ePub 3 (ZIP con JSZip)
│       ├── html.ts           Página web autónoma del manuscrito
│       ├── bible.ts          Biblia del Mundo: carga de datos e imágenes + HTML (y PDF)
│       └── bibleDocx.ts      Biblia del Mundo en Word
│
├── preload/
│   └── index.ts              Expone window.api (implementa BlueFantasyApi)
│
└── renderer/
    ├── index.html
    └── src/
        ├── main.tsx, App.tsx       Arranque y navegación Biblioteca ⇄ Proyecto
        ├── styles/                 tokens.css (colores de ambos temas, fuentes) y base.css
        ├── lib/                    api, ajustes (tema), guardados pendientes, formateo, portadas
        ├── hooks/                  useDebouncedSave, useEntityForm, useLocalPreference
        ├── components/             Modal, ConfirmDialog, Toasts, ExportMenu, SettingsDialog,
        │                           EntityBrowser (lista + ficha), ImagePicker, EntityThumb, SaveBadge,
        │                           ListInput, AppearancesPanel, ImportEntitiesDialog
        └── views/
            ├── library/            Biblioteca de historias
            ├── workspace/          Contenedor del proyecto: barra lateral, capítulos, secciones, sprints
            ├── manuscript/         Editor (TipTap) y todo lo que cuelga de él:
            │   ├── editor/         Barra, estado, referencia y comentarios, muletillas, menciones,
            │   │                   marca de comentario, historial, sprints
            │   └── SearchDialog    Buscar y reemplazar en todo el manuscrito
            ├── plots/              Mapa de tramas
            ├── cover/              Diseño de cubierta y libro 3D (CSS 3D)
            ├── cards/              Tarjetas para redes (canvas)
            ├── characters/         Personajes
            ├── relations/          Mapa de relaciones y árbol genealógico (@xyflow/react)
            ├── lineages/           Linajes
            ├── races/              Razas
            ├── glossary/           Glosario
            ├── lore/               Enciclopedia del mundo
            ├── bestiary/           Bestiario
            ├── timeline/           Línea temporal y calendario del mundo
            ├── maps/               Mapas con chinchetas
            ├── boards/             Tableros de inspiración
            └── stats/              Estadísticas, objetivos y sprints
```

Cada vista lleva su propio `.css` al lado. Los colores salen **siempre** de
las variables de `styles/tokens.css`.

## Formato de datos

Carpeta: `Documentos\BlueFantasyNovel\` (constante `LIBRARY_FOLDER_NAME` en `src/main/index.ts`).

```
BlueFantasyNovel/
└── <projectId>/
    ├── project.json
    ├── chapters/
    │   ├── <chapterId>.json
    │   └── .versions/<chapterId>/<marca de tiempo>.json   historial de versiones
    └── assets/
        └── <uuid>.png|jpg|webp|gif   imágenes (retratos, ilustraciones, mapas, tableros)
```

### project.json (esquema 4)

```jsonc
{
  "schemaVersion": 4,
  "id": "ad79b8cb-…",
  "title": "Las Crónicas del Mar Azul",
  "description": "…",
  "genre": "Fantasía épica",
  "wordGoal": 80000,                  // objetivo del manuscrito (0 = sin objetivo)
  "dailyGoal": 500,                   // objetivo diario
  "createdAt": "…", "updatedAt": "…",
  "chapters": [                       // en orden de lectura; SIN el texto
    { "id": "…", "title": "La torre de cristal", "wordCount": 143,
      "draft": false,                   // true = borrador (fuera del manuscrito)
      "scenes": [{ "title": "El faro", "wordCount": 60, "separatorsBefore": 0 }],  // caché, se recalcula al guardar
      "createdAt": "…", "updatedAt": "…" }
  ],
  "characters": [
    { "id": "…", "name": "Aelis Varen", "aliases": ["Aelis", "la cartógrafa"], "role": "protagonista",
      "age": "19", "color": "#5b8cff", "appearance": "…", "personality": "…", "motivation": "…",
      "fears": "…", "arc": "…", "notes": "…", "raceId": "…", "lineageId": null,
      "image": "3f2a…c1.png",           // archivo en assets/ ('' = sin imagen)
      "createdAt": "…", "updatedAt": "…" }
  ],
  "lore": [
    { "id": "…", "title": "Torre de Cristal", "aliases": [], "category": "lugar", "summary": "…",
      "body": "…", "tags": ["misterio"], "image": "", "createdAt": "…", "updatedAt": "…" }
  ],
  "creatures": [
    { "id": "…", "name": "Dragón de las profundidades", "aliases": [], "type": "dragon", "danger": 5,
      "habitat": "…", "size": "…", "appearance": "…", "behavior": "…", "abilities": "…",
      "weaknesses": "…", "notes": "…", "image": "", "createdAt": "…", "updatedAt": "…" }
  ],
  "relationships": [                  // "progenitor" es dirigida: origen = padre/madre de destino
    { "id": "…", "sourceId": "<personaje>", "targetId": "<personaje>", "kind": "progenitor",
      "label": "", "notes": "", "createdAt": "…", "updatedAt": "…" }
  ],
  "relationLayout": { "<personajeId>": { "x": 120, "y": 80 } },   // posiciones en el mapa de relaciones
  "calendar": { "eraName": "d.C.", "months": [{ "name": "Enero", "days": 31 }, …] },
  "events": [
    { "id": "…", "title": "Nace Aelis", "description": "", "year": 341, "month": 2, "day": 3,
      "color": "#5b8cff", "characterIds": ["…"], "loreIds": [], "chapterId": null,
      "createdAt": "…", "updatedAt": "…" }            // month: índice en calendar.months (null = solo año)
  ],
  "maps": [
    { "id": "…", "name": "Mar Azul", "image": "…png",
      "pins": [{ "id": "…", "x": 0.3, "y": 0.4, "label": "", "color": "#e8577a", "loreId": "…" }],
      "createdAt": "…", "updatedAt": "…" }           // x, y relativos a la imagen (0–1)
  ],
  "boards": [
    { "id": "…", "name": "Ambiente", "description": "",
      "items": [{ "id": "…", "image": "…png", "caption": "" }], "createdAt": "…", "updatedAt": "…" }
  ],
  "races": [{ "id": "…", "name": "Veloritas", "aliases": [], "appearance": "…", "lifespan": "…", "homeland": "…",
               "culture": "…", "abilities": "…", "notes": "…", "color": "#b86bd9", "image": "", … }],
  "glossary": [{ "id": "…", "term": "Ojo de Sal", "aliases": [], "definition": "…", "category": "idioma", … }],
  "lineages": [{ "id": "…", "name": "Casa Varen", "aliases": [], "motto": "…", "description": "…",
                 "seatLoreId": null, "color": "#e8c46a", "image": "", … }],
  "plotlines": [{ "id": "…", "name": "Trama principal", "description": "…", "color": "#5b8cff",
                  "beats": { "<capítuloId>": "Qué pasa en esta trama en ese capítulo" }, … }],
  "comments": [{ "id": "…", "chapterId": "…", "quote": "…", "text": "…", "resolved": false, … }],
  "cover": { "template": "noche", "front": { "image": "…", "dim": 0.35 }, "spine": { … }, "back": { … },
             "title": "…", "author": "…", "subtitle": "…", "backText": "…", "font": "serif-clasica",
             "titleSize": 0.11, "titlePosition": "top" },
  "dailyWords": { "2026-09-29": 199 }, // palabras NUEVAS por día (hora local); solo suma
  "sessions": [{ "start": "…", "minutes": 25, "words": 640 }]     // sprints terminados
}
```

Además, en la raíz de la biblioteca, `sagas.json` guarda las sagas:

```json
{ "sagas": [{ "id": "…", "name": "Saga del Mar Azul", "projectIds": ["…", "…"] }] }
```

### chapters/&lt;id&gt;.json

El documento del editor en el formato JSON de ProseMirror/TipTap:

```json
{ "type": "doc", "content": [
  { "type": "paragraph", "content": [{ "type": "text", "text": "Érase una vez…" }] }
]}
```

Las versiones (`.versions/…`) guardan `{ createdAt, wordCount, doc }`. Se crea
una como máximo cada 10 minutos de escritura por capítulo, además de antes de
restaurar y antes de un reemplazo global. Se conservan las 50 más recientes.

### Garantías de guardado

- **Escritura atómica** (`fsUtils.writeJsonAtomic`): se escribe en un `.tmp` y se
  renombra. Un corte de luz nunca deja un archivo a medias.
- **Operaciones serializadas por proyecto** (`ProjectRepository.mutate` / `withLock`):
  el autoguardado y, por ejemplo, editar un personaje no se pisan.
- **Autoguardado con retraso** (`useDebouncedSave`): 800 ms en el editor, 600 ms en fichas.
- **Cierre seguro**: al cerrar la ventana, `main` pide a la interfaz que vacíe
  sus guardados pendientes (`lib/pendingSaves.ts`) y espera hasta 4 s.
- **Palabras de hoy**: al guardar un capítulo, si ha crecido, la diferencia se
  suma a `dailyWords[hoy]`. Borrar texto no resta (es un registro de trabajo, no de tamaño).

### Fichas

Todo lo que no es texto del manuscrito es una **ficha** de una colección:
`characters`, `lore`, `creatures`, `relationships`, `events`, `maps`, `boards`.
Comparten ciclo de vida, así que el almacenamiento (`createEntity` /
`updateEntity` / `deleteEntity`) y la API (`api.entities.*`) son genéricos y
reciben la colección. El mapa `EntityMap` de `src/shared/types.ts` es la única
lista de colecciones.

Al borrar una ficha se limpian las referencias a ella (`removeReferences` en
el repositorio): las relaciones y eventos de un personaje, las chinchetas que
apuntaban a una entrada de lore, etc.

### Imágenes

1. `api.assets.pickImage(s)(projectId)` abre el selector, **copia** los archivos a
   `assets/<uuid>.<ext>` y devuelve sus nombres.
2. La interfaz los asigna a la ficha con `api.entities.update(...)`.
3. **Convención:** toda propiedad llamada `image`, a cualquier profundidad
   (retrato, `pins`, `items` de un tablero…), es un nombre de asset o `''`.
   Gracias a eso el repositorio valida y limpia imágenes sin conocer la forma
   de cada ficha (`shared/assetRefs.ts`): tras cada cambio o borrado, las
   imágenes que ya no usa ninguna ficha se eliminan del disco.
4. La interfaz las muestra con URLs `bfn-asset://project/<projectId>/<archivo>`,
   que atiende `src/main/assets.ts`. Solo sirve nombres `uuid.ext` de la carpeta
   `assets/` del proyecto; cualquier otra ruta devuelve 404.

### Escenas, borradores y comentarios

- **Escenas:** `shared/manuscript.ts > computeScenes` divide el documento por sus
  separadores (línea horizontal). Se guardan como caché en `chapter.scenes` cada
  vez que se guarda el capítulo; la barra lateral las lista y, al hacer clic, el
  editor se desplaza al separador número `separatorsBefore`.
- **Borradores:** `chapter.draft`. `manuscriptChapters()` y `manuscriptWordCount()`
  son la única regla de qué cuenta como manuscrito (exportaciones, total,
  objetivo, estadísticas). Las palabras escritas en borradores sí cuentan para
  el registro diario y los sprints.
- **Comentarios:** marca de TipTap `comment` con `commentId` en el texto
  (`views/manuscript/editor/CommentMark.ts`) + ficha en `project.comments`.
  Resolver o borrar quita la marca del texto. Las exportaciones ignoran la marca.

### Sagas (mundo compartido)

Cada historia conserva su propia copia de las fichas del mundo
(`WORLD_COLLECTIONS`: personajes, relaciones, linajes, razas, lore, glosario y
bestiario), pero el repositorio replica al momento cada alta, cambio o baja en
las demás historias de la saga (`syncToSaga` / `syncDeleteToSaga`), copiando las
imágenes necesarias. Al crear una saga o añadir una historia, `mergeWorld` une
las fichas de todas (si una ficha difiere, gana la editada más recientemente).
Así cada carpeta de historia sigue siendo autocontenida (copias de seguridad,
exportación, abrirla sola) y el mundo se comporta como uno solo.

Capítulos, tramas, eventos, mapas, tableros, comentarios y portada son de cada libro.

### Portada

`project.cover` guarda el diseño. La vista 3D (`views/cover/Book3D.tsx`) es CSS
puro (`transform-style: preserve-3d`): seis caras colocadas en el espacio con las
medidas de un libro de 15,24 × 22,86 cm y un lomo calculado a partir de las
palabras (`shared/cover.ts`). `lib/coverRender.ts` dibuja la misma portada en un
canvas para descargarla como PNG y para la tarjeta «Portada». Para poder
exportar un canvas con imágenes del proyecto, el protocolo `bfn-asset://` se
registra con `corsEnabled` y responde con `Access-Control-Allow-Origin`.

### Menciones

`shared/mentions.ts` construye una expresión regular con los nombres y alias de
personajes, linajes, razas, lore, criaturas y glosario (el más largo primero,
palabras completas). Los nombres propios distinguen mayúsculas (los alias en
minúscula también valen con mayúscula inicial); razas y glosario no, porque en
el texto suelen ir en minúscula. La usan:
- el editor (`views/manuscript/editor/Mentions.ts`), que subraya las menciones
  y muestra la ficha al pasar el ratón;
- `ProjectRepository.analyzeMentions`, que cuenta en qué capítulos aparece
  cada ficha ("Apariciones").

### Ajustes

Los ajustes (tema, tipografía del editor, copias) son del **equipo**, no de la
historia: se guardan en `%APPDATA%\BlueFantasyNovel\settings.json`
(`main/settings.ts`). La interfaz los aplica en `lib/settings.tsx` (atributo
`data-theme` y variables `--editor-*`).

### Copias de seguridad

Objetivo: que cualquier usuario tenga sus historias a salvo en la nube sin
conocimientos técnicos y sin credenciales.

- **Destino:** en vez de hablar con APIs de Google/Microsoft (OAuth, claves,
  verificaciones), las copias se escriben en la carpeta local que ya sincroniza
  el programa oficial del servicio. `main/cloudFolders.ts` detecta Google Drive
  (unidades `X:\Mi unidad` / `My Drive` o carpeta en el perfil), OneDrive
  (variables de entorno `OneDrive*`), Dropbox (`info.json`) e iCloud. La
  interfaz (`components/BackupPanel.tsx`) los ofrece como botones de un clic.
- **Formato:** cada copia es la biblioteca completa en
  `<destino>\BlueFantasyNovel (copias)\BlueFantasyNovel-copia-AAAA-MM-DD_hh-mm-ss\`.
- **Cuándo** (`BackupService` en `main/backup.ts`): al arrancar si la última
  tiene más de un día; al cerrar si hubo cambios (el repositorio avisa con
  `onChange` → `markDirty`); y a petición.
- **Retención:** la copia más reciente de cada día, de los últimos `keep` días.
- **Errores:** se guardan en `settings.backup.lastError` con un mensaje
  comprensible; la biblioteca muestra un aviso hasta que una copia salga bien.
- **Restaurar:** acepta la carpeta de copias (usa la más reciente) o una copia
  concreta. Añade las historias que falten y sustituye las existentes solo si
  la copia es más reciente (la versión local va antes a la Papelera).

### Cambiar el formato

1. Modifica los tipos en `src/shared/types.ts`.
2. Sube `CURRENT_SCHEMA_VERSION`.
3. Añade la migración en `src/main/storage/migrations.ts` y el valor por
   defecto en `withDefaults`.

Los proyectos antiguos se migran automáticamente al abrirse.

## Recetas

### Añadir una operación nueva (p. ej. "duplicar capítulo")

1. `src/shared/api.ts`: añade el canal a `IPC` y el método a `BlueFantasyApi`.
2. `src/main/storage/ProjectRepository.ts`: implementa la lógica (usa `mutate()`).
3. `src/main/ipc.ts`: registra el manejador.
4. `src/preload/index.ts`: expón el método (TypeScript avisará si falta).
5. Llama a `api.chapters.duplicate(...)` desde la interfaz.

### Añadir un tipo de ficha nuevo (p. ej. "Objetos mágicos")

Lore, Bestiario, Mapas e Inspiración se hicieron así; úsalos como plantilla.

1. `src/shared/types.ts`: define la interfaz, añádela a `EntityMap`, a
   `ENTITY_COLLECTIONS` y a `Project`. Si tiene imágenes, usa propiedades `image`.
2. Sube `CURRENT_SCHEMA_VERSION` y añade la migración que cree la lista vacía.
3. **No hace falta tocar** el repositorio, IPC ni preload: ya son genéricos.
   Si otras fichas la referencian, añade la limpieza en `removeReferences`.
4. Crea `src/renderer/src/views/<nombre>/` con:
   - `<Nombre>View.tsx`: un `<EntityBrowser>` indicando colección, ficha nueva
     por defecto, cómo pintar cada elemento y el formulario.
   - `<Nombre>Form.tsx`: usa `useEntityForm` e `ImagePicker`.
5. `views/workspace/sections.ts`: añade la sección a `SECTIONS` (con `collection`
   para que aparezca el contador) y su id a `WorkspaceSection`.
6. Añade su vista al objeto `views` de `ProjectWorkspace.tsx`.
7. Si debe poder nombrarse en el texto: añádela a `MentionableCollection`, a
   `mentionTargets` y a las pestañas (`TABS`) de `ReferencePanel.tsx`.

### Añadir un formato de exportación

Ver el comentario al principio de `src/main/export/index.ts`. Para la Biblia del
Mundo, `BIBLE_FORMATS` en el mismo archivo.

### Añadir un tipo de tarjeta para redes

`views/cards/SocialCardsDialog.tsx`: una entrada en `CARD_TYPES` y una función
de dibujo en `PAINTERS`.

### Añadir una plantilla de portada

`shared/cover.ts`: añade el id a `COVER_TEMPLATES` (en `types.ts`) y sus colores
a `COVER_TEMPLATE_INFO`.

### Editar la lista de muletillas

`src/renderer/src/views/manuscript/editor/fillerWordList.ts`.

### Cambiar colores

Todo sale de `src/renderer/src/styles/tokens.css`: el bloque `:root` es el
tema oscuro y `:root[data-theme='light']` el claro. Redefine las mismas variables.

## Decisiones técnicas

| Decisión | Motivo |
|---|---|
| Electron (no Tauri) | Solo requiere Node.js; Tauri exigiría instalar Rust y las herramientas de compilación de C++ |
| Archivos JSON (no SQLite) | Sin módulos nativos que compilar; el usuario puede ver, copiar y sincronizar sus datos. El texto ya está separado por capítulos |
| TipTap | Editor maduro basado en ProseMirror; guarda JSON estructurado, fácil de exportar a cualquier formato |
| PDF con `printToPDF` | Reutiliza el motor de Chromium de Electron; la maquetación es CSS normal |
| ePub con JSZip | ePub es un ZIP con XHTML; JSZip es JavaScript puro, sin binarios |
| @xyflow/react para diagramas | Arrastrar, conectar, zoom y minimapa resueltos; los nodos son componentes React normales |
| Línea temporal y mapas propios | Son sencillos (posiciones y transformaciones CSS); una librería añadiría peso sin ventaja |
| Sin gestor de estado global | El estado vive en `ProjectWorkspace` y baja por props; suficiente para el tamaño actual. Si crece mucho, considerar Zustand |
| Sin router | Solo hay dos pantallas de primer nivel |
| Imágenes copiadas al proyecto | El proyecto es autocontenido: se puede mover o sincronizar sin romper referencias |
| Protocolo propio para imágenes | La interfaz no tiene acceso a `file://`; el protocolo solo expone la carpeta `assets/` validada |
| Copias como carpetas, no ZIP | Se pueden abrir y recuperar sin herramientas |
| Sagas por réplica, no por carpeta compartida | Cada historia sigue siendo autocontenida (copias, exportar, abrir sola) y no hay que cambiar el formato de datos ni el resto de la app |
| Libro 3D con CSS | Suficiente para un libro (seis caras); evita cargar un motor 3D (WebGL) de varios MB |
| Escenas por separadores | El escritor ya las marca con ✦ ✦ ✦; no obliga a partir el texto en documentos distintos |

## Empaquetado

`npm run dist` compila y ejecuta [electron-builder](https://www.electron.build/)
con la configuración del campo `build` de `package.json`:

- `nsis`: instalador con elección de carpeta y accesos directos.
- `portable`: un único .exe sin instalación.
- El icono sale de `build/icon.png` (512×512, con transparencia).
- Los .exe no están firmados. Para firmarlos hace falta un certificado de firma
  de código (ver `win.signtoolOptions` en la documentación de electron-builder).
