/**
 * Split a track's artist string (e.g. "Lil Uzi Vert x Playboi Carti") into
 * individual artist names so the song is attributed to each artist instead
 * of creating a single combined "collab" artist.
 */
const COLLAB_SEPARATORS = [
  " x ",
  " & ",
  " and ",
  " feat. ",
  " ft. ",
  " feat ",
  " ft ",
  ", ",
];

export function parseArtistNames(artistString: string): string[] {
  const raw = (artistString ?? "").trim();
  if (!raw || raw.toLowerCase() === "unknown artist") return [];

  let parts: string[] = [raw];
  for (const sep of COLLAB_SEPARATORS) {
    parts = parts.flatMap((p) => p.split(sep).map((s) => s.trim()).filter(Boolean));
  }
  return [...new Set(parts)];
}
