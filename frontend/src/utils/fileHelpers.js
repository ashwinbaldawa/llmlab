export const rdTxt = (f) =>
  new Promise((r, j) => {
    const x = new FileReader();
    x.onload = () => r(x.result);
    x.onerror = () => j(Error("fail"));
    x.readAsText(f);
  });

export const rdB64 = (f) =>
  new Promise((r, j) => {
    const x = new FileReader();
    x.onload = () => r(x.result.split(",")[1]);
    x.onerror = () => j(Error("fail"));
    x.readAsDataURL(f);
  });

export const isImg = (f) => /\.(png|jpg|jpeg|webp)$/i.test(f.name);
export const isPdf = (f) => /\.pdf$/i.test(f.name);
export const isTxt = (f) => /\.(txt|md|csv|json|tsv|html|srt|vtt)$/i.test(f.name);

export const fmtSz = (b) =>
  b < 1024
    ? b + " B"
    : b < 1048576
    ? (b / 1024).toFixed(1) + " KB"
    : (b / 1048576).toFixed(1) + " MB";
