import { useEffect, useMemo, useRef, useState } from "react";

import ChatWindow from "../components/chat/ChatWindow";
import ChatInput from "../components/chat/ChatInput";
import SuggestedQuestions from
  "../components/chat/SuggestedQuestions";

import {
  listDatasets,
  getDatasetProfile,
} from "../services/datasetApi";

import { askAI } from "../services/chatApi";
import {
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
} from "../services/conversationApi";
import type {
  ConversationSummary,
  StoredMessage,
} from "../types/conversation";

import type {
  Dataset,
  DatasetProfile,
} from "../types/dataset";

import type { ChatEntry } from "../types/chat";

function isNumeric(dtype: string): boolean {
  return /^(?:u?int|float|decimal)/i.test(dtype);
}

function buildSuggestions(
  profile: DatasetProfile | null,
): string[] {
  if (!profile) return [];

  const columns = profile.columns;
  const names = new Set(columns.map((c) => c.name));

  const metricName = [
    "Annual_Income",
    "Revenue",
    "Monthly_Spend",
    "Credit_Score",
  ].find((name) => names.has(name) &&
    isNumeric(columns.find((c) => c.name === name)!.dtype));

  const metric =
    metricName ??
    columns.find((c) => isNumeric(c.dtype))?.name;

  const groupName = [
    "Card_Type",
    "Region",
    "Product",
    "Occupation",
    "Gender",
  ].find((name) => names.has(name));

  const group =
    groupName ??
    columns.find(
      (c) =>
        !isNumeric(c.dtype) &&
        !/(?:^|_)id$/i.test(c.name),
    )?.name;

  if (metric && group) {
    return [
      `What is the average ${metric} by ${group}?`,
      `Which ${group} has the highest average ${metric}?`,
      `What is the maximum ${metric}?`,
    ];
  }

  if (metric) {
    return [
      `What is the average ${metric}?`,
      `What is the maximum ${metric}?`,
      `What is the minimum ${metric}?`,
    ];
  }

  if (group) {
    return [
      `How many unique ${group} values are there?`,
    ];
  }

  return [];
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The operation failed.";
}

function restoreMessages(
  messages: StoredMessage[],
): ChatEntry[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    model: message.model ?? undefined,
    plan: message.plan ?? undefined,
    analysis: message.analysis ?? undefined,
  }));
}

