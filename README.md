# Page Annotator

Disegna annotazioni SVG a mano libera sopra qualsiasi pagina o post di WordPress. I tratti vengono salvati come post meta e ridisegnati sul frontend come overlay non interattivo, con animazioni di stroke attivate dallo scroll (GSAP ScrollTrigger).

## Cosa fa

- **Editor di disegno** che si apre sul frontend del contenuto reale (`?annotation=true`), caricato dentro un iframe in modalità preview, così disegni esattamente sopra il layout vero.
- Tratti organizzati in **layer**, con undo, duplica/sposta/rinomina, selezione ed eliminazione dei singoli path.
- Due **slot** di annotazione (`cover` e `scribbles`) e due **breakpoint** (desktop / mobile), gestiti in modo indipendente.
- Sul frontend i tratti si animano allo scroll secondo lo **stile** e il **timing** scelti nelle impostazioni.
- **Thumbnail virtuale**: se un post ha un disegno nello slot `cover` e nessuna immagine in evidenza, `has_post_thumbnail()` / `get_the_post_thumbnail()` restituiscono l'SVG inline.

## Come funziona

- **Editor**: app React (`@wordpress/element`) buildata in `editor/build`, caricata solo con `?annotation=true` e permesso `edit_posts`. Un bottone "Aggiungi annotazioni" nel pannello Gutenberg apre l'editor.
- **Dati**: due post meta per ogni post type pubblico — `_page_annotator_svg` (markup) e `_page_annotator_timeline` (punti del tratto con `startTime`/`duration` per l'animazione).
- **API**: namespace REST `page-annotator`, rotta `/annotations/{post_id}` (GET/POST). L'SVG salvato è sanitizzato con `wp_kses`.
- **Frontend**: `frontend.js` legge i dati via `wp_localize_script` e anima i path con GSAP + ScrollTrigger (caricati da CDN).

## Impostazioni

In *Impostazioni → Page Annotator*:

- **Stile animazione**: none, smooth, stepped, fast, elastic, rough.
- **Timing**: sequenziale o simultaneo.
- **Reverse on scroll**: cancella i tratti uscendo dal viewport e li ridisegna al ritorno.
- **Stroke widths**: spessori disponibili nell'editor (qualsiasi unità, separati da virgola).

## Requisiti

WordPress 6.0+, PHP 7.4+.
