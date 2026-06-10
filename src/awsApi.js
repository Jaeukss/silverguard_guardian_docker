async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data?.errorMessage || data?.message || `API 오류: ${res.status}`);
  }

  return data;
}

export function createFallEventApi(payload) {
  return request("/fall-events", {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify(payload)
  });
}

export function listFallEventsApi() {
  return request("/fall-events", {
    method: "GET"
  });
}

export function updateFallEventStatusApi(eventId, payload) {
  return request(`/fall-events/${eventId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function sendGuardianNotificationApi(eventId, payload) {
  return request(`/fall-events/${eventId}/guardian-notification`, {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify(payload)
  });
}
