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
          <title>Web Explorer</title>
          <meta name="description" content="Web Explorer AI" />
          {/* Add any other necessary meta tags */}
        </Head>
        <div className="min-h-screen">
          <div>
            {getLayout(
              <>
                <Component {...pageProps} />
                <Toaster />
              </>
            )}
          </div>
        </div>
        <Script
          src="https://kit.fontawesome.com/b260d03c30.js"
          crossOrigin="anonymous"
        />
      </ThemeProvider>
    </>
  );
};

export default api.withTRPC(MyApp as AppType<AppPropsWithLayout>);