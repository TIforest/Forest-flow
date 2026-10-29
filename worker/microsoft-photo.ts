import type { AuthEnv } from './auth';

// Tokens are used only during login; only a small raster thumbnail is retained.
export async function syncMicrosoftPhoto(
  env: AuthEnv,
  userId: string,
  token: string,
) {
  try {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/photos/96x96/$value',
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 404) {
      await env.DB.prepare('UPDATE users SET microsoft_photo=NULL WHERE id=?')
        .bind(userId)
        .run();
      return;
    }
    if (!response.ok || Number(response.headers.get('Content-Length')) > 65536)
      return;
    const reader = response.body?.getReader();
    if (!reader) return;
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 65536) {
        await reader.cancel();
        return;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (b, i) => bytes[i] === b,
    );
    if (!jpeg && !png) return;
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    await env.DB.prepare('UPDATE users SET microsoft_photo=? WHERE id=?')
      .bind(
        `data:image/${jpeg ? 'jpeg' : 'png'};base64,${btoa(binary)}`,
        userId,
      )
      .run();
  } catch {
    // A missing photo or a Graph outage must never prevent corporate login.
  }
}
