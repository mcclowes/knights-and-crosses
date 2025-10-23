import Head from "next/head";
import Script from "next/script";

export default function AIViewer() {
  return (
    <>
      <Head>
        <title>Sigil Crosses | AI Viewer</title>
        <link
          rel="shortcut icon"
          href="/assets/img/favicon.png"
          type="image/x-icon"
        />
      </Head>

      {/* Load jQuery first */}
      <Script src="/lib/jquery-2.1.4.min.js" strategy="beforeInteractive" />

      {/* Load jQuery UI */}
      <Script
        src="/lib/jquery-ui-1.11.4/jquery-ui.min.js"
        strategy="beforeInteractive"
      />

      {/* Load AI viewer script */}
      <Script src="/lib/ai_viewer.js" strategy="afterInteractive" />

      <center>
        <h1>Sigil Crosses</h1>

        <div id="button_wrapper">
          <a href="#" id="evolveAI">
            Evolve AI
          </a>
        </div>

        <div className="aiList"></div>
      </center>
    </>
  );
}
