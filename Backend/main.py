import time
import hmac
import hashlib
import json
import asyncio
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import Optional
from utils import (
    get_positions,
    exit_position,
    exit_all_positions,
    get_active_position,
    placeOrder,
    COINDCX_API_KEY,
    COINDCX_API_SECRET,
    ORDERBOOK_URL_COINDCX,
    CANCEL_ORDER_COINDCX,
    BASE_URL_COINDCX,
)
import requests

load_dotenv()
app = FastAPI()

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Models ----------
class OrderRequest(BaseModel):
    side: str  # "buy" or "sell"
    quantity: float
    order_type: str = "market_order"  # "market_order" or "limit_order"
    price: float | None = None
    leverage: int = 15


class CancelOrderRequest(BaseModel):
    order_id: str


class ExitPositionRequest(BaseModel):
    position_id: str


class ScheduledTradeRequest(BaseModel):
    side: str
    quantity: float
    order_type: str = "market_order"
    price: Optional[float] = None
    leverage: int = 15
    execute_at: str  # ISO format: "2026-02-16T00:30:00" (local time)


# ---------- Scheduled trades store ----------
scheduled_trades: list[dict] = []


# ---------- Helper: wait_until (unchanged) ----------
def wait_until(hour, minute, second=0):
    now = datetime.now()
    target = now.replace(hour=hour, minute=minute, second=second, microsecond=0)

    if target <= now:
        target += timedelta(days=1)

    while True:
        now = datetime.now()
        remaining = (target - now).total_seconds()

        if remaining <= 0:
            break
        elif remaining > 1:
            time.sleep(remaining - 0.5)


# ---------- Helper: trade_flow (unchanged) ----------
def trade_flow():
    from utils import current_side, current_qty

    pos = get_active_position()
    if not pos:
        print("No active position")
        return
    exit_all_positions()
    time.sleep(6)
    placeOrder(current_side, current_qty)


# ---------- Helper: execute order ----------
def _execute_order(
    side: str, quantity: float, order_type: str, price: float | None, leverage: int
):
    """Shared logic to place an order on CoinDCX."""
    secret_bytes = bytes(COINDCX_API_SECRET, encoding="utf-8")
    timeStamp = int(round(time.time() * 1000))

    order_body = {
        "side": side,
        "pair": "B-RIVER_USDT",
        "order_type": order_type,
        "total_quantity": quantity,
        "leverage": leverage,
    }

    if order_type == "limit_order" and price is not None:
        order_body["price"] = str(price)

    body = {"timestamp": timeStamp, "order": order_body}

    json_body = json.dumps(body, separators=(",", ":"))
    signature = hmac.new(secret_bytes, json_body.encode(), hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-AUTH-APIKEY": COINDCX_API_KEY,
        "X-AUTH-SIGNATURE": signature,
    }

    response = requests.post(BASE_URL_COINDCX, data=json_body, headers=headers)
    return response.json()


# ---------- Background task: scheduled trade runner ----------
async def _scheduled_trade_runner():
    """Runs every second, checks for due scheduled trades, executes them."""
    while True:
        now = datetime.now()
        for trade in scheduled_trades:
            if trade["status"] == "pending":
                execute_at = datetime.fromisoformat(trade["execute_at"])
                if now >= execute_at:
                    trade["status"] = "executing"
                    try:
                        result = _execute_order(
                            trade["side"],
                            trade["quantity"],
                            trade["order_type"],
                            trade.get("price"),
                            trade["leverage"],
                        )
                        trade["status"] = "executed"
                        trade["result"] = result
                        trade["executed_at"] = datetime.now().isoformat()
                    except Exception as e:
                        trade["status"] = "failed"
                        trade["error"] = str(e)
        await asyncio.sleep(1)


@app.on_event("startup")
async def startup():
    asyncio.create_task(_scheduled_trade_runner())


# ---------- API Endpoints ----------


