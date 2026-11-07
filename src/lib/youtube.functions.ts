import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type YtVideo = { id: string; title: string; channel: string; thumb: string };

export const searchYoutube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => {
    const q = String(input?.q ?? "").trim().slice(0, 200);
    if (!q) throw new Error("Digite algo para pesquisar");
    return { q };
  })
  .handler(async ({ data }) => {
    const key = process.env["GOOGLE_API_KEY"];
    if (!key) throw new Error("Chave do YouTube não configurada");
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      videoCategoryId: "10",
      maxResults: "15",
      q: data.q,
      key,
    }).toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube [${res.status}]: ${await res.text()}`);
    const json = (await res.json()) as {
      items: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } } }[];
    };
    return json.items.map<YtVideo>((i) => ({
      id: i.id.videoId,
      title: i.snippet.title,
      channel: i.snippet.channelTitle,
      thumb: i.snippet.thumbnails.medium.url,
    }));
  });
