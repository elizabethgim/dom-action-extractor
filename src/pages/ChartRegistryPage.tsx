import { useEffect, useState } from "react";
import { createChart, type ChartCreatePayload, type ChartMetadata } from "@/services/chartApi";
import "@styles/global.css";

const SOURCES = ["dataset", "observable", "csv", "tableau"];
const FAMILIES = ["tree", "line", "bar", "scatter", "hierarchy", "map", "tableau"];
const RENDERERS = ["d3", "observable", "iframe"];

const EMPTY_FORM: ChartCreatePayload = {
  slug: "",
  title: "",
  source: SOURCES[0],
  family: FAMILIES[0],
  renderer: RENDERERS[0],
  description: "",
  dataset_id: "",
  questions: [],
};

export default function ChartRegistryPage() {
  const [charts, setCharts] = useState<ChartMetadata[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [questionsText, setQuestionsText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function loadCharts() {
    try {
      const res = await fetch("/api/charts");
      if (res.ok) setCharts((await res.json()) as ChartMetadata[]);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadCharts();
  }, []);

  function set(key: keyof ChartCreatePayload, value: string | null) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const payload: ChartCreatePayload = {
      ...form,
      dataset_id: form.dataset_id?.trim() || null,
      questions: questionsText
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean),
    };

    try {
      await createChart(payload);
      setStatus("success");
      setForm(EMPTY_FORM);
      setQuestionsText("");
      void loadCharts();
    } catch (err) {
      setStatus("error");
      setErrorMsg(String(err));
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>
      <h1>Chart Registry</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

        {/* ── 등록 폼 ── */}
        <section className="panel">
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Register Chart</h2>
          <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "grid", gap: 14 }}>

            <Field label="Slug *" hint="e.g. dataset:my-chart">
              <input
                required
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="source:name"
                style={inputStyle}
              />
            </Field>

            <Field label="Title *">
              <input
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="My Chart"
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <Field label="Source">
                <select value={form.source} onChange={(e) => set("source", e.target.value)} style={inputStyle}>
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Family">
                <select value={form.family} onChange={(e) => set("family", e.target.value)} style={inputStyle}>
                  {FAMILIES.map((f) => <option key={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Renderer">
                <select value={form.renderer} onChange={(e) => set("renderer", e.target.value)} style={inputStyle}>
                  {RENDERERS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

            <Field label="Dataset ID" hint="optional, e.g. covid">
              <input
                value={form.dataset_id ?? ""}
                onChange={(e) => set("dataset_id", e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Questions" hint="one per line">
              <textarea
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                rows={4}
                placeholder={"What is the max value?\nWhich category is highest?"}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

            {status === "error" && (
              <p style={{ margin: 0, color: "#dc2626", fontSize: 13 }}>{errorMsg}</p>
            )}
            {status === "success" && (
              <p style={{ margin: 0, color: "#16a34a", fontSize: 13 }}>Chart registered successfully.</p>
            )}

            <button
              type="submit"
              className="btn primary"
              disabled={status === "loading"}
              style={{ justifySelf: "start" }}
            >
              {status === "loading" ? "Registering…" : "Register"}
            </button>
          </form>
        </section>

        {/* ── 등록된 차트 목록 ── */}
        <section className="panel">
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>
            Registered Charts <span style={{ fontWeight: 400, color: "#6b7280" }}>({charts.length})</span>
          </h2>
          {charts.length === 0 ? (
            <p style={{ color: "#9ca3af", margin: 0 }}>No charts yet.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {charts.map((chart) => (
                <li
                  key={chart.id}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid #e1e4e8",
                    borderRadius: 8,
                    display: "grid",
                    gap: 2,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{chart.title}</span>
                  <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{chart.id}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {chart.source} · {chart.family} · {chart.renderer}
                    {chart.questions.length > 0 && ` · ${chart.questions.length}q`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e1e4e8",
  width: "100%",
  background: "#fafafa",
};
