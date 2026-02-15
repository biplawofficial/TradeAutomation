const API = "http://localhost:8000";

export async function placeOrder(data: {
  side: string;
  quantity: number;
  order_type: string;
  price?: number;
  leverage?: number;
}) {
  const res = await fetch(`${API}/api/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function cancelOrder(orderId: string) {
  const res = await fetch(`${API}/api/order/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId }),
  });
  return res.json();
}

export async function getPositions() {
  const res = await fetch(`${API}/api/positions`);
  return res.json();
}

export async function exitPosition(positionId: string) {
  const res = await fetch(`${API}/api/positions/exit/${positionId}`, {
    method: "POST",
  });
  return res.json();
}

export async function exitAllPositions() {
  const res = await fetch(`${API}/api/positions/exit-all`, {
    method: "POST",
  });
  return res.json();
}

export async function getOrderbook() {
  const res = await fetch(`${API}/api/orderbook`);
  return res.json();
}

export async function getOrders(page = 1, size = 5) {
  const res = await fetch(`${API}/api/orders?page=${page}&size=${size}`);
  return res.json();
}

// --- Scheduled trades ---

export async function scheduleTrade(data: {
  side: string;
  quantity: number;
  order_type: string;
  price?: number;
  leverage?: number;
  execute_at: string;
}) {
  const res = await fetch(`${API}/api/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getScheduledTrades() {
  const res = await fetch(`${API}/api/schedule`);
  return res.json();
}

export async function cancelScheduledTrade(tradeId: string) {
  const res = await fetch(`${API}/api/schedule/${tradeId}`, {
    method: "DELETE",
  });
  return res.json();
}

// --- WebSocket connectors ---

function createWS(
  path: string,
  onMessage: (data: unknown) => void,
  onError?: (err: Event) => void
): WebSocket {
  const ws = new WebSocket(`ws://localhost:8000${path}`);
  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onMessage(parsed);
    } catch {
      onMessage(event.data);
    }
  };
  if (onError) ws.onerror = onError;
  return ws;
}

export function connectPositionsWS(
  onMessage: (data: unknown) => void,
  onError?: (err: Event) => void
): WebSocket {
  return createWS("/ws/positions", onMessage, onError);
}

export function connectOrderbookWS(
  onMessage: (data: unknown) => void,
  onError?: (err: Event) => void
): WebSocket {
  return createWS("/ws/orderbook", onMessage, onError);
}

export function connectOrdersWS(
  onMessage: (data: unknown) => void,
  onError?: (err: Event) => void
): WebSocket {
  return createWS("/ws/orders", onMessage, onError);
}