export default function ChatPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [profile, setProfile] =
    useState<DatasetProfile | null>(null);

  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [history, setHistory] =
    useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] =
    useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  const activeRequest = useRef<AbortController | null>(null);
  const historyVersion = useRef(0);

  useEffect(() => {
    let mounted = true;

    listDatasets()
      .then((items) => {
        if (!mounted) return;
        setDatasets(items);
        setDatasetId(items[0]?.id ?? "");
      })
      .catch((err: unknown) => {
        if (mounted) setError(errorMessage(err));
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!datasetId) {
      setProfile(null);
      return;
    }

    let mounted = true;
    setLoadingProfile(true);
    setProfile(null);

    getDatasetProfile(datasetId)
      .then((data) => {
        if (mounted) setProfile(data);
      })
      .catch((err: unknown) => {
        if (mounted) setError(errorMessage(err));
      })
      .finally(() => {
        if (mounted) setLoadingProfile(false);
      });

    return () => { mounted = false; };
  }, [datasetId]);

  useEffect(() => {
    const version = ++historyVersion.current;

    setMessages([]);
    setConversationId(null);
    setHistory([]);
    setDraft("");

    if (!datasetId) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);

    void (async () => {
      try {
        const items = await listConversations(datasetId);

        if (version !== historyVersion.current) return;
        setHistory(items);

        // Reopen the newest conversation after a refresh.
        if (items.length > 0) {
          const saved = await getConversation(items[0].id);

          if (version !== historyVersion.current) return;

          setConversationId(saved.id);
          setMessages(restoreMessages(saved.messages));
        }
      } catch (err) {
        if (version === historyVersion.current) {
          setError(errorMessage(err));
        }
      } finally {
        if (version === historyVersion.current) {
          setLoadingHistory(false);
        }
      }
    })();

    return () => {
      historyVersion.current += 1;
    };
  }, [datasetId]);

  useEffect(() => {
    return () => {
      activeRequest.current?.abort();
    };
  }, []);

  const suggestions = useMemo(
    () => buildSuggestions(profile),
    [profile],
  );

  const selectedDataset = datasets.find(
    (dataset) => dataset.id === datasetId,
  );

  function selectDataset(id: string) {
    if (busy || loadingHistory) return;

    setError("");
    setDatasetId(id);
  }

  function newChat() {
    if (busy || loadingHistory) return;

    historyVersion.current += 1;
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setError("");
  }

  async function openHistory(id: string) {
    if (busy || loadingHistory || id === conversationId) return;

    const version = ++historyVersion.current;
    setLoadingHistory(true);
    setError("");

    try {
      const saved = await getConversation(id);

      if (version !== historyVersion.current) return;

      if (saved.dataset_id !== datasetId) {
        throw new Error("Conversation belongs to another dataset.");
      }

      setConversationId(saved.id);
      setMessages(restoreMessages(saved.messages));
      setDraft("");
    } catch (err) {
      if (version === historyVersion.current) {
        setError(errorMessage(err));
      }
    } finally {
      if (version === historyVersion.current) {
        setLoadingHistory(false);
      }
    }
  }

  async function renameHistory(id: string) {
    if (busy || loadingHistory) return;

    const item = history.find((entry) => entry.id === id);
    if (!item) return;

    const entered = window.prompt(
      "Rename conversation",
      item.title,
    );

    if (entered === null) return;

    const title = entered.trim();

    if (!title || title.length > 120) {
      setError("Title must be 1 to 120 characters.");
      return;
    }

    setLoadingHistory(true);
    setError("");

    try {
      const updated = await renameConversation(id, title);

      setHistory((items) => items.map((entry) =>
        entry.id === id ? updated : entry,
      ));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingHistory(false);
    }
  }

  async function removeHistory(id: string) {
    if (busy || loadingHistory) return;

    const item = history.find((entry) => entry.id === id);
    if (!item) return;

    const confirmed = window.confirm(
      `Delete "${item.title}" and all its messages?`,
    );

    if (!confirmed) return;

    setLoadingHistory(true);
    setError("");

    try {
      await deleteConversation(id);

      setHistory((items) =>
        items.filter((entry) => entry.id !== id),
      );

      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
        setDraft("");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingHistory(false);
    }
  }

  async function sendQuestion(question: string) {
    const cleanQuestion = question.trim();

    if (
      busy ||
      loadingHistory ||
      activeRequest.current ||
      !datasetId ||
      cleanQuestion.length < 5 ||
      cleanQuestion.length > 500
    ) {
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    const version = historyVersion.current;

    const userMessage: ChatEntry = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleanQuestion,
    };

    setMessages((items) => [...items, userMessage]);
    setDraft("");
    setError("");
    setBusy(true);

    try {
      const response = await askAI(
        datasetId,
        cleanQuestion,
        controller.signal,
        conversationId,
      );

      if (controller.signal.aborted) return;

      setConversationId(response.conversation_id);

      const assistantMessage: ChatEntry = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        model: response.model,
        analysis: response.analysis,
        plan: response.plan,
      };

      setMessages((items) => [...items, assistantMessage]);

      // Refresh the sidebar without delaying the answer.
      void listConversations(datasetId)
        .then((items) => {
          if (version === historyVersion.current) {
            setHistory(items);
          }
        })
        .catch(() => {
          // History remains available on next load.
        });
    } catch (err) {
      if (controller.signal.aborted) return;

      setMessages((items) =>
        items.filter((item) => item.id !== userMessage.id),
      );

      setDraft(cleanQuestion);
      setError(errorMessage(err));
    } finally {
      if (!controller.signal.aborted) {
        activeRequest.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <div className="ai-workspace">
      <div className="section-heading">
        <span>AI / DATA ANALYST</span>
        <span>
          {busy
            ? "[PROCESSING]"
            : loadingHistory
              ? "[LOADING HISTORY]"
              : "[READY]"}
        </span>
      </div>

      <div className="ai-workspace-grid">
        <aside className="ai-context-panel">
          <label
            className="ai-dataset-label"
            htmlFor="ai-dataset"
          >
            01 / ACTIVE DATASET
          </label>

          <select
            id="ai-dataset"
            value={datasetId}
            onChange={(event) =>
              selectDataset(event.target.value)
            }
            disabled={busy || loadingHistory}
            className="ai-dataset-select"
          >
            {datasets.length === 0 && (
              <option value="">NO DATASETS</option>
            )}

            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.filename}
              </option>
            ))}
          </select>

          {selectedDataset && (
            <div className="ai-dataset-stats">
              <div>
                <span>RECORDS</span>
                <strong>
                  {selectedDataset.row_count.toLocaleString()}
                </strong>
              </div>
              <div>
                <span>COLUMNS</span>
                <strong>{selectedDataset.column_count}</strong>
              </div>
            </div>
          )}

          <section
            className="ai-history"
            aria-label="Conversation history"
          >
            <div className="ai-history-heading">
              <span>02 / CONVERSATIONS</span>
              <span>{history.length}</span>
            </div>

            <button
              type="button"
              className="ai-history-new"
              onClick={newChat}
              disabled={
                busy || loadingHistory || !datasetId
              }
            >
              + NEW CHAT
            </button>

            <div className="ai-history-list">
              {history.length === 0 && (
                <p className="ai-history-empty">
                  {loadingHistory
                    ? "[LOADING...]"
                    : "[NO SAVED CONVERSATIONS]"}
                </p>
              )}

              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={
                    "ai-history-item" +
                    (conversationId === entry.id
                      ? " selected"
                      : "")
                  }
                >
                  <button
                    type="button"
                    className="ai-history-open"
                    title={entry.title}
                    onClick={() =>
                      void openHistory(entry.id)
                    }
                    disabled={busy || loadingHistory}
                    aria-current={
                      conversationId === entry.id
                        ? "true"
                        : undefined
                    }
                  >
                    {entry.title}
                  </button>

                  <div className="ai-history-actions">
                    <button
                      type="button"
                      aria-label={`Rename ${entry.title}`}
                      title="Rename"
                      disabled={busy || loadingHistory}
                      onClick={() =>
                        void renameHistory(entry.id)
                      }
                    >
                      REN
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${entry.title}`}
                      title="Delete"
                      disabled={busy || loadingHistory}
                      onClick={() =>
                        void removeHistory(entry.id)
                      }
                    >
                      DEL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <SuggestedQuestions
            suggestions={suggestions}
            onSelect={(question) => {
              void sendQuestion(question);
            }}
            disabled={
              busy || loadingProfile || loadingHistory
            }
          />

          <p className="ai-privacy-note">
            QUESTIONS, ANSWERS AND VERIFIED RESULTS ARE
            SAVED IN LOCAL SQLITE. GEMINI DOES NOT YET
            RECEIVE PREVIOUS CONVERSATION MESSAGES.
          </p>
        </aside>

        <div className="ai-conversation-panel">
          <ChatWindow
            messages={messages}
            loading={busy}
          />

          {error && (
            <p className="inline-error" role="alert">
              [ERROR] {error}
            </p>
          )}

          <ChatInput
            value={draft}
            onChange={setDraft}
            onSend={(question) => {
              void sendQuestion(question);
            }}
            loading={busy}
            disabled={
              busy ||
              loadingHistory ||
              loadingProfile ||
              !profile ||
              !datasetId
            }
          />

          <p className="ai-session-note">
            {conversationId
              ? "[SAVED / SQLITE] CONVERSATION PERSISTS AFTER REFRESH."
              : "[NEW CHAT] FIRST SUCCESSFUL ANSWER CREATES THE SESSION."}
          </p>
        </div>
      </div>
    </div>
  );
}