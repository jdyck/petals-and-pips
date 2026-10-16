// decode() waits for both the download and image decoding, including cache hits.
export async function loadGameBackground(source: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
}
