import Head from "next/head";
import Script from "next/script";
import Link from "next/link";

export default function DeckBuilder() {
  return (
    <>
      <Head>
        <title>Sigil Crosses | Deck Builder</title>
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

      {/* Load deck builder script */}
      <Script src="/lib/deck_builder.js" strategy="afterInteractive" />

      <center>
        <h1>Sigil Crosses</h1>

        <div id="button_wrapper">
          <a href="#" id="save" download="deck.json">
            Save Deck
          </a>
          &#9;&#9;&#9;Load Deck <input type="file" id="load" />
          <Link href="/">
            <button type="button">Quit</button>
          </Link>
        </div>

        <div className="cardPool"></div>

        <div className="cardList"></div>
      </center>
    </>
  );
}
