import { type Address } from "@solana/kit";
import { getAddressEncoder } from "@solana/kit";
import { type Connection } from "solana-kite";
import { setTimeout as setTimeoutPromise } from "timers/promises";
import { serializeLE } from "./serialization.js";
import { ARCIUM_PROGRAM_ID } from "./constants.js";
import { getEventDiscriminator } from "./idl-helpers.js";

const FINALIZE_COMPUTATION_DISCRIMINATOR = getEventDiscriminator("FinalizeComputationEvent");

/*
 * Parses Anchor events from transaction logs.
 * Anchor events are emitted as "Program data: <base64>" log lines.
 *
 * @returns The event data bytes (including discriminator) or null if not found
 */
export const parseAnchorEventFromLogs = (
  logs: ReadonlyArray<string>,
  eventDiscriminator: Uint8Array,
): Buffer | null => {
  for (const log of logs) {
    if (!log.includes("Program data:")) continue;

    const base64Data = log.split("Program data: ")[1];
    if (!base64Data) continue;

    try {
      const eventData = Buffer.from(base64Data, "base64");
      if (
        eventData.length >= 8 &&
        eventData.subarray(0, 8).equals(Buffer.from(eventDiscriminator))
      ) {
        return eventData;
      }
    } catch {
      continue;
    }
  }

  return null;
};

/*
 * Polls for a FinalizeComputationEvent by scanning recent Arcium program transactions.
 * Use awaitComputationFinalizationSubscription for a more efficient WebSocket-based approach.
 */
export const awaitComputationFinalization = async (
  connection: Connection,
  computationOffset: bigint,
  mxeProgramId: Address,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed",
): Promise<string> => {
  const offsetBytes = Buffer.from(serializeLE(computationOffset, 8));
  const mxeProgramIdBytes = Buffer.from(getAddressEncoder().encode(mxeProgramId));

  const pollInterval = 1000;
  const maxAttempts = 120;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const signatures = await connection.rpc
        .getSignaturesForAddress(ARCIUM_PROGRAM_ID, { limit: 10 })
        .send();

      for (const signatureInfo of signatures) {
        const transaction = await connection.rpc
          .getTransaction(signatureInfo.signature, {
            commitment,
            encoding: "json",
            maxSupportedTransactionVersion: 0,
          })
          .send();

        if (!transaction) continue;

        const logs = transaction.meta?.logMessages ?? [];
        const eventData = parseAnchorEventFromLogs(logs, FINALIZE_COMPUTATION_DISCRIMINATOR);
        if (!eventData || eventData.length < 8 + 8 + 32) continue;

        const eventOffsetBytes = eventData.subarray(8, 16);
        const eventMxeProgramId = eventData.subarray(16, 48);

        if (
          eventOffsetBytes.equals(offsetBytes) &&
          eventMxeProgramId.equals(mxeProgramIdBytes)
        ) {
          return signatureInfo.signature;
        }
      }

      await setTimeoutPromise(pollInterval);
    } catch (thrownObject) {
      console.log(`Polling attempt ${attempt + 1} failed:`, thrownObject);
      await setTimeoutPromise(pollInterval);
    }
  }

  throw new Error(
    `Computation finalization timed out after ${maxAttempts} attempts for offset ${computationOffset}`,
  );
};

/*
 * Waits for a FinalizeComputationEvent via WebSocket log subscription.
 * More efficient than polling — receives events in real-time.
 */
export const awaitComputationFinalizationSubscription = async (
  connection: Connection,
  computationOffset: bigint,
  mxeProgramId: Address,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed",
): Promise<string> => {
  const offsetBytes = Buffer.from(serializeLE(computationOffset, 8));
  const mxeProgramIdBytes = Buffer.from(getAddressEncoder().encode(mxeProgramId));

  return new Promise((resolve, reject) => {
    const abortController = new AbortController();

    const timeoutHandle = globalThis.setTimeout(() => {
      abortController.abort();
      reject(
        new Error(
          `Computation finalization timed out after 120 seconds for offset ${computationOffset}`,
        ),
      );
    }, 120_000);

    const subscribeToLogs = async () => {
      try {
        const logsAsyncIterable = await connection.rpcSubscriptions
          .logsNotifications({ mentions: [ARCIUM_PROGRAM_ID] }, { commitment })
          .subscribe({ abortSignal: abortController.signal });

        for await (const notification of logsAsyncIterable) {
          const { value } = notification;

          if (value.err) continue;

          const eventData = parseAnchorEventFromLogs(
            value.logs,
            FINALIZE_COMPUTATION_DISCRIMINATOR,
          );
          if (!eventData || eventData.length < 8 + 8 + 32) continue;

          const eventOffsetBytes = eventData.subarray(8, 16);
          const eventMxeProgramId = eventData.subarray(16, 48);

          if (
            eventOffsetBytes.equals(offsetBytes) &&
            eventMxeProgramId.equals(mxeProgramIdBytes)
          ) {
            globalThis.clearTimeout(timeoutHandle);
            abortController.abort();
            resolve(value.signature);
            return;
          }
        }
      } catch (thrownObject) {
        clearTimeout(timeoutHandle as any);
        if ((thrownObject as Error)?.name !== "AbortError") {
          reject(thrownObject);
        }
      }
    };

    subscribeToLogs();
  });
};
