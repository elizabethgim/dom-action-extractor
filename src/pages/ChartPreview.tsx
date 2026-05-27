type ChartPreviewProps = {
  htmlCode: string;
  cssCode: string;
  jsCode: string;
};

function prepareJs(js: string, baseUrl: string): string {
  return (
    js
      // remove CSS side-effect imports (import "./foo.css")
      .replace(/^import\s+["'][^"']+\.css["'];?\s*$/gm, "")
      // remove relative path side-effect imports that won't resolve in iframe
      .replace(/^import\s+["']\.{1,2}\/[^"']+["'];?\s*$/gm, "")
      // replace import.meta.url with the parent origin so relative URLs resolve
      .replace(/import\.meta\.url/g, JSON.stringify(baseUrl))
      // strip export from named functions/vars so they stay in scope
      .replace(/^export\s+default\s+/gm, "")
      .replace(/^export\s+(function|class|const|let|var)\s+/gm, "$1 ") +
    // auto-invoke index(container) if defined
    `\nif (typeof index === "function") {
      index(document.getElementById("chart-wrapper") ?? document.body);
    }`
  );
}

export function ChartPreview({ htmlCode, cssCode, jsCode }: ChartPreviewProps) {
  const srcDoc = `
  <!DOCTYPE html>
    <html>
      <head>
        <script type="importmap">
        {"imports":{"d3":"https://esm.sh/d3@7","d3-scale":"https://esm.sh/d3-scale@4"}}
        </script>
        <style>
          body { margin: 0; font-family: sans-serif; }
          ${cssCode}
        </style>
      </head>
      <body>
        <div id="chart-wrapper">${htmlCode}</div>
        <script type="module">
          ${prepareJs(jsCode, window.location.origin)}
        </script>
      </body>
    </html>`;

  return (
    <iframe
      title="chart-preview"
      srcDoc={srcDoc}
      style={{ width: "100%", height: "600px", border: "1px solid #ddd" }}
      sandbox="allow-scripts"
    />
  );
}