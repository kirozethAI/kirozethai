"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessageAction } from "@/app/actions";
import type { Message } from "@/lib/supabase/types";

type Props = {
  clientId: string;
  conversationId: string;
  initialMessages: Pick<Message, "id" | "remetente" | "conteudo" | "created_at">[];
};

export function ChatClient({ clientId, conversationId, initialMessages }: Props) {
  const supabase = createClient();
  const [messages, setMessages] = useState(initialMessages);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const nova = payload.new as Props["initialMessages"][number];
          setMessages((atual) =>
            atual.some((m) => m.id === nova.id) ? atual : [...atual, nova]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    setEnviando(true);
    setTexto("");
    try {
      await sendMessageAction({ clientId, conversationId, conteudo });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col rounded border border-black/10 dark:border-white/10">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">
            Nenhuma mensagem ainda.
          </p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.remetente === "usuario" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.remetente === "usuario"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-black/5 dark:bg-white/10"
              }`}
            >
              {m.conteudo}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-black/10 p-3 dark:border-white/10"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite sua resposta..."
          className="flex-1 rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
