const enc = new TextEncoder();

function bufToB64(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

export async function sha256Base64(text: string) {
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(text));
    return bufToB64(hash);
}