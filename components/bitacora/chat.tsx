'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'
import { format } from 'date-fns'

type Message = {
  id: string
  content: string
  created_at: string
  sender_id: string
  calendario_profiles: { full_name: string }
}

export function Chat({ logId, currentUserId }: { logId: string, currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('calendario_chat_messages')
      .select('id, content, created_at, sender_id, calendario_profiles(full_name)')
      .eq('work_log_id', logId)
      .order('created_at', { ascending: true })

    if (data) setMessages(data as any)
  }

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`chat_${logId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'calendario_chat_messages',
        filter: `work_log_id=eq.${logId}`
      }, () => {
        // Refetch full messages to get the joined profile name
        fetchMessages()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [logId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const messageToSend = newMessage
    setNewMessage('')

    await supabase.from('calendario_chat_messages').insert({
      work_log_id: logId,
      sender_id: currentUserId,
      content: messageToSend
    })
  }

  return (
    <div className="flex flex-col h-[400px] border rounded-lg overflow-hidden bg-background">
      <div className="bg-muted px-4 py-2 border-b">
        <h3 className="font-semibold text-sm">Chat de Bitácora</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">No hay mensajes aún.</p>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUserId
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${
                  isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'
                }`}>
                  {!isMe && <p className="font-semibold text-xs mb-1 text-primary">{msg.calendario_profiles?.full_name}</p>}
                  <p>{msg.content}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(msg.created_at), 'HH:mm')}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="p-3 border-t bg-muted/30 flex gap-2">
        <Input 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-background"
        />
        <Button size="icon" type="submit" disabled={!newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
