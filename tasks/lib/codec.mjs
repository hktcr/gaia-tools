const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function utf8(value) {
  return textEncoder.encode(value);
}

export function fromUtf8(value) {
  return textDecoder.decode(value);
}

export function bytesToBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function base64UrlToBytes(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/u.test(value)) {
    throw new Error("Ogiltig Base64URL-data");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function rejectDangerousKeys(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectDangerousKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Otillåten nyckel vid ${path}`);
    }
    rejectDangerousKeys(child, `${path}.${key}`);
  }
}

export function canonicalize(value) {
  rejectDangerousKeys(value);
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

export async function sha256Bytes(value) {
  const bytes = typeof value === "string" ? utf8(value) : value;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export async function sha256Hex(value) {
  return bytesToHex(await sha256Bytes(value));
}

export async function gzip(bytes) {
  if (typeof CompressionStream === "undefined") {
    return { algorithm: "none", bytes };
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return {
    algorithm: "gzip",
    bytes: new Uint8Array(await new Response(stream).arrayBuffer()),
  };
}

export async function gunzip(bytes, algorithm = "gzip", maximumBytes = 20 * 1024 * 1024) {
  if (algorithm === "none") {
    if (bytes.byteLength > maximumBytes) {
      throw new Error("Datan är för stor");
    }
    return bytes;
  }
  if (algorithm !== "gzip" || typeof DecompressionStream === "undefined") {
    throw new Error("Komprimeringsformatet stöds inte");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const output = new Uint8Array(await new Response(stream).arrayBuffer());
  if (output.byteLength > maximumBytes) {
    throw new Error("Den uppackade datan är för stor");
  }
  return output;
}

export function deepClone(value) {
  return structuredClone(value);
}

export function safeJsonParse(text, maximumCharacters = 20 * 1024 * 1024) {
  if (typeof text !== "string" || text.length > maximumCharacters) {
    throw new Error("JSON-datan är för stor");
  }
  const parsed = JSON.parse(text);
  rejectDangerousKeys(parsed);
  return parsed;
}

