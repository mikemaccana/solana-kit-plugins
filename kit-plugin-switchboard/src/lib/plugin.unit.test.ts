import { describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "solana-kite";
import { address } from "@solana/kit";
import { switchboard } from "./plugin.js";
import { parseSwitchboardFeedAccountData } from "./switchboard-client.js";
import {
  PULL_FEED_DISCRIMINATOR,
  PULL_FEED_ACCOUNT_MIN_SIZE,
  OFFSET_RESULT,
  OFFSET_LAST_UPDATE_TIMESTAMP,
  RESULT_OFFSET_VALUE,
  RESULT_OFFSET_STD_DEV,
  RESULT_OFFSET_MEAN,
  RESULT_OFFSET_MIN_VALUE,
  RESULT_OFFSET_MAX_VALUE,
  RESULT_OFFSET_NUM_SAMPLES,
  RESULT_OFFSET_SLOT,
  SWITCHBOARD_DECIMAL_SCALE,
} from "./constants.js";

describe("switchboard plugin", () => {
  test("plugin returns object with all switchboard methods", () => {
    const connection = connect("devnet");
    const result = switchboard()(connection);

    assert.ok(typeof result.switchboard.getFeedValue === "function");
    assert.ok(typeof result.switchboard.getFeedValues === "function");
  });
});

function setInt128LE(view: DataView, offset: number, value: bigint): void {
  const mask = (1n << 128n) - 1n;
  const unsigned = value & mask;
  view.setBigUint64(offset, unsigned & 0xffffffffffffffffn, true);
  view.setBigUint64(offset + 8, (unsigned >> 64n) & 0xffffffffffffffffn, true);
}

function buildMockPullFeedAccount({
  valueRaw,
  stdDevRaw,
  meanRaw,
  minValueRaw,
  maxValueRaw,
  numSamples,
  slot,
  lastUpdatedAt,
}: {
  valueRaw: bigint;
  stdDevRaw: bigint;
  meanRaw: bigint;
  minValueRaw: bigint;
  maxValueRaw: bigint;
  numSamples: number;
  slot: bigint;
  lastUpdatedAt: bigint;
}): Uint8Array {
  const buffer = new ArrayBuffer(PULL_FEED_ACCOUNT_MIN_SIZE);
  const bytes = new Uint8Array(buffer);
  bytes.set(PULL_FEED_DISCRIMINATOR, 0);
  const view = new DataView(buffer);

  view.setBigInt64(OFFSET_LAST_UPDATE_TIMESTAMP, lastUpdatedAt, true);

  setInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_VALUE, valueRaw);
  setInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_STD_DEV, stdDevRaw);
  setInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_MEAN, meanRaw);
  setInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_MIN_VALUE, minValueRaw);
  setInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_MAX_VALUE, maxValueRaw);
  view.setUint8(OFFSET_RESULT + RESULT_OFFSET_NUM_SAMPLES, numSamples);
  view.setBigUint64(OFFSET_RESULT + RESULT_OFFSET_SLOT, slot, true);

  return bytes;
}

describe("parseSwitchboardFeedAccountData", () => {
  const feedAddress = address("So11111111111111111111111111111111111111112");

  test("parses valid mock pull feed account data", () => {
    // $150.25 scaled by 10^18
    const valueRaw = 150_250_000_000_000_000_000n;
    const mockData = buildMockPullFeedAccount({
      valueRaw,
      stdDevRaw: SWITCHBOARD_DECIMAL_SCALE / 100n, // 0.01
      meanRaw: valueRaw,
      minValueRaw: 150_000_000_000_000_000_000n, // 150.0
      maxValueRaw: 150_500_000_000_000_000_000n, // 150.5
      numSamples: 7,
      slot: 250_000_000n,
      lastUpdatedAt: 1_700_000_000n,
    });

    const result = parseSwitchboardFeedAccountData(mockData, feedAddress);

    assert.ok(result, "Should parse valid data");
    assert.strictEqual(result.valueRaw, valueRaw, "Raw value should round-trip");
    assert.ok(Math.abs(result.value - 150.25) < 1e-9, "Value should be 150.25");
    assert.ok(Math.abs(result.standardDeviation - 0.01) < 1e-9, "Std dev should be 0.01");
    assert.ok(Math.abs(result.minValue - 150.0) < 1e-9, "Min should be 150.0");
    assert.ok(Math.abs(result.maxValue - 150.5) < 1e-9, "Max should be 150.5");
    assert.strictEqual(result.numSamples, 7, "Sample count should match");
    assert.strictEqual(result.slot, 250_000_000n, "Slot should match");
    assert.strictEqual(result.lastUpdatedAt, 1_700_000_000n, "Last updated timestamp should match");
    assert.strictEqual(result.address, feedAddress, "Address should be echoed back");
  });

  test("decodes negative i128 values correctly", () => {
    const valueRaw = -42_000_000_000_000_000_000n; // -42.0
    const mockData = buildMockPullFeedAccount({
      valueRaw,
      stdDevRaw: 0n,
      meanRaw: valueRaw,
      minValueRaw: valueRaw,
      maxValueRaw: valueRaw,
      numSamples: 1,
      slot: 1n,
      lastUpdatedAt: 1n,
    });

    const result = parseSwitchboardFeedAccountData(mockData, feedAddress);
    assert.ok(result);
    assert.strictEqual(result.valueRaw, valueRaw, "Negative raw value should round-trip");
    assert.ok(Math.abs(result.value - -42.0) < 1e-9, "Value should be -42.0");
  });

  test("returns null for data that is too short", () => {
    const tooShort = new Uint8Array(100);
    tooShort.set(PULL_FEED_DISCRIMINATOR, 0);
    assert.strictEqual(parseSwitchboardFeedAccountData(tooShort, feedAddress), null);
  });

  test("returns null for wrong discriminator", () => {
    const mockData = buildMockPullFeedAccount({
      valueRaw: 1n,
      stdDevRaw: 0n,
      meanRaw: 1n,
      minValueRaw: 1n,
      maxValueRaw: 1n,
      numSamples: 1,
      slot: 1n,
      lastUpdatedAt: 1n,
    });
    mockData[0] = 0; // corrupt discriminator
    assert.strictEqual(parseSwitchboardFeedAccountData(mockData, feedAddress), null);
  });
});
