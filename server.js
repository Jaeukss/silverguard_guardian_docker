const express = require("express");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 7860;

const API_BASE_URL = (process.env.API_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY;

app.use(express.json());

function awsHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
    ...extra
  };
}

async function forwardToAws(res, pathValue, options) {
  try {
    if (!API_BASE_URL || !API_KEY) {
      return res.status(500).json({
        errorCode: "MISSING_ENV",
        errorMessage: "API_BASE_URL 또는 API_KEY가 Hugging Face Space에 설정되지 않았습니다."
      });
    }

    const awsRes = await fetch(`${API_BASE_URL}${pathValue}`, options);
    const text = await awsRes.text();

    res.status(awsRes.status);

    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (err) {
    console.error("AWS_PROXY_ERROR:", err);
    return res.status(503).json({
      errorCode: "AWS_PROXY_ERROR",
      errorMessage: "Hugging Face Space에서 AWS API 호출에 실패했습니다.",
      detail: err.message
    });
  }
}

app.post("/api/fall-events", async (req, res) => {
  const idemKey = req.headers["idempotency-key"] || randomUUID();

  await forwardToAws(res, "/fall-events", {
    method: "POST",
    headers: awsHeaders({
      "Idempotency-Key": idemKey
    }),
    body: JSON.stringify(req.body)
  });
});

app.get("/api/fall-events", async (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  const pathValue = query ? `/fall-events?${query}` : "/fall-events";

  await forwardToAws(res, pathValue, {
    method: "GET",
    headers: awsHeaders()
  });
});

app.get("/api/fall-events/:eventId", async (req, res) => {
  await forwardToAws(res, `/fall-events/${encodeURIComponent(req.params.eventId)}`, {
    method: "GET",
    headers: awsHeaders()
  });
});

app.patch("/api/fall-events/:eventId/status", async (req, res) => {
  await forwardToAws(res, `/fall-events/${encodeURIComponent(req.params.eventId)}/status`, {
    method: "PATCH",
    headers: awsHeaders(),
    body: JSON.stringify(req.body)
  });
});

app.post("/api/fall-events/:eventId/guardian-notification", async (req, res) => {
  const idemKey = req.headers["idempotency-key"] || randomUUID();

  await forwardToAws(res, `/fall-events/${encodeURIComponent(req.params.eventId)}/guardian-notification`, {
    method: "POST",
    headers: awsHeaders({
      "Idempotency-Key": idemKey
    }),
    body: JSON.stringify(req.body)
  });
});

app.use(express.static(path.join(__dirname, "dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SilverGuard AWS proxy running on port ${PORT}`);
  console.log(`AWS API BASE: ${API_BASE_URL}`);
});
