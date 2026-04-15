import { createRoute, Link, useParams } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { SessionDetailResponse } from "../types";
import { rootRoute } from "./__root";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const MILLISECONDS_PER_SECOND = 1000;

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatDuration(
  startedAt: string | null,
  endedAt: string | null
): string {
  if (!startedAt) {
    return "-";
  }

  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) {
    return "-";
  }

  const endMs = endedAt ? Date.parse(endedAt) : Date.now();
  if (Number.isNaN(endMs)) {
    return "-";
  }

  const totalSeconds = Math.max(
    0,
    Math.floor((endMs - startedMs) / MILLISECONDS_PER_SECOND)
  );
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

function SessionDetailPage() {
  const { sessionId } = useParams({ from: "/session/$sessionId" });
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sessionActionPending, setSessionActionPending] = useState<
    "start" | "abort" | null
  >(null);
  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const streamContent = data?.logContent || "";
  const userMessageCount = data?.session.userMessages?.length || 0;

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;

    const applyPayload = (payload: SessionDetailResponse) => {
      if (!mounted) {
        return;
      }

      setData(payload);
      setError(null);
      setLoading(false);
    };

    const load = async () => {
      try {
        const response = await fetch(
          `/api/session/${encodeURIComponent(sessionId)}`
        );
        if (!response.ok) {
          throw new Error(`session detail request failed: ${response.status}`);
        }

        applyPayload((await response.json()) as SessionDetailResponse);
      } catch (sessionError) {
        if (mounted) {
          setError(String(sessionError));
          setLoading(false);
        }
      }
    };

    load();

    if (typeof EventSource !== "undefined") {
      eventSource = new EventSource(
        `/api/events/session/${encodeURIComponent(sessionId)}`
      );
      eventSource.onmessage = (event) => {
        try {
          applyPayload(JSON.parse(event.data) as SessionDetailResponse);
        } catch (parseError) {
          if (mounted) {
            setError(String(parseError));
          }
        }
      };
    }

    return () => {
      mounted = false;
      eventSource?.close();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!chatStreamRef.current) {
      return;
    }

    const shouldSmoothScroll = streamContent.length > 0 || userMessageCount > 0;

    chatStreamRef.current.scrollTo({
      top: chatStreamRef.current.scrollHeight,
      behavior: shouldSmoothScroll ? "smooth" : "auto",
    });
  }, [streamContent, userMessageCount]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data?.canSendInput || sending) {
      return;
    }

    const message = chatInput.trim();
    if (!message) {
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const response = await fetch(
        `/api/session/${encodeURIComponent(sessionId)}/input`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        }
      );

      if (!response.ok) {
        throw new Error(`session input request failed: ${response.status}`);
      }

      setChatInput("");
    } catch (sessionInputError) {
      setSendError(String(sessionInputError));
    } finally {
      setSending(false);
    }
  };

  const handleStartSession = async () => {
    setSessionActionPending("start");
    setSendError(null);
    try {
      const response = await fetch(
        `/api/session/${encodeURIComponent(sessionId)}/start`,
        {
          method: "POST",
        }
      );

      if (!response.ok && response.status !== 409) {
        throw new Error(`session start failed: ${response.status}`);
      }
    } catch (sessionStartError) {
      setSendError(String(sessionStartError));
    } finally {
      setSessionActionPending(null);
    }
  };

  const handleAbortSession = async () => {
    setSessionActionPending("abort");
    setSendError(null);
    try {
      const response = await fetch(
        `/api/session/${encodeURIComponent(sessionId)}/abort`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(`session abort failed: ${response.status}`);
      }
    } catch (sessionAbortError) {
      setSendError(String(sessionAbortError));
    } finally {
      setSessionActionPending(null);
    }
  };

  if (loading) {
    return <main className="screen loading">Loading session detail...</main>;
  }

  if (error || !data) {
    return (
      <main className="screen loading">
        <p>{error || "Session not found"}</p>
        <Link to="/">Back to dashboard</Link>
      </main>
    );
  }

  const { session } = data;

  return (
    <main className="screen">
      <section className="panel reveal">
        <h2>Agent Session Detail</h2>
        <p className="eyebrow">Session</p>
        <h1>{session.skill}</h1>
        <p className="subtitle">{session.id}</p>
        <div className="status-row">
          <span className={`step-badge step-${session.status}`}>
            {session.status}
          </span>
          <span className="runtime-pill">
            {data.isRunning ? "Streaming logs" : "Terminal finished"}
          </span>
          <div className="session-actions" role="group">
            <button
              aria-label="Start session"
              className="icon-button icon-button-play"
              disabled={
                sessionActionPending !== null ||
                session.status !== "planned" ||
                data.isRunning
              }
              onClick={handleStartSession}
              title="Start session"
              type="button"
            >
              <span aria-hidden="true" className="icon-glyph">
                ▶
              </span>
            </button>
            <button
              aria-label="Abort session"
              className="icon-button icon-button-delete"
              disabled={
                sessionActionPending !== null ||
                !(session.status === "planned" || session.status === "running")
              }
              onClick={handleAbortSession}
              title="Abort session"
              type="button"
            >
              <span aria-hidden="true" className="icon-glyph">
                ✕
              </span>
            </button>
          </div>
        </div>
        <p>
          <Link to="/">Back to dashboard</Link>
        </p>
      </section>

      <section className="panel reveal delay-1">
        <h2>Session Metadata</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <th>Skill</th>
                <td>{session.skill}</td>
              </tr>
              <tr>
                <th>Model</th>
                <td>{session.model}</td>
              </tr>
              <tr>
                <th>Story</th>
                <td>{session.storyId || "-"}</td>
              </tr>

              <tr>
                <th>Duration</th>
                <td>{formatDuration(session.startedAt, session.endedAt)}</td>
              </tr>
              <tr>
                <th>Exit Code</th>
                <td>{session.exitCode ?? "-"}</td>
              </tr>
              <tr>
                <th>Command</th>
                <td>{session.command}</td>
              </tr>
              <tr>
                <th>Log Path</th>
                <td>{session.logPath}</td>
              </tr>
              <tr>
                <th>Prompt Path</th>
                <td>{session.promptPath}</td>
              </tr>
              <tr>
                <th>Error</th>
                <td>{session.error || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel reveal delay-2">
        <h2>Agent Chat</h2>
        <p className="subtitle">
          {data.logExists
            ? "Streaming output from Copilot CLI plus your input messages."
            : "No log file found for this session."}
        </p>
        <div className="chat-stream" ref={chatStreamRef}>
          {(session.userMessages || []).map((message) => (
            <article
              className="chat-message chat-message-user"
              key={message.id}
            >
              <header>
                <strong>You</strong>
                <span>{formatDate(message.sentAt)}</span>
              </header>
              <p>{message.text}</p>
            </article>
          ))}

          <article className="chat-message chat-message-agent">
            <header>
              <strong>Copilot CLI</strong>
              <span>{data.isRunning ? "streaming" : "finished"}</span>
            </header>
            <pre>{data.logContent || "No log output available yet."}</pre>
          </article>
        </div>

        <form className="chat-input-row" onSubmit={handleSend}>
          <textarea
            disabled={sending}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder={
              data.canSendInput
                ? "Send a message to Copilot CLI..."
                : "Write your message. This session is not accepting input yet."
            }
            rows={3}
            value={chatInput}
          />
          <button
            className="cta"
            disabled={
              !data.canSendInput || sending || chatInput.trim().length === 0
            }
            type="submit"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
        {sendError ? <p className="chat-error">{sendError}</p> : null}
      </section>

      <section className="panel reveal delay-3">
        <h2>Prompt</h2>
        <p className="subtitle">
          {data.promptExists
            ? "Prompt used to start this agent session."
            : "No prompt file found for this session."}
        </p>
        <pre className="story-markdown">
          {data.promptContent || "No prompt content available."}
        </pre>
      </section>
    </main>
  );
}

export const sessionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId",
  component: SessionDetailPage,
});
