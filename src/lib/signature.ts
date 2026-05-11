const enc = new TextEncoder();

export type DemoSignature = {
    kind: "web-crypto-ecdsa-demo";
    signer: string;
    signedAt: string;
    algorithm: "ECDSA P-256 / SHA-256";
    certificateSerial: string;
    publicKeyJwk: JsonWebKey;
    signatureB64: string;
    signedPayload: string;
};

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

function keyStorageName(userId: string) {
    return `demo-sign-key:${userId}`;
}

function serialFromKey(userId: string, signer: string) {
    const source = `${userId}:${signer}`;
    let hash = 0;

    for (let i = 0; i < source.length; i++) {
        hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    }

    return `DEMO-${hash.toString(16).toUpperCase().padStart(8, "0")}`;
}

async function importPrivateKey(jwk: JsonWebKey) {
    return crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"]
    );
}

async function importPublicKey(jwk: JsonWebKey) {
    return crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"]
    );
}

async function getOrCreateKeyPair(userId: string) {
    const stored = localStorage.getItem(keyStorageName(userId));

    if (stored) {
        const parsed = JSON.parse(stored) as { privateKeyJwk: JsonWebKey; publicKeyJwk: JsonWebKey };
        return {
            privateKey: await importPrivateKey(parsed.privateKeyJwk),
            publicKeyJwk: parsed.publicKeyJwk,
        };
    }

    const pair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
    );

    const privateKeyJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

    localStorage.setItem(keyStorageName(userId), JSON.stringify({ privateKeyJwk, publicKeyJwk }));

    return {
        privateKey: pair.privateKey,
        publicKeyJwk,
    };
}

export async function signPayload(userId: string, signer: string, payload: string, signedAt: string): Promise<DemoSignature> {
    const { privateKey, publicKeyJwk } = await getOrCreateKeyPair(userId);
    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        enc.encode(payload)
    );

    return {
        kind: "web-crypto-ecdsa-demo",
        signer,
        signedAt,
        algorithm: "ECDSA P-256 / SHA-256",
        certificateSerial: serialFromKey(userId, signer),
        publicKeyJwk,
        signatureB64: bufToB64(signature),
        signedPayload: payload,
    };
}

export async function verifySignature(signature: DemoSignature) {
    const publicKey = await importPublicKey(signature.publicKeyJwk);
    return crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        b64ToBuf(signature.signatureB64),
        enc.encode(signature.signedPayload)
    );
}
