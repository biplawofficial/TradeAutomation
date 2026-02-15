"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  placeOrder,
  cancelOrder,
  exitPosition,
  exitAllPositions,
  scheduleTrade,
  getScheduledTrades,
  cancelScheduledTrade,
  connectPositionsWS,
  connectOrderbookWS,
  connectOrdersWS,
} from "@/lib/api";

// ─── Order Form ────────────────────────────────────────────
function OrderForm() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market_order" | "limit_order">(
    "market_order"
  );
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [leverage, setLeverage] = useState("15");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data: {
        side: string;
        quantity: number;
        order_type: string;
        price?: number;
        leverage?: number;
      } = {
        side,
        quantity: parseFloat(quantity),
        order_type: orderType,
        leverage: parseInt(leverage),
      };
      if (orderType === "limit_order" && price) {
        data.price = parseFloat(price);
      }
      const res = await placeOrder(data);
      setResult(res.success ? "Order placed" : `Error: ${res.error}`);
    } catch (e: unknown) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  };

  return (
    <Card className="border-[#262626]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-widest text-[#737373]">
          Place Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* side toggle */}
        <div className="flex gap-2">
          <Button
            variant={side === "buy" ? "default" : "outline"}
            className={
              side === "buy"
                ? "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                : "flex-1 border-[#262626] text-[#737373] hover:text-white hover:border-emerald-600"
            }
            onClick={() => setSide("buy")}
          >
            BUY
          </Button>
          <Button
            variant={side === "sell" ? "default" : "outline"}
            className={
              side === "sell"
                ? "flex-1 bg-red-600 hover:bg-red-700 text-white"
                : "flex-1 border-[#262626] text-[#737373] hover:text-white hover:border-red-600"
            }
            onClick={() => setSide("sell")}
          >
            SELL
          </Button>
        </div>

        {/* type */}
        <Select
          value={orderType}
          onValueChange={(v) =>
            setOrderType(v as "market_order" | "limit_order")
          }
        >
          <SelectTrigger className="border-[#262626] bg-[#0a0a0a]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0a0a] border-[#262626]">
            <SelectItem value="market_order">Market</SelectItem>
            <SelectItem value="limit_order">Limit</SelectItem>
          </SelectContent>
        </Select>

        {/* quantity */}
        <Input
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border-[#262626] bg-[#0a0a0a]"
        />

        {/* price (limit only) */}
        {orderType === "limit_order" && (
          <Input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border-[#262626] bg-[#0a0a0a]"
          />
        )}

        {/* leverage */}
        <Input
          type="number"
          placeholder="Leverage"
          value={leverage}
          onChange={(e) => setLeverage(e.target.value)}
          className="border-[#262626] bg-[#0a0a0a]"
        />

        <Button
          onClick={handleSubmit}
          disabled={loading || !quantity}
          className={`w-full font-bold ${
            side === "buy"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-red-600 hover:bg-red-700"
          } text-white`}
        >
          {loading ? "Placing..." : `${side.toUpperCase()} ORDER`}
        </Button>

        {result && (
          <p
            className={`text-xs ${
              result.startsWith("Error") ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {result}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Schedule Trade ────────────────────────────────────────
interface ScheduledTrade {
  id: string;
  side: string;
  quantity: number;
  order_type: string;
  price?: number;
  leverage: number;
  execute_at: string;
  status: string;
  [key: string]: unknown;
}

function ScheduleTradeSection() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market_order" | "limit_order">(
    "market_order"
  );
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [leverage, setLeverage] = useState("15");
  const [executeAt, setExecuteAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [trades, setTrades] = useState<ScheduledTrade[]>([]);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await getScheduledTrades();
      if (res.success) setTrades(res.data || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 2000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  const handleSchedule = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data: {
        side: string;
        quantity: number;
        order_type: string;
        price?: number;
        leverage: number;
        execute_at: string;
      } = {
        side,
        quantity: parseFloat(quantity),
        order_type: orderType,
        leverage: parseInt(leverage),
        execute_at: executeAt,
      };
      if (orderType === "limit_order" && price) {
        data.price = parseFloat(price);
      }
      const res = await scheduleTrade(data);
      if (res.success) {
        setResult("Trade scheduled");
        setQuantity("");
        setPrice("");
        setExecuteAt("");
        fetchTrades();
      } else {
        setResult(`Error: ${res.error}`);
      }
    } catch (e: unknown) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    setCancelLoading(id);
    try {
      await cancelScheduledTrade(id);
      fetchTrades();
    } catch {
      /* ignore */
    }
    setCancelLoading(null);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending":
        return "border-yellow-600 text-yellow-400";
      case "executed":
        return "border-emerald-600 text-emerald-400";
      case "failed":
        return "border-red-600 text-red-400";
      case "cancelled":
        return "border-[#737373] text-[#737373]";
      default:
        return "border-[#262626] text-[#737373]";
    }
  };

  return (
    <Card className="border-[#262626]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-widest text-[#737373]">
          Schedule Trade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* side toggle */}
        <div className="flex gap-2">
          <Button
            variant={side === "buy" ? "default" : "outline"}
            className={
              side === "buy"
                ? "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                : "flex-1 border-[#262626] text-[#737373] hover:text-white hover:border-emerald-600"
            }
            onClick={() => setSide("buy")}
          >
            BUY
          </Button>
          <Button
            variant={side === "sell" ? "default" : "outline"}
            className={
              side === "sell"
                ? "flex-1 bg-red-600 hover:bg-red-700 text-white"
                : "flex-1 border-[#262626] text-[#737373] hover:text-white hover:border-red-600"
            }
            onClick={() => setSide("sell")}
          >
            SELL
          </Button>
        </div>

        {/* type */}
        <Select
          value={orderType}
          onValueChange={(v) =>
            setOrderType(v as "market_order" | "limit_order")
          }
        >
          <SelectTrigger className="border-[#262626] bg-[#0a0a0a]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0a0a] border-[#262626]">
            <SelectItem value="market_order">Market</SelectItem>
            <SelectItem value="limit_order">Limit</SelectItem>
          </SelectContent>
        </Select>

        {/* quantity */}
        <Input
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border-[#262626] bg-[#0a0a0a]"
        />

        {/* price (limit only) */}
        {orderType === "limit_order" && (
          <Input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border-[#262626] bg-[#0a0a0a]"
          />
        )}

        {/* leverage */}
        <Input
          type="number"
          placeholder="Leverage"
          value={leverage}
          onChange={(e) => setLeverage(e.target.value)}
          className="border-[#262626] bg-[#0a0a0a]"
        />

        {/* execute at (datetime-local) */}
        <div>
          <label className="text-xs text-[#737373] mb-1 block">
            Execute At
          </label>
          <Input
            type="datetime-local"
            value={executeAt}
            onChange={(e) => setExecuteAt(e.target.value)}
            className="border-[#262626] bg-[#0a0a0a] text-white [color-scheme:dark]"
          />
        </div>

        <Button
          onClick={handleSchedule}
          disabled={loading || !quantity || !executeAt}
          className={`w-full font-bold ${
            side === "buy"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-red-600 hover:bg-red-700"
          } text-white`}
        >
          {loading ? "Scheduling..." : "SCHEDULE"}
        </Button>

        {result && (
          <p
            className={`text-xs ${
              result.startsWith("Error") ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {result}
          </p>
        )}

        {/* scheduled trades list */}
        {trades.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#262626]">
            <p className="text-xs text-[#737373] uppercase tracking-widest mb-2">
              Scheduled
            </p>
            <div className="space-y-2">
              {trades.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-xs bg-[#0a0a0a] border border-[#262626] rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        t.side === "buy"
                          ? "border-emerald-600 text-emerald-400"
                          : "border-red-600 text-red-400"
                      }`}
                    >
                      {t.side.toUpperCase()}
                    </Badge>
                    <span className="font-mono">{t.quantity}</span>
                    <span className="text-[#737373]">@</span>
                    <span className="font-mono text-[#737373]">
                      {new Date(t.execute_at).toLocaleTimeString()}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusColor(t.status)}`}
                    >
                      {t.status}
                    </Badge>
                  </div>
                  {t.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(t.id)}
                      disabled={cancelLoading === t.id}
                      className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white text-xs h-6"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Positions (live WS) ──────────────────────────────────
interface Position {
  id: string;
  pair?: string;
  side?: string;
  active_pos?: number | string;
  avg_price?: number | string;
  mark_price?: number | string;
  leverage?: number | string;
  [key: string]: unknown;
}

function PositionsSection() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [connected, setConnected] = useState(false);
  const [exitLoading, setExitLoading] = useState<string | null>(null);

  useEffect(() => {
    const ws = connectPositionsWS(
      (data: unknown) => {
        const msg = data as { success: boolean; data: Position[] };
        if (msg.success && msg.data) {
          setPositions(msg.data);
          setConnected(true);
        }
      },
      () => setConnected(false)
    );
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, []);

  const handleExit = async (id: string) => {
    setExitLoading(id);
    try {
      await exitPosition(id);
    } catch {
      /* ignore */
    }
    setExitLoading(null);
  };

  const handleExitAll = async () => {
    setExitLoading("all");
    try {
      await exitAllPositions();
    } catch {
      /* ignore */
    }
    setExitLoading(null);
  };

  return (
    <Card className="border-[#262626]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-widest text-[#737373]">
          Positions
        </CardTitle>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExitAll}
            disabled={exitLoading === "all"}
            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white text-xs"
          >
            Exit All
          </Button>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-[#737373]">
              {connected ? "LIVE" : "OFF"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-xs text-[#737373]">No positions</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#262626] hover:bg-transparent">
                  <TableHead className="text-[#737373] text-xs">ID</TableHead>
                  <TableHead className="text-[#737373] text-xs">Pair</TableHead>
                  <TableHead className="text-[#737373] text-xs">Side</TableHead>
                  <TableHead className="text-[#737373] text-xs">Size</TableHead>
                  <TableHead className="text-[#737373] text-xs">Entry</TableHead>
                  <TableHead className="text-[#737373] text-xs">Mark</TableHead>
                  <TableHead className="text-[#737373] text-xs">PnL</TableHead>
                  <TableHead className="text-[#737373] text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos) => {
                  const activePos = parseFloat(String(pos.active_pos || 0));
                  const avgPrice = parseFloat(String(pos.avg_price || 0));
                  const markPrice = parseFloat(String(pos.mark_price || 0));
                  const pnl = (markPrice - avgPrice) * activePos;
                  const positionSide =
                    activePos > 0 ? "LONG" : activePos < 0 ? "SHORT" : "—";
                  return (
                    <TableRow
                      key={pos.id}
                      className="border-[#262626] hover:bg-[#1a1a1a]"
                    >
                      <TableCell className="text-xs font-mono">
                        {String(pos.id).slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-xs">
                        {pos.pair || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            positionSide === "LONG"
                              ? "border-emerald-600 text-emerald-400"
                              : positionSide === "SHORT"
                              ? "border-red-600 text-red-400"
                              : "border-[#262626] text-[#737373]"
                          }`}
                        >
                          {positionSide}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {Math.abs(activePos)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {avgPrice.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {markPrice.toFixed(4)}
                      </TableCell>
                      <TableCell
                        className={`text-xs font-mono ${
                          pnl >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExit(pos.id)}
                          disabled={exitLoading === pos.id}
                          className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white text-xs h-7"
                        >
                          Exit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Order History (paginated, live WS) ────────────────────
interface Order {
  id: string;
  pair?: string;
  side?: string;
  order_type?: string;
  total_quantity?: number | string;
  price?: number | string;
  status?: string;
  [key: string]: unknown;
}

const ORDERS_PER_PAGE = 5;

function OrderHistorySection() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = connectOrdersWS(
      (data: unknown) => {
        const msg = data as { success: boolean; data: Order[]; page?: number };
        if (msg.success && msg.data) {
          setOrders(msg.data);
          setConnected(true);
        }
      },
      () => setConnected(false)
    );
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ page: 1, size: ORDERS_PER_PAGE }));
    };
    ws.onclose = () => setConnected(false);
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const changePage = (newPage: number) => {
    if (newPage < 1) return;
    setPage(newPage);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ page: newPage, size: ORDERS_PER_PAGE })
      );
    }
  };

  const handleCancel = async (id: string) => {
    setCancelLoading(id);
    try {
      await cancelOrder(id);
    } catch {
      /* ignore */
    }
    setCancelLoading(null);
  };

  const hideCancel = (status?: string) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return (
      s === "filled" ||
      s === "completed" ||
      s === "executed" ||
      s === "cancelled" ||
      s === "canceled"
    );
  };

  return (
    <Card className="border-[#262626]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-widest text-[#737373]">
          Order History
        </CardTitle>
        <div className="flex items-center gap-3">
          {/* pagination */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(page - 1)}
              disabled={page <= 1}
              className="border-[#262626] text-[#737373] hover:text-white text-xs h-7 w-7 p-0"
            >
              ←
            </Button>
            <span className="text-xs text-[#737373] px-2">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(page + 1)}
              disabled={orders.length < ORDERS_PER_PAGE}
              className="border-[#262626] text-[#737373] hover:text-white text-xs h-7 w-7 p-0"
            >
              →
            </Button>
          </div>
          {/* live indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-[#737373]">
              {connected ? "LIVE" : "OFF"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-xs text-[#737373]">No orders</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#262626] hover:bg-transparent">
                  <TableHead className="text-[#737373] text-xs">ID</TableHead>
                  <TableHead className="text-[#737373] text-xs">Pair</TableHead>
                  <TableHead className="text-[#737373] text-xs">Side</TableHead>
                  <TableHead className="text-[#737373] text-xs">Type</TableHead>
                  <TableHead className="text-[#737373] text-xs">Qty</TableHead>
                  <TableHead className="text-[#737373] text-xs">Price</TableHead>
                  <TableHead className="text-[#737373] text-xs">Status</TableHead>
                  <TableHead className="text-[#737373] text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const side = (order.side || "").toUpperCase();
                  const filled = hideCancel(order.status);
                  return (
                    <TableRow
                      key={order.id}
                      className="border-[#262626] hover:bg-[#1a1a1a]"
                    >
                      <TableCell className="text-xs font-mono">
                        {String(order.id).slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-xs">
                        {order.pair || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            side === "BUY"
                              ? "border-emerald-600 text-emerald-400"
                              : "border-red-600 text-red-400"
                          }`}
                        >
                          {side || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {(order.order_type || "").replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {order.total_quantity || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {order.price || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {order.status || "—"}
                      </TableCell>
                      <TableCell>
                        {!filled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelLoading === order.id}
                            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white text-xs h-7"
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── OrderBook ─────────────────────────────────────────────
interface OrderbookData {
  bids?: Record<string, string>;
  asks?: Record<string, string>;
}

function OrderbookSection() {
  const [book, setBook] = useState<OrderbookData | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = connectOrderbookWS(
      (data: unknown) => {
        const msg = data as { success: boolean; data: OrderbookData };
        if (msg.success && msg.data) {
          setBook(msg.data);
          setConnected(true);
        }
      },
      () => setConnected(false)
    );
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, []);

  const bids = book?.bids
    ? Object.entries(book.bids)
        .map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
        .sort((a, b) => b.price - a.price)
        .slice(0, 10)
    : [];

  const asks = book?.asks
    ? Object.entries(book.asks)
        .map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
        .sort((a, b) => a.price - b.price)
        .slice(0, 10)
    : [];

  return (
    <Card className="border-[#262626]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-widest text-[#737373]">
          Order Book
        </CardTitle>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-[#737373]">
            {connected ? "LIVE" : "OFF"}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Bids */}
          <div>
            <div className="flex justify-between text-xs text-[#737373] mb-2 px-1">
              <span>PRICE</span>
              <span>QTY</span>
            </div>
            {bids.length === 0 ? (
              <p className="text-xs text-[#737373]">—</p>
            ) : (
              bids.map((b, i) => (
                <div
                  key={i}
                  className="flex justify-between text-xs py-0.5 px-1 hover:bg-[#1a1a1a]"
                >
                  <span className="text-emerald-400 font-mono">
                    {b.price.toFixed(4)}
                  </span>
                  <span className="text-[#737373] font-mono">{b.qty}</span>
                </div>
              ))
            )}
          </div>

          {/* Asks */}
          <div>
            <div className="flex justify-between text-xs text-[#737373] mb-2 px-1">
              <span>PRICE</span>
              <span>QTY</span>
            </div>
            {asks.length === 0 ? (
              <p className="text-xs text-[#737373]">—</p>
            ) : (
              asks.map((a, i) => (
                <div
                  key={i}
                  className="flex justify-between text-xs py-0.5 px-1 hover:bg-[#1a1a1a]"
                >
                  <span className="text-red-400 font-mono">
                    {a.price.toFixed(4)}
                  </span>
                  <span className="text-[#737373] font-mono">{a.qty}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function Home() {
  return (
    <main className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <h1 className="text-lg font-bold tracking-widest uppercase text-white">
            Trade Terminal
          </h1>
          <Badge
            variant="outline"
            className="border-[#262626] text-[#737373] text-xs"
          >
            B-RIVER_USDT
          </Badge>
        </div>

        {/* top row: order form + order book */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OrderForm />
          <OrderbookSection />
        </div>

        {/* schedule trade */}
        <ScheduleTradeSection />

        {/* positions (live) */}
        <PositionsSection />

        {/* order history */}
        <OrderHistorySection />
      </div>
    </main>
  );
}
