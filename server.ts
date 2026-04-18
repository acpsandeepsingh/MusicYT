import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // YouTube search proxy
  app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing q" });

    const key = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "YouTube API key not configured" });
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(q as string)}&type=video&videoCategoryId=10&key=${key}`
      );
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("[Search] Failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Audio extraction proxy
  app.get("/api/extract", async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const videoId = id as string;
    console.log(`[Proxy] Extracting audio for: ${videoId}`);
    
    const CLIENT = {
      name: 'ANDROID_MUSIC',
      clientName: 'ANDROID_MUSIC',
      clientVersion: '6.25.53',
      userAgent: 'com.google.android.apps.youtube.music/6.25.53 (Linux; U; Android 14; en_US) gzip',
      apiKey: 'AIzaSyC3bq9C6_S_ShqlZ9QZ9W9LpZ9QZ9W9LpZ'
    };

    const streamAudio = async (url: string) => {
      try {
        const audioResponse = await fetch(url, {
          headers: {
            'User-Agent': CLIENT.userAgent,
            'Range': req.headers.range || 'bytes=0-'
          }
        });

        if (!audioResponse.ok && audioResponse.status !== 206) {
          throw new Error(`Upstream error: ${audioResponse.status}`);
        }

        res.status(audioResponse.status);
        ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(h => {
          const val = audioResponse.headers.get(h);
          if (val) res.setHeader(h, val);
        });

        if (audioResponse.body) {
          // @ts-ignore
          Readable.fromWeb(audioResponse.body).pipe(res);
        } else {
          res.status(500).end();
        }
      } catch (e) {
        console.error(`[Proxy] Stream error:`, e);
        res.status(500).end();
      }
    };

    try {
      // Single robust extraction method: InnerTube
      const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${CLIENT.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': CLIENT.userAgent,
          'Origin': 'https://music.youtube.com'
        },
        body: JSON.stringify({
          videoId,
          context: {
            client: {
              clientName: CLIENT.clientName,
              clientVersion: CLIENT.clientVersion,
              userAgent: CLIENT.userAgent,
              hl: 'en', gl: 'US', utcOffsetMinutes: 0
            }
          }
        })
      });

      if (!response.ok) throw new Error(`InnerTube HTTP ${response.status}`);
      const data = await response.json();
      
      if (!data.streamingData) {
        throw new Error('No streaming data found');
      }

      const formats = [...(data.streamingData.adaptiveFormats || []), ...(data.streamingData.formats || [])];
      const audioFormat = formats.find(f => f.itag === 140) || 
                         formats.find(f => f.mimeType?.includes('audio/mp4')) ||
                         formats.find(f => f.mimeType?.includes('audio'));

      let audioUrl = audioFormat?.url;
      
      // Handle cipher if present
      if (!audioUrl && (audioFormat?.signatureCipher || audioFormat?.cipher)) {
        const cipher = audioFormat.signatureCipher || audioFormat.cipher;
        const params = new URLSearchParams(cipher);
        const url = params.get('url');
        const sig = params.get('s') || params.get('sig');
        const sp = params.get('sp') || 'sig';
        if (url && sig) audioUrl = `${url}&${sp}=${sig}`;
        else audioUrl = url;
      }

      if (audioUrl) {
        if (!audioUrl.includes('ratebypass')) audioUrl += '&ratebypass=yes';
        return await streamAudio(audioUrl);
      }

      return res.status(404).json({ error: "Audio stream not found" });
    } catch (error) {
      console.error(`[Proxy] Extraction failed:`, error);
      return res.status(500).json({ error: "Extraction failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HarmonyStream server running on http://localhost:${PORT}`);
  });
}

startServer();
