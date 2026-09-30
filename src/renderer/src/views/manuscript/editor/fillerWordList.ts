/**
 * Muletillas y palabras "de relleno" que se resaltan en el editor cuando se
 * activa el detector.
 *
 * No son errores: a veces son la palabra correcta. El detector solo ayuda a
 * verlas en la revisión. Edita esta lista libremente; admite expresiones de
 * varias palabras ("de repente"). No distingue mayúsculas, pero SÍ tildes,
 * así que incluye ambas variantes cuando existan ("solo" / "sólo").
 */
export const DEFAULT_FILLER_WORDS: string[] = [
  // Intensificadores vacíos
  'muy',
  'realmente',
  'verdaderamente',
  'totalmente',
  'completamente',
  'absolutamente',
  'literalmente',
  'bastante',
  'demasiado',
  // Adverbios comodín
  'básicamente',
  'simplemente',
  'obviamente',
  'claramente',
  'prácticamente',
  'definitivamente',
  'justo',
  'solo',
  'sólo',
  'apenas',
  // Vaguedades
  'algo',
  'cosa',
  'cosas',
  'un poco',
  'de alguna manera',
  'de algún modo',
  'en realidad',
  'un tanto',
  // Muletillas narrativas
  'de repente',
  'de pronto',
  'repentinamente',
  'entonces',
  'empezó a',
  'comenzó a',
  'se dio cuenta',
  'pareció',
  'parecía'
]
