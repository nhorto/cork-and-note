// Progressive Edge Function transport for the Sommelier chat. React Native's
// XMLHttpRequest exposes responseText during `onprogress`, unlike the standard
// RN fetch implementation whose Response body is buffered on current builds.

export function createNdjsonParser(onEvent) {
  let buffer = '';
  return (chunk, final = false) => {
    buffer += chunk || '';
    const lines = buffer.split(/\r?\n/);
    buffer = final ? '' : lines.pop() || '';
    if (final && lines.length === 0 && buffer) lines.push(buffer);
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
    if (final && buffer.trim()) {
      onEvent(JSON.parse(buffer));
      buffer = '';
    }
  };
}

export function streamEdgeFunction({
  url,
  anonKey,
  accessToken,
  body,
  onDelta,
  xhrFactory = () => new XMLHttpRequest(),
}) {
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    let offset = 0;
    let fullText = '';
    let result = null;
    let streamError = null;

    const parser = createNdjsonParser((event) => {
      if (event?.type === 'delta' && typeof event.text === 'string') {
        fullText += event.text;
        onDelta?.(fullText, event.text);
      } else if (event?.type === 'done') {
        result = event;
      } else if (event?.type === 'error') {
        streamError = Object.assign(new Error(event.error || 'The sommelier stream was interrupted.'), {
          code: event.code,
        });
      } else if (!event?.type && typeof event?.response === 'string') {
        // During a staged release, an older Edge Function can ignore `stream`
        // and return its normal JSON object. Treat that as one completed chunk
        // so a new app remains usable until the streaming function is deployed.
        result = event;
        fullText = event.response;
        onDelta?.(fullText, fullText);
      } else if (!event?.type && typeof event?.error === 'string') {
        // Older functions can also return handled errors with HTTP 200.
        streamError = Object.assign(new Error(event.error), { code: event.code });
      }
    });

    const consume = (final = false) => {
      const next = String(xhr.responseText || '').slice(offset);
      offset += next.length;
      if (next || final) parser(next, final);
    };

    xhr.open('POST', `${url}/functions/v1/chat`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/x-ndjson');
    xhr.timeout = 120000;
    xhr.onprogress = () => {
      try {
        consume(false);
      } catch (error) {
        streamError = error;
        xhr.abort();
      }
    };
    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) {
          let payload = {};
          try { payload = JSON.parse(xhr.responseText || '{}'); } catch {}
          const error = new Error(payload.error || `AI request failed (${xhr.status})`);
          if (payload.code) error.code = payload.code;
          if (payload.meter) error.meter = payload.meter;
          reject(error);
          return;
        }
        consume(true);
        if (streamError) reject(streamError);
        else if (result) resolve(result);
        else reject(new Error('The sommelier response ended unexpectedly.'));
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.onabort = () => reject(streamError || new Error('The sommelier response was cancelled.'));
    xhr.ontimeout = () => reject(new Error('The sommelier took too long to respond.'));
    xhr.send(JSON.stringify({ ...body, stream: true }));
  });
}
