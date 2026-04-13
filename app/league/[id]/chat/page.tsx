'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

type Message = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null };
};

export default function ChatPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [leagueId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchMessages() {
    try {
      const data = await apiFetch<{ messages: Message[] }>(`/api/leagues/${leagueId}/chat?limit=100`);
      setMessages(data.messages);
    } catch (e) {
      console.error('Erreur chargement messages:', e);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/leagues/${leagueId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content: input.trim() }),
      });
      setInput('');
      await fetchMessages();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Impossible d'envoyer le message", { variant: 'error' });
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  // Group messages by date
  let lastDate = '';

  return (
    <div className="container py-10 flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/league/${leagueId}`} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Retour à la ligue">
          ←
        </Link>
        <h1 className="text-2xl font-bold">💬 Chat de ligue</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 border rounded-lg p-4 bg-muted/20">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Aucun message. Lance la conversation !</p>
        )}
        {messages.map((m) => {
          const dateStr = formatDate(m.created_at);
          const showDate = dateStr !== lastDate;
          lastDate = dateStr;
          const isMe = m.user_id === user?.id;

          return (
            <div key={m.id}>
              {showDate && (
                <div className="text-center text-xs text-muted-foreground my-3">{dateStr}</div>
              )}
              <div className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {(m.profile.display_name ?? m.profile.username)?.[0]?.toUpperCase()}
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                    isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {!isMe && (
                    <p className="text-xs font-semibold mb-0.5 opacity-70">
                      {m.profile.display_name ?? m.profile.username}
                    </p>
                  )}
                  <p>{m.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 mt-3">
        <Input
          placeholder="Ton message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          {sending ? '...' : 'Envoyer'}
        </Button>
      </form>
    </div>
  );
}
