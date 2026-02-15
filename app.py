import time
import hmac
import hashlib
from fastapi import FastAPI 
import requests
import json
import os
import base64

app = FastAPI()


DELTA_API_KEY = os.getenv("DELTA_API_KEY")
COINDCX_API_KEY = os.getenv("COINDCX_API_KEY")

DELTA_API_SECRET = os.getenv("DELTA_API_SECRET")
COINDCX_API_SECRET = os.getenv("COINDCX_API_SECRET")

BASE_URL_DELTA = "https://cdn-ind.testnet.deltaex.org"
BASE_URL_COINDCX = "https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create"

def generate_signature(method, path, timestamp, body=""):
    message = method + timestamp + path + body
    return hmac.new(
        API_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()

def delta_request(method, path, body=None):
    timestamp = str(int(time.time()))

    body_str = json.dumps(body) if body else ""

    signature = generate_signature(method, path, timestamp, body_str)

    headers = {
        "api-key": API_KEY,
        "Accept": "application/json",
        "timestamp": timestamp,
        "signature": signature,
        "Content-Type": "application/json"
    }

    url = BASE_URL + path

    if method == "GET":
        response = requests.get(url, headers=headers)
    else:
        response = requests.post(url, headers=headers, data=body_str)

    return response

def place_order():
    path = "/v2/orders"

    body = {
        "product_symbol": "BTCUSD",
        "size": 100,
        "side": "sell",
        "order_type": "market_order",
        "stop_order_type": "stop_loss_order",
        "stop_price": "56000",
        "time_in_force": "gtc",
        "reduce_only": True
    }





    response = delta_request("POST", path, body)

    print("STATUS:", response.status_code)
    print("RESPONSE:", response.json())

def get_balance():
    path = "/v2/wallet/balances"
    response = delta_request("GET", path)
    print("BALANCE:", response.json())






# python3
secret_bytes = bytes(COINDCX_API_SECRET, encoding='utf-8')
# python2
secret_bytes = bytes(COINDCX_API_SECRET)

# Generating a timestamp
timeStamp = int(round(time.time() * 1000))

body = {
        "timestamp":timeStamp , # EPOCH timestamp in seconds
        "order": {
        "side": "sell", # buy OR sell
        "pair": "B-RIVER_USDT", # instrument.string
        "order_type": "market_order", # market_order OR limit_order 
        "price": "0.2962", #numeric value
        "stop_price": "0.2962", #numeric value
        "total_quantity": 1, #numerice value
        "leverage": 10, #numerice value
        "notification": "email_notification", # no_notification OR email_notification OR push_notification
        "time_in_force": "good_till_cancel", # good_till_cancel OR fill_or_kill OR immediate_or_cancel
        "hidden": False, # True or False
        "post_only": False, # True or False
        "take_profit_price": 64000.0,
        "stop_loss_price": 61000.0
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
print(data)


if __name__ == "__main__":
    # get_balance()
    place_order()