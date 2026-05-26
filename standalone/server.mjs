import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";

const PORT = Number.parseInt(process.env.PORT ?? "4173", 10);
const ROOT = process.cwd();

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon"
};

createServer((request, response) => {
    const requestPath = request.url === "/" ? "/index.html" : request.url ?? "/index.html";
    const safePath = normalize(decodeURIComponent(requestPath))
        .replace(/^[/\\]+/, "")
        .replace(/^(\.\.[/\\])+/, "");
    const filePath = join(ROOT, safePath);

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
    }

    const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    createReadStream(filePath).pipe(response);
}).listen(PORT, () => {
    console.log(`Standalone voxel scene available at http://localhost:${PORT}`);
});
