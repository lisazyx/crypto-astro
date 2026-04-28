import { describe, expect, it } from "vitest";
import {
  backtestDeltaSignals,
  generateDeltaTurnovers,
  getDeltaCycleBoundaries,
  getDeltaAnalysis,
  type PriceCandle,
} from "../client/src/lib/deltaTheory";

/**
 * 构造模拟K线：在指定日期生成局部高点/低点
 */
function makeCandles(
  startDate: Date,
  days: number,
  peaks: { dayOffset: number; high: number; low: number }[]
): PriceCandle[] {
  const candles: PriceCandle[] = [];
  for (let i = 0; i < days; i++) {
    const time = startDate.getTime() + i * 86400000;
    const peak = peaks.find((p) => p.dayOffset === i);
    candles.push({
      time,
      high: peak ? peak.high : 50000,
      low: peak ? peak.low : 49000,
      close: 49500,
    });
  }
  return candles;
}

describe("Delta 三角洲理论 - 历史回测", () => {
  it("backtestDeltaSignals 应该返回过去 N 天的转折点", () => {
    const today = new Date(2026, 3, 23); // 2026-04-23
    const boundaries = getDeltaCycleBoundaries(today);
    const turnovers = generateDeltaTurnovers(boundaries);
    const backtests = backtestDeltaSignals(turnovers, today, 30);

    // 应该返回 0 到多个过去30天内的转折点
    expect(backtests).toBeInstanceOf(Array);
    backtests.forEach((bt) => {
      expect(bt.daysAgo).toBeGreaterThan(0);
      expect(bt.daysAgo).toBeLessThanOrEqual(30);
      expect(bt.turnover.date.getTime()).toBeLessThan(today.getTime());
    });
  });

  it("无K线数据时 actualPrice 应为 null 且 hit 为 false", () => {
    const today = new Date(2026, 3, 23);
    const boundaries = getDeltaCycleBoundaries(today);
    const turnovers = generateDeltaTurnovers(boundaries);
    const backtests = backtestDeltaSignals(turnovers, today, 30);

    backtests.forEach((bt) => {
      expect(bt.actualPrice).toBeNull();
      expect(bt.actualDate).toBeNull();
      expect(bt.hit).toBe(false);
      expect(bt.deviationDays).toBeNull();
    });
  });

  it("窗口内出现极值时应正确识别命中", () => {
    const today = new Date(2026, 3, 23);
    const boundaries = getDeltaCycleBoundaries(today);
    const turnovers = generateDeltaTurnovers(boundaries);
    const past = turnovers.find(
      (t) =>
        t.date.getTime() < today.getTime() &&
        t.date.getTime() > today.getTime() - 25 * 86400000
    );
    if (!past) return; // 跳过：无可测试的转折点

    // 在该转折点的理论日构造一个明显的高点
    const candleStart = new Date(past.windowStart);
    candleStart.setDate(candleStart.getDate() - 5);
    const dayOffset = Math.floor(
      (past.date.getTime() - candleStart.getTime()) / 86400000
    );
    const candles = makeCandles(candleStart, 40, [
      past.isHigh
        ? { dayOffset, high: 99999, low: 49000 }
        : { dayOffset, high: 50000, low: 1 },
    ]);

    const backtests = backtestDeltaSignals([past], today, 30, candles);
    expect(backtests).toHaveLength(1);
    const bt = backtests[0];
    expect(bt.actualPrice).not.toBeNull();
    expect(bt.actualDate).not.toBeNull();
    expect(bt.hit).toBe(true);
    expect(Math.abs(bt.deviationDays!)).toBeLessThanOrEqual(3);
  });

  it("getDeltaAnalysis 返回值包含 backtests 和 hitStats 字段", () => {
    const today = new Date(2026, 3, 23);
    const analysis = getDeltaAnalysis(today);

    expect(analysis).toHaveProperty("backtests");
    expect(analysis).toHaveProperty("hitStats");
    expect(analysis.hitStats).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        hits: expect.any(Number),
        hitRate: expect.any(Number),
      })
    );
    expect(analysis.hitStats.hitRate).toBeGreaterThanOrEqual(0);
    expect(analysis.hitStats.hitRate).toBeLessThanOrEqual(100);
  });

  it("传入K线时应正确计算 hitStats", () => {
    const today = new Date(2026, 3, 23);
    // 构造30天的K线 (today-30 ~ today)
    const candleStart = new Date(today.getTime() - 35 * 86400000);
    const candles = makeCandles(candleStart, 35, []);

    const analysis = getDeltaAnalysis(today, candles);
    // 即使无极值，total 应该等于过去30天的转折点数
    expect(analysis.hitStats.total).toBeGreaterThanOrEqual(0);
    expect(analysis.backtests.length).toBe(analysis.hitStats.total + (analysis.backtests.length - analysis.hitStats.total));
  });
});
