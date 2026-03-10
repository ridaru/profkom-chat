const enc = new TextEncoder();

function bufToB64(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function b64ToBuf(b64: string) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

export async function hashPassword(password: string, saltB64?: string) {
    const salt =
        saltB64 ? new Uint8Array(b64ToBuf(saltB64)) : crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
        keyMaterial,
        256
    );

    return {
        saltB64: bufToB64(salt.buffer),
        hashB64: bufToB64(bits),
    };
}

export async function verifyPassword(password: string, saltB64: string, hashB64: string) {
    const { hashB64: candidate } = await hashPassword(password, saltB64);
    return candidate === hashB64;
}