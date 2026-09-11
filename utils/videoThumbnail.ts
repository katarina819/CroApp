// utils/videoThumbnail.ts
//
// Sličica videa, napravljena na telefonu pri objavi.
//
// U profilu ("Moje" i "Spremljeno") video se prikazivao samo kao ikona
// kamere: slike su imale pregled jer je sama datoteka slika, a videi nisu
// imali ništa jer sličica nigdje u sustavu nije postojala. Radi je telefon,
// a ne poslužitelj — izvlačenje kadra na poslužitelju tražilo bi ffmpeg u
// slici kontejnera i produžilo svaku objavu.

import * as VideoThumbnails from "expo-video-thumbnails";

/** Kadar koji se uzima kao sličica (ms od početka). */
const THUMBNAIL_AT_MS = 1000;

/** Kvaliteta JPEG-a: sličica se prikazuje malena, ne treba biti oštra. */
const THUMBNAIL_QUALITY = 0.6;

/**
 * Vraća lokalni URI sličice za zadani video, ili null ako je nije bilo
 * moguće napraviti.
 *
 * Namjerno ne baca grešku: sličica je ugodnost, a ne uvjet objave — video
 * bez nje i dalje prolazi i prikazuje se sa starom ikonom kamere.
 */
export async function createVideoThumbnail(
  videoUri: string,
): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      // Neki vrlo kratki videi nemaju kadar na 1s — tada biblioteka uzme
      // najbliži dostupni.
      time: THUMBNAIL_AT_MS,
      quality: THUMBNAIL_QUALITY,
    });
    return uri;
  } catch {
    return null;
  }
}
