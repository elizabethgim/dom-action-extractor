import { useState } from "react";
import styles from "@styles/ChartCodeEditor.module.css";
import { ChartPreview } from "./ChartPreview";

export default function ChartCodeEditorPage() {
  const [title, setTitle] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");

  const [previewCode, setPreviewCode] = useState<{
    htmlCode: string;
    cssCode: string;
    jsCode: string;
  } | null>(null);

  const handlePreview = () => {
    setPreviewCode({ htmlCode, cssCode, jsCode });
  };

  const handleSave = async () => {
    if (!previewCode) {
      alert("먼저 Preview를 확인해 주세요.");
      return;
    }

    const response = await fetch("/api/chrart-codes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        html_code: previewCode.htmlCode,
        css_code: previewCode.cssCode,
        js_code: previewCode.jsCode,
      }),
    });

    if (!response.ok) {
      alert("저장 실패");
      return;
    }

    alert("저장 완료");
  };

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <h1 className={styles.title}>Chart Code Editor</h1>
        <p className={styles.subtitle}>
          Write HTML, CSS, and JavaScript → Preview → Save to database
        </p>
      </section>

      <section className={styles.editorPanel}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Chart title</span>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Zoomable bar chart"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>HTML</span>
            <textarea
              className={styles.textarea}
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              placeholder='<div id="chart"></div>'
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>CSS</span>
            <textarea
              className={styles.textarea}
              value={cssCode}
              onChange={(e) => setCssCode(e.target.value)}
              placeholder="#chart { width: 100%; }"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>JavaScript</span>
            <textarea
              className={styles.textarea}
              value={jsCode}
              onChange={(e) => setJsCode(e.target.value)}
              placeholder="function render(container) { ... }"
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button className="btn secondary" onClick={handlePreview}>
            Preview
          </button>
          <button className="btn primary" onClick={handleSave}>
            Save to DB
          </button>
        </div>
      </section>

      {previewCode && (
        <section className={styles.previewPanel}>
          <h2 className={styles.previewTitle}>Preview</h2>
          <ChartPreview
            htmlCode={previewCode.htmlCode}
            cssCode={previewCode.cssCode}
            jsCode={previewCode.jsCode}
          />
        </section>
      )}
    </main>
  );
}