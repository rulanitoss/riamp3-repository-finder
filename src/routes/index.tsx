import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { searchYoutube, type YtVideo } from "@/lib/youtube.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RIA — Entrar e pesquisar músicas" },
      { name: "description", content: "Entre com seu Gmail e pesquise músicas no YouTube." },
      { property: "og:title", content: "RIA — Entrar e pesquisar músicas" },
      { property: "og:description", content: "Entre com seu Gmail e pesquise músicas no YouTube." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready) return null;
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">RIA</h1>
        {session ? <Search session={session} /> : <Login />}
      </div>
    </main>
  );
}

const input = "w-full rounded-md border border-input bg-background px-3 py-2";
const btn = "rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50";

function Login() {
  const [step, setStep] = useState<"form" | "code">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setMsg("Digite seu nome");
    if (!/@gmail\.com$/i.test(email.trim())) return setMsg("Use um endereço @gmail.com");
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { data: { username: name.trim() }, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setStep("code");
    setMsg("Enviamos um código para o seu Gmail. Veja também o spam.");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setMsg("Código inválido ou expirado");
    if (data.user) await supabase.from("profiles").update({ username: name.trim() }).eq("id", data.user.id);
  }

  return step === "form" ? (
    <form onSubmit={send} className="space-y-3">
      <input className={input} placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={input} type="email" placeholder="seuemail@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className={btn} disabled={busy}>Enviar código</button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-3">
      <input className={input} inputMode="numeric" placeholder="Código recebido" value={code} onChange={(e) => setCode(e.target.value)} />
      <div className="flex gap-2">
        <button className={btn} disabled={busy}>Confirmar</button>
        <button type="button" className="text-sm underline" onClick={() => setStep("form")}>Voltar</button>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}

function Search({ session }: { session: Session }) {
  const search = useServerFn(searchYoutube);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<YtVideo[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const name = (session.user.user_metadata?.username as string) || session.user.email;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      setItems(await search({ data: { q } }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro na pesquisa");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p>Olá, {name}</p>
        <button className="text-sm underline" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
      <form onSubmit={run} className="flex gap-2">
        <input className={input} placeholder="Pesquisar música..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btn} disabled={busy}>Buscar</button>
      </form>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {playing && (
        <iframe
          className="w-full aspect-video rounded-md"
          src={`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title="Player"
        />
      )}
      <ul className="space-y-2">
        {items.map((v) => (
          <li key={v.id}>
            <button className="flex w-full gap-3 text-left rounded-md p-2 hover:bg-accent" onClick={() => setPlaying(v.id)}>
              <img src={v.thumb} alt="" className="w-32 rounded" />
              <span>
                <span className="block font-medium">
                  {v.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")}
                </span>
                <span className="text-sm text-muted-foreground">{v.channel}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
