# Trade Automation Terminal

A full-stack crypto trading automation dashboard integrating with CoinDCX Futures. Features real-time data, order management, and scheduled trading.

## Features

### Backend (FastAPI)

- **REST API**: Endpoints for trading operations (Place/Cancel Orders, Manage Positions).
- **WebSockets**: Real-time streaming of Positions, Order History, and Orderbook data.
- **Scheduled Trading**: System to schedule trades for future execution (local time).
- **CoinDCX Integration**: Secure HMAC-SHA256 authenticated requests to CoinDCX Derivatives API.

### Frontend (Next.js 16)

- **Real-time Dashboard**: Live updates for all data.
- **Order Functions**:
  - Place Market and Limit Orders.
  - Adjustable Leverage and Quantity.
  - Buy/Sell Toggle.
- **Position Management**:
  - View active positions with PnL, Mark Price, Entry Price.
  - Exit individual positions or **Exit All** positions instantly.
- **Order History**:
  - Paginated view of past orders.
  - status tracking.
  - Cancel active orders.
- **Scheduled Trades**:
  - Form to schedule future orders.
  - List of pending scheduled trades with Cancel option.
- **Orderbook**: Live visual representation of Bids and Asks.

## Prerequisites

- **Node.js** (v18+ recommended)
- **Python** (v3.10+ recommended)
- **CoinDCX Account** with API Keys (Futures enabled)

## Setup & Run Instructions

### 1. Backend Setup

Navigate to the `Backend` directory:

```bash
cd Backend
```

Create a `.env` file in the `Backend` directory with your CoinDCX credentials:

```bash
# Backend/.env
COINDCX_API_KEY=your_api_key_here
COINDCX_API_SECRET=your_api_secret_here
DELTA_API_KEY=optional_if_needed
DELTA_API_SECRET=optional_if_needed
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Start the Backend server:

```bash
# Run from the root directory or inside Backend (adjust path accordingly)
# If inside Backend/ dir:
uvicorn main:app --reload --port 8000
```

The backend API will run at `http://localhost:8000`.

### 2. Frontend Setup

Navigate to the `frontend` directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm i
```

Start the Frontend development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

- **Backend/**
  - `main.py`: Main FastAPI application, WebSocket handlers, and Scheduler.
  - `utils.py`: CoinDCX API helpers (Authentication, HTTP requests).
  - `app.py`: Legacy/Alternative script.
- **frontend/**
  - `app/page.tsx`: Main Dashboard UI containing all feature sections.
  - `lib/api.ts`: API client functions (assumed).
  - `components/`: UI components (Shadcn UI).
