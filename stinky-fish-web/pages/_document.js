import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="UTF-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Karla:wght@400;500;700&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
        <meta name="description" content="Address the Stinky Fish - turning courageous conversations into action" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
