const DATABASE_NAME = "gaia-tasks";
const DATABASE_VERSION = 1;
const STORE_NAME = "encrypted-records";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("IndexedDB saknas"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Kunde inte öppna lokal lagring"));
  });
}

async function withStore(mode, callback) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error("Lokal lagring misslyckades"));
      transaction.onabort = () => reject(transaction.error || new Error("Lokal lagring avbröts"));
    });
  } finally {
    database.close();
  }
}

export async function loadEncryptedLocal(datasetId) {
  const key = `local:${datasetId}`;
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Kunde inte läsa lokala ändringar"));
    });
  } finally {
    database.close();
  }
}

export async function saveEncryptedLocal(datasetId, envelope) {
  const key = `local:${datasetId}`;
  await withStore("readwrite", (store) => store.put(envelope, key));
}

export async function clearEncryptedLocal(datasetId) {
  const key = `local:${datasetId}`;
  await withStore("readwrite", (store) => store.delete(key));
}

export function getOrCreateDeviceId() {
  const storageKey = "gaiaTasks.deviceId";
  let value = localStorage.getItem(storageKey);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(storageKey, value);
  }
  return value;
}

export function loadUiSettings() {
  try {
    return JSON.parse(localStorage.getItem("gaiaTasks.ui") || "{}");
  } catch {
    return {};
  }
}

export function saveUiSettings(settings) {
  localStorage.setItem("gaiaTasks.ui", JSON.stringify(settings));
}

