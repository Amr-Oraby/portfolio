"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export default function Analytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Only activate Google Analytics on production domain, avoiding localhost test traffic and audit overhead
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setEnabled(true);
    }
  }, []);

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
