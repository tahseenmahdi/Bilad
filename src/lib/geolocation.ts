// Keep the browser's own location provider, but allow a normal fix before
// asking for high accuracy. Mapbox still draws the real accuracy circle.
function positionError(code: number, message: string): GeolocationPositionError {
  return { code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
}

function attempt(provider: Pick<Geolocation, 'getCurrentPosition'>, options: PositionOptions, signal: AbortSignal): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Location request cancelled', 'AbortError')); return; }
    let finished = false;
    let deadline: ReturnType<typeof setTimeout>;
    function finish(callback: () => void) {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      signal.removeEventListener('abort', abort);
      callback();
    }
    function abort() { finish(() => reject(new DOMException('Location request cancelled', 'AbortError'))); }
    signal.addEventListener('abort', abort, { once: true });
    // Browser timeouts can exclude time spent awaiting permission. This cap
    // also prevents a permanently spinning button if a provider never replies.
    deadline = setTimeout(() => finish(() => reject(positionError(3, 'The browser location request timed out.'))), options.timeout);
    try {
      provider.getCurrentPosition(
        position => finish(() => resolve(position)),
        error => finish(() => reject(error)),
        options,
      );
    } catch {
      finish(() => reject(positionError(2, 'The browser location service could not start.')));
    }
  });
}

export async function requestBrowserPosition(provider: Pick<Geolocation, 'getCurrentPosition'>, signal: AbortSignal): Promise<GeolocationPosition> {
  try {
    return await attempt(provider, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }, signal);
  } catch (error) {
    // Permission denials must never trigger repeated permission requests.
    if (signal.aborted || (error as GeolocationPositionError).code === 1) throw error;
    return attempt(provider, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }, signal);
  }
}

export function createResilientGeolocation(native: Geolocation, onRetry?: () => void) {
  const requests = new Set<AbortController>();
  const provider: Geolocation = {
    getCurrentPosition(success, error) {
      const controller = new AbortController();
      requests.add(controller);
      let attempts = 0;
      const source = {
        getCurrentPosition(onSuccess: PositionCallback, onError?: PositionErrorCallback | null, options?: PositionOptions) {
          if (attempts++ > 0) onRetry?.();
          native.getCurrentPosition(onSuccess, onError, options);
        },
      };
      void requestBrowserPosition(source, controller.signal).then(
        position => { if (!controller.signal.aborted) success(position); },
        failure => { if (!controller.signal.aborted) error?.(failure); },
      ).finally(() => requests.delete(controller));
    },
    watchPosition: native.watchPosition.bind(native),
    clearWatch: native.clearWatch.bind(native),
  };
  return {
    provider,
    dispose() { for (const request of requests) request.abort(); requests.clear(); },
  };
}
