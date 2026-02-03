import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';
import { User, Bot, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { ProposalCard } from './ProposalCard';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return <UserMessageBubble message={message} />;
  }
  if (message.role === 'assistant') {
    return <AIMessageBubble message={message} />;
  }
  return <SystemMessageBubble message={message} />;
}

function UserMessageBubble({ message }: { message: ChatMessage & { role: 'user' } }) {
  return (
    <div className="flex justify-end gap-2">
      <div className="max-w-[80%] rounded-lg bg-primary text-primary-foreground px-4 py-2">
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {(message.context.selectedNodeIds.length > 0 ||
          message.context.selectedGroupIds.length > 0) && (
          <p className="text-xs mt-1 opacity-70">
            {message.context.selectedNodeIds.length > 0 &&
              `${message.context.selectedNodeIds.length} areas`}
            {message.context.selectedNodeIds.length > 0 &&
              message.context.selectedGroupIds.length > 0 &&
              ', '}
            {message.context.selectedGroupIds.length > 0 &&
              `${message.context.selectedGroupIds.length} groups`}
            {' selected'}
          </p>
        )}
      </div>
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
}

function AIMessageBubble({ message }: { message: ChatMessage & { role: 'assistant' } }) {
  return (
    <div className="flex gap-2">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-lg bg-muted px-4 py-2">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.status === 'streaming' && (
            <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-1" />
          )}
          {message.status === 'error' && (
            <p className="text-xs text-destructive mt-1">Error generating response</p>
          )}
        </div>
        
        {/* Proposals */}
        {message.proposals && message.proposals.length > 0 && (
          <div className="space-y-2">
            {message.proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemMessageBubble({ message }: { message: ChatMessage & { role: 'system' } }) {
  const icons = {
    info: Info,
    warning: AlertTriangle,
    success: CheckCircle,
    error: XCircle,
  };
  
  const colors = {
    info: 'text-blue-500 bg-blue-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    success: 'text-green-500 bg-green-500/10',
    error: 'text-red-500 bg-red-500/10',
  };
  
  const Icon = icons[message.type];
  
  return (
    <div className="flex justify-center">
      <div
        className={cn(
          'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm',
          colors[message.type]
        )}
      >
        <Icon className="w-4 h-4" />
        <span>{message.content}</span>
      </div>
    </div>
  );
}
