const http = require("http");

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8"
  });

  res.end(`
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Düğün Sitemiz</title>
      </head>
      <body style="
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
        background: #faf7f4;
        text-align: center;
      ">
        <div>
          <h1>💍 Düğün Sitemiz</h1>
          <p>Çok yakında burada...</p>
        </div>
      </body>
    </html>
  `);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server ${port} portunda çalışıyor.`);
});
