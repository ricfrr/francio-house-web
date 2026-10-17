---
# Copy this file into src/content/events/, rename it to YYYY-MM-DD-artist-name.md
# and fill it in (or run: npm run new-event -- "Artist Name" YYYY-MM-DD).

title: Nome della serata             # e.g. "Notturno Tropicale" (can be the same as artist)
artist: Artist Name                 # the big name
lineup: [Support Act, DJ Someone]   # optional, other names on the bill
genre: dream-pop · tropicália       # optional, one short line

date: 2026-12-31                    # YYYY-MM-DD
time: "21:00"                       # when the music starts — keep the quotes
doors: "20:30"                      # optional
end: "00:30"                        # optional — after midnight is fine

poster: ./posters/artist-name.jpg   # put the image in src/content/events/posters/
posterAlt: Descrivi il manifesto in una frase, per chi non può vederlo.
# color: "#ff3d7f"                  # optional — otherwise picked from the poster

summary: Una o due frasi. Compaiono sulle card e quando il link viene condiviso.
# entry: Ingresso libero · le offerte vanno agli artisti   # optional, this is the default
rsvp: https://docs.google.com/forms/...   # the booking form link, or a sentence like "Su prenotazione"

links:                              # any you have, delete the rest
  spotify: https://open.spotify.com/artist/...
  instagram: https://www.instagram.com/...
  website: https://...
  bandcamp: https://....bandcamp.com/

# After the night:
# recordings:
#   - label: Il live completo (YouTube)
#     labelEn: Full live set (YouTube)
#     url: https://www.youtube.com/watch?v=...
# photos:
#   - ./photos/artist-name-1.jpg

# English versions (optional — anything missing is shown in Italian):
en:
  title: Name of the night
  summary: One or two sentences, in English.
  posterAlt: Describe the poster in one sentence.
  # genre: ...
  # entry: Free entry · donations go to the artists

draft: false                        # true = hidden on the live site
---

Breve descrizione dell'artista in italiano: un paio di frasi, una curiosità o un disco, con link a recensioni o video se disponibili.
Per gli eventi passati, evita orari, prezzi, snack e drink già sulla locandina e biografie troppo dettagliate.
Markdown normale: **grassetto**, *corsivo*, [link](https://...).

<!-- en -->

A short artist description in English: a couple of sentences, a curiosity or a record, with links to reviews or videos if available.
For past events, leave out times, prices, snacks and drinks already on the poster and lengthy biographies.
Delete this part (and the line above) if there's no English text.
