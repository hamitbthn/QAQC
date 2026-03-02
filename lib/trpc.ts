import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    console.warn("Rork did not set EXPO_PUBLIC_RORK_API_BASE_URL, using fallback for local build");
    return "https://api.rork.com"; // Fallback
  }

  return url;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        const response = await fetch(url, options);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Sunucu Hatası (${response.status}): Endpoint ulaşılamıyor veya hata döndü. Detay: ${errorText.slice(0, 100)}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return response;
        } else {
          throw new Error("Sunucu geçersiz format döndürdü. JSON bekleniyordu ancak HTML/Text alındı.");
        }
      },
    }),
  ],
});
