import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const entry of ["index.html", "robots.txt", "assets", "yonetim"]) {
  await cp(entry, `dist/${entry}`, { recursive: true });
}

await rm("dist/yonetim/.htaccess", { force: true });

// Eski PHP API dosyaları ve yapılandırma sırları statik çıktıya asla kopyalanmaz.
