import http from "node:http";
import handler from "../api/exhibition.js";
http
  .createServer(handler)
  .listen(5174, "127.0.0.1", () =>
    console.log("Exhibition API: http://127.0.0.1:5174"),
  );
