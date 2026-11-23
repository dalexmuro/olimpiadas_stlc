declare module "../.open-next/worker.js" {
  const openNextWorker: {
    fetch(
      request: Request,
      env: unknown,
      ctx: { waitUntil(promise: Promise<unknown>): void }
    ): Promise<Response>;
  };
  export default openNextWorker;
}
