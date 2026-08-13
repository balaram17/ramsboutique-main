import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const STATUS_STEPS = [
  { key: "placed", label: "Order Placed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

const TrackOrder = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const response = await api.get("/orders/my");
        setOrders(Array.isArray(response.data) ? response.data : []);
      } catch (e) {
        setError("Unable to load your orders. Please log in again and try once more.");
      }
    };
    load();
  }, [user]);

  const findOrder = (e) => {
    e.preventDefault();
    setError("");
    setSelected(null);
    const value = orderNumber.trim().toLowerCase();
    if (!value) {
      setError("Please enter your order number.");
      return;
    }

    const match = orders.find(
      (order) =>
        String(order.order_no || "").toLowerCase() === value ||
        String(order.id || "").toLowerCase() === value
    );

    if (!match) {
      setError(
        user
          ? "Order not found in your account. Please check the order number."
          : "Please log in to view your order details."
      );
      return;
    }
    setSelected(match);
  };

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/orders/my");
      const list = Array.isArray(response.data) ? response.data : [];
      setOrders(list);
      if (selected) {
        const current = list.find((o) => o.id === selected.id);
        if (current) setSelected(current);
      }
    } catch {
      setError("Unable to refresh order status.");
    } finally {
      setLoading(false);
    }
  };

  const activeIndex = useMemo(() => {
    if (!selected) return -1;
    return STATUS_STEPS.findIndex((step) => step.key === selected.status);
  }, [selected]);

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <Link to="/" className="text-sm text-gray-600 hover:text-black">← Back to Home</Link>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm md:p-10">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Track Order</h1>
          <p className="mb-8 text-gray-600">
            Enter your order number to view the latest status.
          </p>

          {!user && (
            <div className="mb-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              Please <Link to="/login" className="font-semibold underline">log in</Link> to track an order.
            </div>
          )}

          <form onSubmit={findOrder} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Example: RB260813ABC123"
              className="flex-1 rounded-lg border p-3 outline-none focus:ring-2"
            />
            <button
              type="submit"
              disabled={!user}
              className="rounded-lg bg-black px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Track Order
            </button>
          </form>

          {error && (
            <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}

          {user && orders.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">Your recent orders</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {orders.slice(0, 6).map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      setSelected(order);
                      setOrderNumber(order.order_no || order.id || "");
                      setError("");
                    }}
                    className="rounded-lg border p-3 text-left hover:bg-gray-50"
                  >
                    <div className="font-semibold">{order.order_no || order.id}</div>
                    <div className="text-sm text-gray-500">
                      {order.status || "Status unavailable"} · ₹{order.total ?? 0}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected && (
            <div className="mt-10 border-t pt-8">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">Order number</p>
                  <h2 className="text-xl font-bold">{selected.order_no || selected.id}</h2>
                </div>
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  {loading ? "Refreshing..." : "Refresh Status"}
                </button>
              </div>

              {selected.status === "cancelled" ? (
                <div className="rounded-xl bg-red-50 p-5 text-red-700">
                  This order has been cancelled.
                </div>
              ) : (
                <div className="space-y-5">
                  {STATUS_STEPS.map((step, index) => {
                    const completed = activeIndex >= index;
                    return (
                      <div key={step.key} className="flex gap-4">
                        <div className={`mt-1 h-4 w-4 shrink-0 rounded-full ${completed ? "bg-black" : "bg-gray-200"}`} />
                        <div>
                          <div className={`font-semibold ${completed ? "text-gray-900" : "text-gray-400"}`}>
                            {step.label}
                          </div>
                          {index === activeIndex && (
                            <div className="mt-1 text-sm text-gray-500">Current status</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 grid gap-4 rounded-xl bg-gray-50 p-5 sm:grid-cols-2">
                <Detail label="Payment" value={selected.payment_status || "—"} />
                <Detail label="Total" value={`₹${selected.total ?? 0}`} />
                <Detail label="Items" value={selected.items?.length ?? 0} />
                <Detail label="Order Status" value={selected.status || "—"} />
              </div>

              <p className="mt-6 text-sm text-gray-500">
                Need help? Contact us at{" "}
                <a href="mailto:info@ramsboutique.com" className="font-medium underline">
                  info@ramsboutique.com
                </a>.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-1 font-medium text-gray-900">{String(value)}</div>
  </div>
);

export default TrackOrder;
