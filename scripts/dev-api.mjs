import http from "node:http";
import handler from "../api/exhibition.js";
import media from "../api/media.js";
http
  .createServer((req, res) =>
    req.url.startsWith("/api/media") ? media(req, res) : handler(req, res),
  )
  .listen(5174, "127.0.0.1", () =>
    console.log("Exhibition API: http://127.0.0.1:5174"),
  );
