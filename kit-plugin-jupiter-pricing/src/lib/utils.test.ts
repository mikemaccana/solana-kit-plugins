import { describe, test } from "node:test";
import assert from "node:assert";
import { formatUsdValue, tokenAmountToUiAmount, uiAmountToTokenAmount, ensureError } from "./utils.js";

describe("formatUsdValue", () => {
  test("formats zero correctly", () => {
    const result = formatUsdValue(0);
    assert.strictEqual(result, "$0.00");
  });

  test("formats very small values in scientific notation", () => {
    const result = formatUsdValue(0.00123);
    assert.strictEqual(result, "$1.23e-3");
  });

  test("formats small values with 4 decimals", () => {
    const result = formatUsdValue(0.1234);
    assert.strictEqual(result, "$0.1234");
  });

  test("formats regular values with 2 decimals", () => {
    const result = formatUsdValue(123.456);
    assert.strictEqual(result, "$123.46");
  });

  test("formats large values with commas", () => {
    const result = formatUsdValue(1234567.89);
    assert.strictEqual(result, "$1,234,567.89");
  });
});

describe("tokenAmountToUiAmount", () => {
  test("converts lamports to SOL correctly", () => {
    const result = tokenAmountToUiAmount(1000000000n, 9);
    assert.strictEqual(result, 1);
  });

  test("converts token amount with 6 decimals", () => {
    const result = tokenAmountToUiAmount(1000000n, 6);
    assert.strictEqual(result, 1);
  });

  test("converts zero correctly", () => {
    const result = tokenAmountToUiAmount(0n, 9);
    assert.strictEqual(result, 0);
  });

  test("handles fractional amounts", () => {
    const result = tokenAmountToUiAmount(500000000n, 9);
    assert.strictEqual(result, 0.5);
  });
});

describe("uiAmountToTokenAmount", () => {
  test("converts SOL to lamports correctly", () => {
    const result = uiAmountToTokenAmount(1, 9);
    assert.strictEqual(result, 1000000000n);
  });

  test("converts with 6 decimals", () => {
    const result = uiAmountToTokenAmount(1, 6);
    assert.strictEqual(result, 1000000n);
  });

  test("converts zero correctly", () => {
    const result = uiAmountToTokenAmount(0, 9);
    assert.strictEqual(result, 0n);
  });

  test("handles fractional amounts", () => {
    const result = uiAmountToTokenAmount(0.5, 9);
    assert.strictEqual(result, 500000000n);
  });

  test("floors fractional base units", () => {
    const result = uiAmountToTokenAmount(0.0000000015, 9);
    assert.strictEqual(result, 1n);
  });
});

describe("ensureError", () => {
  test("returns Error object unchanged", () => {
    const error = new Error("test error");
    const result = ensureError(error);
    assert.strictEqual(result, error);
  });

  test("converts string to Error", () => {
    const result = ensureError("test error");
    assert.ok(result instanceof Error);
    assert.strictEqual(result.message, "test error");
  });

  test("converts other types to Error", () => {
    const result = ensureError(123);
    assert.ok(result instanceof Error);
    assert.strictEqual(result.message, "123");
  });

  test("handles null", () => {
    const result = ensureError(null);
    assert.ok(result instanceof Error);
    assert.strictEqual(result.message, "null");
  });

  test("handles undefined", () => {
    const result = ensureError(undefined);
    assert.ok(result instanceof Error);
    assert.strictEqual(result.message, "undefined");
  });
});
