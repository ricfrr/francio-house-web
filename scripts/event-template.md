---
# Copy this file into src/content/events/, rename it to YYYY-MM-DD-artist-name.md
# and fill it in (or run: npm run new-event -- "Artist Name" YYYY-MM-DD).

title: Name of the night            # e.g. "Notturno Tropicale" (can be the same as artist)
artist: Artist Name                 # the big name
lineup: [Support Act, DJ Someone]   # optional, other names on the bill
genre: dream-pop · tropicália       # optional, one short line

date: 2026-12-31                    # YYYY-MM-DD
time: "21:00"                       # when the music starts — keep the quotes
doors: "20:30"                      # optional
end: "00:30"                        # optional — after midnight is fine

poster: ./posters/artist-name.jpg   # put the image in src/content/events/posters/
posterAlt: Describe the poster in one sentence for people who can't see it.
# color: "#ff3d7f"                  # optional — otherwise picked from the poster

summary: One or two sentences. Shown on cards and when the link is shared.
entry: Free entry · donations go to the artists
rsvp: https://www.instagram.com/francio.house/   # a link, or a sentence like "DM us on Instagram"

links:                              # any you have, delete the rest
  spotify: https://open.spotify.com/artist/...
  instagram: https://www.instagram.com/...
  website: https://...
  bandcamp: https://....bandcamp.com/

# After the night:
# recordings:
#   - label: Full live set (YouTube)
#     url: https://www.youtube.com/watch?v=...
# photos:
#   - ./photos/artist-name-1.jpg

draft: false                        # true = hidden on the live site
---

Write the longer description here. Normal Markdown: **bold**, *italic*, [links](https://...).
