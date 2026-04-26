const fs = require("fs/promises");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function safeProjectFilename(filename) {
  const value = String(filename || "").trim();
  if (!value) {
    throw new Error("File name is required.");
  }
  if (/[\\/:*?"<>|]/.test(value)) {
    throw new Error("File name cannot contain path separators or reserved characters.");
  }
  return value.toLowerCase().endsWith(".json") ? value : `${value}.json`;
}

function isInsideDirectory(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function projectPathFromInput(input) {
  if (input.filePath) {
    const filePath = path.resolve(String(input.filePath));
    if (path.extname(filePath).toLowerCase() !== ".json") {
      throw new Error("Only .json files are supported.");
    }
    return filePath;
  }

  const directory = String(input.directory || "").trim();
  if (!directory) {
    throw new Error("Directory is required.");
  }
  return path.join(path.resolve(directory), safeProjectFilename(input.filename));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(res, pathname) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(requestPath);
  const filePath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);

  if (!isInsideDirectory(PUBLIC_DIR, filePath)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    sendText(res, 500, "Server error");
  }
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed." });
      return;
    }

    const input = await readBody(req);

    if (pathname === "/api/projects/save") {
      const filePath = projectPathFromInput(input);
      const document = input.document;

      if (!document || typeof document !== "object") {
        throw new Error("Document payload is required.");
      }

      const output = {
        ...document,
        savedAt: new Date().toISOString()
      };

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
      sendJson(res, 200, { ok: true, filePath });
      return;
    }

    if (pathname === "/api/projects/load") {
      const filePath = projectPathFromInput(input);
      const raw = await fs.readFile(filePath, "utf8");
      sendJson(res, 200, { ok: true, filePath, document: JSON.parse(raw) });
      return;
    }

    if (pathname === "/api/projects/list") {
      const directory = String(input.directory || "").trim();
      if (!directory) {
        throw new Error("Directory is required.");
      }
      const absoluteDirectory = path.resolve(directory);
      const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => ({
          name: entry.name,
          filePath: path.join(absoluteDirectory, entry.name)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      sendJson(res, 200, { ok: true, directory: absoluteDirectory, files });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Unknown API endpoint." });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || "Request failed." });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url.pathname);
    return;
  }

  await serveStatic(res, url.pathname);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    console.error("Open the existing service, stop the old node process, or start with another port:");
    console.error("  PowerShell: $env:PORT=5173; npm start");
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`PicEq is running at http://localhost:${PORT}`);
});
