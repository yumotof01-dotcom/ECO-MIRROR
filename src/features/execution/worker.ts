import metadata from "virtual:eco-mirror-context";
import { ExecutionRuntime } from "./runtime";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const host = self as unknown as { onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null; postMessage(message: WorkerResponse): void };
const runtime = new ExecutionRuntime(message => host.postMessage(message), { metadata: async () => metadata });
host.onmessage = event => { void runtime.handle(event.data); };
