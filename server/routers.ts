import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import axios from "axios";

// Binance API endpoints with geo-fallback
const BINANCE_ENDPOINTS = [
  "https://api.binance.us",
  "https://data-api.binance.vision",
  "https://api1.binance.com",
  "https://api.binance.com",
];

async function binanceFetch(path: string): Promise<unknown> {
  let lastError: Error = new Error("All Binance endpoints failed");
  for (const base of BINANCE_ENDPOINTS) {
    try {
      const res = await axios.get(`${base}${path}`, {
        timeout: 8000,
        headers: { Accept: "application/json" },
      });
      return res.data;
    } catch (e: any) {
      const msg = e?.response?.data?.msg || e?.message || String(e);
      if (
        msg.includes("restricted location") ||
        e?.response?.status === 451 ||
        e?.response?.status === 403
      ) {
        lastError = new Error(`Restricted: ${base}`);
        continue;
      }
      if (
        e.code === "ECONNREFUSED" ||
        e.code === "ETIMEDOUT" ||
        e.code === "ECONNRESET" ||
        e.code === "ERR_NETWORK"
      ) {
        lastError = new Error(`Network error: ${base}`);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ Binance Proxy Routes ============
  binance: router({
    // K-line / candlestick data
    klines: publicProcedure
      .input(
        z.object({
          symbol: z.string().default("BTCUSDT"),
          interval: z.string().default("1h"),
          limit: z.number().int().min(1).max(500).default(200),
        })
      )
      .query(async ({ input }) => {
        const data = await binanceFetch(
          `/api/v3/klines?symbol=${input.symbol}&interval=${input.interval}&limit=${input.limit}`
        );
        return data;
      }),

    // 24hr ticker stats
    ticker: publicProcedure
      .input(z.object({ symbol: z.string().default("BTCUSDT") }))
      .query(async ({ input }) => {
        const data = await binanceFetch(
          `/api/v3/ticker/24hr?symbol=${input.symbol}`
        );
        return data;
      }),

    // Order book depth
    depth: publicProcedure
      .input(
        z.object({
          symbol: z.string().default("BTCUSDT"),
          limit: z.number().int().min(5).max(100).default(20),
        })
      )
      .query(async ({ input }) => {
        const data = await binanceFetch(
          `/api/v3/depth?symbol=${input.symbol}&limit=${input.limit}`
        );
        return data;
      }),
  }),
});

export type AppRouter = typeof appRouter;
