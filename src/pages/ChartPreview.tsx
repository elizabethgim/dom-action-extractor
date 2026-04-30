// ChartPreview.tsx
type ChartPreviewProps = {
  htmlCode: string;
  cssCode: string;
  jsCode: string;
};

export function ChartPreview({
  htmlCode,
  cssCode,
  jsCode,
}: ChartPreviewProps) {
  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            font-family: sans-serif;
          }

          ${cssCode}
        </style>
      </head>
      <body>
        ${htmlCode}

        <script src="https://d3js.org/d3.v7.min.js"></script>
        <script>
          ${jsCode}
        </script>
      </body>
    </html>
  `;

  return (
    <iframe
      title="chart-preview"
      srcDoc={srcDoc}
      style={{
        width: "100%",
        height: "600px",
        border: "1px solid #ddd",
      }}
      sandbox="allow-scripts"
    />
  );
}