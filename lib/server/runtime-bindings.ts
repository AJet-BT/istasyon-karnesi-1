import type { drizzle } from "drizzle-orm/d1";

type D1Binding = Parameters<typeof drizzle>[0];

export type AJetRuntimeBindings = {
  DB?: D1Binding;
  ACCOUNT_RESET_TOKEN?: string;
  ENABLE_TEST_DATA_AUTO_IMPORT?: string;
  BUCKET?: {
    get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
    put(
      key: string,
      value: ArrayBuffer,
      options?: { httpMetadata?: { contentType?: string } },
    ): Promise<unknown>;
    delete(key: string): Promise<void>;
  };
};

const runtimeGlobal = globalThis as typeof globalThis & {
  __AJET_RUNTIME_BINDINGS__?: AJetRuntimeBindings;
};

export function setRuntimeBindings(bindings: AJetRuntimeBindings) {
  runtimeGlobal.__AJET_RUNTIME_BINDINGS__ = bindings;
}

export function getRuntimeBindings() {
  return runtimeGlobal.__AJET_RUNTIME_BINDINGS__ ?? {};
}