@app.post("/api/order")
def api_place_order(req: OrderRequest):
    """Place a market or limit order."""
    try:
        data = _execute_order(
            req.side, req.quantity, req.order_type, req.price, req.leverage
        )
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/order/cancel")
def api_cancel_order(req: CancelOrderRequest):
    """Cancel an order by its ID."""
    try:
        secret_bytes = bytes(COINDCX_API_SECRET, encoding="utf-8")
        timeStamp = int(round(time.time() * 1000))

        body = {"timestamp": timeStamp, "id": req.order_id}

        json_body = json.dumps(body, separators=(",", ":"))
        signature = hmac.new(
            secret_bytes, json_body.encode(), hashlib.sha256
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-AUTH-APIKEY": COINDCX_API_KEY,
            "X-AUTH-SIGNATURE": signature,
        }

        response = requests.post(CANCEL_ORDER_COINDCX, data=json_body, headers=headers)
        data = response.json()
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/positions")
def api_get_positions():
    """Get all positions."""
    try:
        data = get_positions()
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/positions/exit/{position_id}")
def api_exit_position(position_id: str):
    """Exit a single position by ID."""
    try:
        data = exit_position(position_id)
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/positions/exit-all")
def api_exit_all():
    """Exit all active positions."""
    try:
        exit_all_positions()
        return {"success": True, "message": "All positions exited"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/orderbook")
def api_get_orderbook():
    """Get the current orderbook snapshot."""
    try:
        response = requests.get(ORDERBOOK_URL_COINDCX)
        data = response.json()
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------- Scheduled trades ----------


@app.post("/api/schedule")
def api_schedule_trade(req: ScheduledTradeRequest):
    """Schedule a trade for future execution."""
    try:
        execute_at = datetime.fromisoformat(req.execute_at)
        if execute_at <= datetime.now():
            return {"success": False, "error": "Scheduled time must be in the future"}

        trade = {
            "id": str(uuid.uuid4()),
            "side": req.side,
            "quantity": req.quantity,
            "order_type": req.order_type,
            "price": req.price,
            "leverage": req.leverage,
            "execute_at": req.execute_at,
            "status": "pending",  # pending | executing | executed | failed | cancelled
            "created_at": datetime.now().isoformat(),
        }
        scheduled_trades.append(trade)
        return {"success": True, "data": trade}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/schedule")
def api_get_scheduled():
    """Get all scheduled trades."""
    return {"success": True, "data": scheduled_trades}


@app.delete("/api/schedule/{trade_id}")
def api_cancel_scheduled(trade_id: str):
    """Cancel a pending scheduled trade."""
    for trade in scheduled_trades:
        if trade["id"] == trade_id:
            if trade["status"] == "pending":
                trade["status"] = "cancelled"
                return {"success": True, "data": trade}
            else:
                return {
                    "success": False,
                    "error": f"Trade is already {trade['status']}",
                }
    return {"success": False, "error": "Trade not found"}


# ---------- Orders helper ----------


def _fetch_orders(page: str = "1", size: str = "50"):
    """Helper to fetch orders from CoinDCX with pagination."""
    secret_bytes = bytes(COINDCX_API_SECRET, encoding="utf-8")
    timeStamp = int(round(time.time() * 1000))

    body = {
        "timestamp": timeStamp,
        "page": page,
        "size": size,
    }

    json_body = json.dumps(body, separators=(",", ":"))
    signature = hmac.new(secret_bytes, json_body.encode(), hashlib.sha256).hexdigest()

    url = "https://api.coindcx.com/exchange/v1/derivatives/futures/orders"

    headers = {
        "Content-Type": "application/json",
        "X-AUTH-APIKEY": COINDCX_API_KEY,
        "X-AUTH-SIGNATURE": signature,
    }

    response = requests.post(url, data=json_body, headers=headers)
    return response.json()


@app.get("/api/orders")
def api_get_orders(page: str = "1", size: str = "50"):
    """Get orders with pagination."""
    try:
        data = _fetch_orders(page, size)
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------- WebSockets ----------


@app.websocket("/ws/positions")
async def ws_positions(websocket: WebSocket):
    """WebSocket that pushes positions every 1 second."""
    await websocket.accept()
    try:
        while True:
            try:
                data = get_positions()
                await websocket.send_json({"success": True, "data": data})
            except Exception as e:
                await websocket.send_json({"success": False, "error": str(e)})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass


@app.websocket("/ws/orders")
async def ws_orders(websocket: WebSocket):
    """WebSocket that pushes orders every 1 second. Client sends page/size."""
    await websocket.accept()
    page = "1"
    size = "50"
    try:
        while True:
            # Check for client messages (page changes) without blocking
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.05)
                if "page" in msg:
                    page = str(msg["page"])
                if "size" in msg:
                    size = str(msg["size"])
            except Exception:
                pass

            try:
                data = _fetch_orders(page, size)
                await websocket.send_json(
                    {"success": True, "data": data, "page": int(page)}
                )
            except Exception as e:
                await websocket.send_json({"success": False, "error": str(e)})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass


@app.websocket("/ws/orderbook")
async def ws_orderbook(websocket: WebSocket):
    """WebSocket that pushes orderbook data every 1 second."""
    await websocket.accept()
    try:
        while True:
            try:
                response = requests.get(ORDERBOOK_URL_COINDCX)
                data = response.json()
                await websocket.send_json({"success": True, "data": data})
            except Exception as e:
                await websocket.send_json({"success": False, "error": str(e)})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    # wait_until(18, 14, 55)
    trade_flow()
