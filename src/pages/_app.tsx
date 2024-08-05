import { type NextPage } from "next";
import { type AppType, type AppProps } from "next/app";
import React from "react";
import Head from "next/head";
import { api } from "~/utils/api";
import Script from "next/script";
// import { ClerkProvider } from '@clerk/nextjs';
import "~/styles/globals.css";
import { Toaster } from "~/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import '~/styles/globals.css'

export type NextPageWithLayout<P = unknown, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: React.ReactElement) => React.ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const MyApp = ({
  Component,
  pageProps: { ...pageProps },
}: AppPropsWithLayout) => {
  const getLayout = Component.getLayout ?? ((page) => page);

  return (
    <>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Head>
      <title>Clone.WTF</title>
        <meta name="description" content="Share your knowledge, voice, and personality with the world. Clone.WTF makes it easy to create a digital version of yourself." />
        <meta property="og:title" content="Clone.WTF - Create Your AI Clone" />
        <meta property="og:description" content="Share your knowledge, voice, and personality with the world. Clone.WTF makes it easy to create a digital version of yourself." />
        <meta property="og:image" content="https://github.com/ASQUAREEE/intellico/assets/99893402/0c2846bd-ce92-47c6-9f82-10b267e58db2" />
        <meta property="og:image:alt" content="Clone.WTF" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1917" />
        <meta property="og:image:height" content="537" />
        <meta property="og:url" content="https://www.clone.wtf" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Clone.WTF - Create Your AI Clone" />
        <meta property="twitter:domain" content="clone.wtf" />
        <meta property="twitter:url" content="https://clone.wtf/" />
        <meta name="twitter:description" content="Share your knowledge, voice, and personality with the world. Clone.WTF makes it easy to create a digital version of yourself." />
        <meta name="twitter:image" content="https://github.com/ASQUAREEE/intellico/assets/99893402/0c2846bd-ce92-47c6-9f82-10b267e58db2" />
        <meta name="twitter:image:alt" content="Clone.WTF" />
        <meta name="twitter:image:type" content="image/png" />
        <meta name="twitter:image:width" content="1917" />
        <meta name="twitter:image:height" content="537" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
      </Head>
        {/* <ClerkProvider> */}
          <div className="min-h-screen ">
            <div>{getLayout(
              <>
            <Component {...pageProps} />
            <Toaster />
            </>
            )}</div>
          </div>
          {/* </ClerkProvider> */}
         
          <Script
            src="https://kit.fontawesome.com/b260d03c30.js"
            crossOrigin="anonymous"
      />
       </ThemeProvider>
    </>
  );
};

export default api.withTRPC(MyApp as AppType<AppPropsWithLayout>);
