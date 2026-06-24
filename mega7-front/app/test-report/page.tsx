"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    $: any;
    jQuery: any;
  }
}

export default function TestReportPage() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState({ jq: false, common: false, widgets: false, viewer: false });

  const all = ready.jq && ready.common && ready.widgets && ready.viewer;

  useEffect(() => {
    if (!all || !ref.current) return;

    const $ = window.$;
    console.log("jQuery:", !!$, "plugin:", !!$?.fn?.boldReportViewer);

    $(ref.current).boldReportViewer({
      reportServiceUrl: "http://localhost:5250/api/ReportViewer",
      reportPath: "Factura.rdl",
      height: "900px",
      width: "100%",
    });
  }, [all]);

  return (
    <div style={{ padding: 16 }}>
      <link
        rel="stylesheet"
        href="https://cdn.boldreports.com/12.1.16/content/v2.0/fluent-light/bold.report-viewer.min.css"
      />

      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"
        strategy="afterInteractive"
        onLoad={() => setReady(s => ({ ...s, jq: true }))}
      />
      <Script
        src="https://cdn.boldreports.com/12.1.16/scripts/v2.0/common/bold.reports.common.min.js"
        strategy="afterInteractive"
        onLoad={() => setReady(s => ({ ...s, common: true }))}
      />
      <Script
        src="https://cdn.boldreports.com/12.1.16/scripts/v2.0/common/bold.reports.widgets.min.js"
        strategy="afterInteractive"
        onLoad={() => setReady(s => ({ ...s, widgets: true }))}
      />
      <Script
        src="https://cdn.boldreports.com/12.1.16/scripts/v2.0/bold.report-viewer.min.js"
        strategy="afterInteractive"
        onLoad={() => setReady(s => ({ ...s, viewer: true }))}
      />

      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        Ready: {JSON.stringify(ready)}
      </div>

      <div ref={ref} />
    </div>
  );
}
