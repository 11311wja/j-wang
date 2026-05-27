function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rr:
        h = (gg - bb) / d + (gg < bb ? 6 : 0);
        break;
      case gg:
        h = (bb - rr) / d + 2;
        break;
      default:
        h = (rr - gg) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
}

export async function extractDominantHue(imageSource) {
  const image = await loadImage(imageSource);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const sampleWidth = 48;
  const sampleHeight = 48;

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let totalHue = 0;
  let totalWeight = 0;

  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.5) {
      continue;
    }

    const { h, s, l } = rgbToHsl(pixels[index], pixels[index + 1], pixels[index + 2]);
    const saturationWeight = Math.max(0.08, s);
    const lightnessWeight = 1 - Math.abs(l - 0.55);
    const weight = saturationWeight * lightnessWeight;

    totalHue += h * weight;
    totalWeight += weight;
  }

  return Math.round(totalWeight ? totalHue / totalWeight : 210);
}

function loadImage(imageSource) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = imageSource;
  });
}
