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

export default function ChatPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [profile, setProfile] =
    useState<DatasetProfile | null>(null);

  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");

  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    listDatasets()
      .then((items) => {
        if (!mounted) return;
        setDatasets(items);
        setDatasetId(items[0]?.id ?? "");
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load datasets",
          );
        }
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

    getDatasetProfile(datasetId)
      .then((data) => {
        if (mounted) setProfile(data);
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to inspect dataset",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoadingProfile(false);
      });

    return () => { mounted = false; };
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
    if (busy) return;

    setDatasetId(id);
    setMessages([]);
    setDraft("");
    setProfile(null);
    setError("");
  }

  async function sendQuestion(question: string) {
    const cleanQuestion = question.trim();

    if (
      busy ||
      !datasetId ||
      cleanQuestion.length < 5 ||
      cleanQuestion.length > 500
    ) {
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;

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
      );

      if (controller.signal.aborted) return;

      const assistantMessage: ChatEntry = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        model: response.model,
        analysis: response.analysis,
        plan: response.plan,
      };

      setMessages((items) => [...items, assistantMessage]);
    } catch (err) {
      if (controller.signal.aborted) return;

      setMessages((items) =>
        items.filter((item) => item.id !== userMessage.id),
      );

      setDraft(cleanQuestion);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete AI analysis",
      );
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
          {busy ? "[PROCESSING]" : "[READY]"}
        </span>
      </div>

      <div className="ai-workspace-grid">
        <aside className="ai-context-panel">
          <label className="ai-dataset-label" htmlFor="ai-dataset">
            01 / ACTIVE DATASET
          </label>

          <select
            id="ai-dataset"
            value={datasetId}
            onChange={(event) =>
              selectDataset(event.target.value)
            }
            disabled={busy}
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

          <SuggestedQuestions
            suggestions={suggestions}
            onSelect={(question) => {
              void sendQuestion(question);
            }}
            disabled={busy || loadingProfile}
          />

          <p className="ai-privacy-note">
            YOUR QUESTION, COLUMN SCHEMA, AND COMPUTED RESULTS ARE SENT TO AI.
            FULL CSV DATA REMAINS IN THE LOCAL BACKEND.
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
              busy || loadingProfile || !profile || !datasetId
            }
          />

          <p className="ai-session-note">
            [SESSION ONLY] This version does not yet save
            conversations or send previous messages as context.
          </p>
        </div>
      </div>
    </div>
  );
}