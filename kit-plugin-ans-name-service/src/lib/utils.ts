export const ensureError = (thrownObject: unknown): Error => {
  if (thrownObject instanceof Error) {
    return thrownObject;
  }

  if (typeof thrownObject === "string") {
    return new Error(thrownObject);
  }

  return new Error(String(thrownObject));
};
