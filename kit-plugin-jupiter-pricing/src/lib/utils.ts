export const ensureError = (thrownObject: unknown): Error => {
  if (thrownObject instanceof Error) {
    return thrownObject;
  }

  if (typeof thrownObject === "string") {
    return new Error(thrownObject);
  }

  return new Error(String(thrownObject));
};

export const formatUsdValue = (value: number): string => {
  if (value === 0) {
    return "$0.00";
  }

  if (value < 0.01) {
    return `$${value.toExponential(2)}`;
  }

  if (value < 1) {
    return `$${value.toFixed(4)}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const tokenAmountToUiAmount = (amount: bigint, decimals: number): number => {
  return Number(amount) / Math.pow(10, decimals);
};

export const uiAmountToTokenAmount = (uiAmount: number, decimals: number): bigint => {
  return BigInt(Math.floor(uiAmount * Math.pow(10, decimals)));
};
