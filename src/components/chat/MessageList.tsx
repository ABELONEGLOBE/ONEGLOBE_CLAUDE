"use client";

import { Message } from "ai";
import { cn } from "@/lib/utils";
import { User, Bot, Loader2 } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-neutral-800 font-semibold text-base">Generate React components with AI</p>
          <p className="text-neutral-400 text-sm mt-1 max-w-xs">Describe what you need — buttons, forms, cards, and more.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-8">
      <div className="space-y-8 max-w-3xl mx-auto w-full">
        {messages.map((message) => (
          <div
            key={message.id || message.content}
            className={cn(
              "flex gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              </div>
            )}

            <div className={cn(
              "flex flex-col gap-1.5 max-w-[80%]",
              message.role === "user" ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-neutral-100 text-neutral-900 rounded-bl-sm"
              )}>
                {message.parts ? (
                  <>
                    {message.parts.map((part, partIndex) => {
                      switch (part.type) {
                        case "text":
                          return message.role === "user" ? (
                            <span key={partIndex} className="whitespace-pre-wrap">{part.text}</span>
                          ) : (
                            <MarkdownRenderer
                              key={partIndex}
                              content={part.text}
                              className="prose-sm"
                            />
                          );
                        case "reasoning":
                          return (
                            <div key={partIndex} className="mt-3 p-3 bg-black/5 rounded-xl">
                              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide block mb-1.5">Reasoning</span>
                              <span className="text-sm text-neutral-600">{part.reasoning}</span>
                            </div>
                          );
                        case "tool-invocation":
                          const tool = part.toolInvocation;
                          return (
                            <div key={partIndex} className="inline-flex items-center gap-2 mt-2 px-2.5 py-1 bg-black/5 rounded-full text-xs font-medium">
                              {tool.state === "result" && tool.result ? (
                                <>
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span className="text-neutral-600">{tool.toolName}</span>
                                </>
                              ) : (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                  <span className="text-neutral-600">{tool.toolName}</span>
                                </>
                              )}
                            </div>
                          );
                        case "source":
                          return (
                            <div key={partIndex} className="mt-2 text-xs text-neutral-400">
                              Source: {JSON.stringify(part.source)}
                            </div>
                          );
                        case "step-start":
                          return partIndex > 0 ? <hr key={partIndex} className="my-3 border-neutral-200" /> : null;
                        default:
                          return null;
                      }
                    })}
                    {isLoading &&
                      message.role === "assistant" &&
                      messages.indexOf(message) === messages.length - 1 && (
                        <div className="flex items-center gap-2 mt-3 text-neutral-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">Generating…</span>
                        </div>
                      )}
                  </>
                ) : message.content ? (
                  message.role === "user" ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  ) : (
                    <MarkdownRenderer content={message.content} className="prose-sm" />
                  )
                ) : isLoading &&
                  message.role === "assistant" &&
                  messages.indexOf(message) === messages.length - 1 ? (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Generating…</span>
                  </div>
                ) : null}
              </div>
            </div>

            {message.role === "user" && (
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                  <User className="h-4 w-4 text-neutral-600" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}