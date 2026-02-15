import time
import hmac
import hashlib
import requests
import json
import os
import base64
from fastapi import FastAPI 
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()
app = FastAPI()

#API, Secret and Base URLs
DELTA_API_KEY = os.getenv("DELTA_API_KEY")
COINDCX_API_KEY = os.getenv("COINDCX_API_KEY")

DELTA_API_SECRET = os.getenv("DELTA_API_SECRET")
COINDCX_API_SECRET = os.getenv("COINDCX_API_SECRET")

BASE_URL_DELTA = "https://cdn-ind.testnet.deltaex.org"
BASE_URL_COINDCX = "https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create"
ORDERBOOK_URL_COINDCX = "https://public.coindcx.com/market_data/v3/orderbook/B-RIVER_USDT-futures/10"
CANCEL_ORDER_COINDCX = "https://api.coindcx.com/exchange/v1/derivatives/futures/orders/cancel"

#global variables
order_id = None
current_side = None
current_qty = 0

def get_closept(side: str):
    response = requests.get(ORDERBOOK_URL_COINDCX)
    data = response.json()

    bids = data.get("bids", {})
    asks = data.get("asks", {})
    side = side.lower()

    if side == "sell":
        if not bids:
            return None

        closept = max(map(float, bids.keys()))

    elif side == "buy":
        if not asks:
            return None
        closept = min(map(float, asks.keys()))

    else:
        raise ValueError("side must be 'buy' or 'sell'")

    return closept

def placedcxorder(side: str, quantity: int):
    secret_bytes = bytes(COINDCX_API_SECRET, encoding='utf-8')
    timeStamp = int(round(time.time() * 1000))
    body = {
        "timestamp": timeStamp,
        "order": {
            "side": side,                 
            "pair": "B-RIVER_USDT",     
            "order_type": "market_order",   
            "total_quantity": quantity,         
            "leverage": 15,
        }
    }

    json_body = json.dumps(body, separators = (',', ':'))
    signature = hmac.new(secret_bytes, json_body.encode(), hashlib.sha256).hexdigest()

    headers = {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': COINDCX_API_KEY,
        'X-AUTH-SIGNATURE': signature
    }

    response = requests.post(BASE_URL_COINDCX, data = json_body, headers = headers)
    data = response.json()
    print(
        f"Order placed: {data[0]['side'].upper()} | "
        f"Qty: {data[0]['total_quantity']} | "
        f"Type: {data[0]['order_type']} | "
        f"Pair: {data[0]['pair']} | "
        f"Time: {datetime.now()}"
    )

    global order_id
    order_id = data[0]["id"]

def cancelorder():
    secret_bytes = bytes(COINDCX_API_SECRET, encoding='utf-8')

    timeStamp = int(round(time.time() * 1000))

    body = {
            "timestamp":timeStamp ,
            "id": order_id
            }

    json_body = json.dumps(body, separators = (',', ':'))
    signature = hmac.new(secret_bytes, json_body.encode(), hashlib.sha256).hexdigest()

    headers = {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': COINDCX_API_KEY,
        'X-AUTH-SIGNATURE': signature
    }

    response = requests.post(CANCEL_ORDER_COINDCX, data = json_body, headers = headers)
    data = response.json()
    print(data)

def get_positions():
    secret_bytes = bytes(COINDCX_API_SECRET, encoding='utf-8')
    timeStamp = int(round(time.time() * 1000))

    body = {
        "timestamp": timeStamp,
        "page": "1",
        "size": "50",
        "margin_currency_short_name": ["USDT"]
    }

    json_body = json.dumps(body, separators=(',', ':'))

    signature = hmac.new(secret_bytes, json_body.encode(), hashlib.sha256).hexdigest()

    url = "https://api.coindcx.com/exchange/v1/derivatives/futures/positions"

    headers = {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': COINDCX_API_KEY,
        'X-AUTH-SIGNATURE': signature
    }

    response = requests.post(url, data=json_body, headers=headers)
    return response.json()


def exit_position(position_id):
    secret_bytes = bytes(COINDCX_API_SECRET, encoding='utf-8')
    timeStamp = int(round(time.time() * 1000))

    body = {
        "timestamp": timeStamp,
        "id": position_id
    }

    json_body = json.dumps(body, separators=(',', ':'))

    signature = hmac.new(secret_bytes, json_body.encode(), hashlib.sha256).hexdigest()

    url = "https://api.coindcx.com/exchange/v1/derivatives/futures/positions/exit"

    headers = {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': COINDCX_API_KEY,
        'X-AUTH-SIGNATURE': signature
    }

    response = requests.post(url, data=json_body, headers=headers)
    return response.json()


def exit_all_positions():
    positions = get_positions()
    for pos in positions:
        position_id = pos.get("id")
        active_pos = float(pos.get("active_pos", 0))
        if active_pos != 0:
            print(f"Exiting position {position_id} | Size: {active_pos}")

            result = exit_position(position_id)
            print("Response:", result, datetime.now())


        else:
            print(f"Skipping {position_id}, no active position")

current_side = None

def get_active_position():
    global current_side, current_qty

    positions = get_positions()

    if not positions:
        current_side = None
        current_qty = 0
        return None

    pos = positions[0]

    active_pos = float(pos.get("active_pos", 0))

    if active_pos > 0:
        current_side = "buy"
        current_qty = abs(active_pos)

    elif active_pos < 0:
        current_side = "sell"
        current_qty = abs(active_pos)

    else:
        current_side = None
        current_qty = 0

    print("Side:", current_side, "Qty:", current_qty)

    return pos if active_pos != 0 else None


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



def trade_flow():
    pos = get_active_position()
    if not pos:
        print("No active position")
        return
    exit_all_positions()
    time.sleep(6)
    placedcxorder(current_side, current_qty)

if __name__ == "__main__":
    # wait_until(1, 29, 54)
    wait_until(18, 14, 55)
    trade_flow()

    # wait_until(5, 29, 54)
    # trade_flow()

    # wait_until(9, 29, 54)
    # trade_flow()

    # wait_until(13, 29, 54)
    # trade_flow()

    # wait_until(17, 29, 54)
    # trade_flow()

    # wait_until(21, 29, 54)
    # trade_flow()

