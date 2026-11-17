"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getProductionSnapshot = () =>
  window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
const getServerSnapshot = () => false;

export default function Analytics() {
  // Only activate Google Analytics on production domain, avoiding localhost test traffic and audit overhead
  const enabled = useSyncExternalStore(
    emptySubscribe,
    getProductionSnapshot,
    getServerSnapshot
  );

  if (!enabled) return null;

  return (
    <>
      <Script
        id="google-analytics-init"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-C02T0FQXN4');
          `,
        }}
      />
      <Script
        id="google-analytics"
        strategy="lazyOnload"
        src="https://www.googletagmanager.com/gtag/js?id=G-C02T0FQXN4"
      />
    </>
  );
}
