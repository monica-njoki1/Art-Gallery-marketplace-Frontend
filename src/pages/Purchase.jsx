// src/pages/Purchase.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { usePaystackPayment } from "react-paystack";

const API = "https://art-gallery-marketplace-backend.onrender.com";
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;


// ─── Helper: get logged-in user from localStorage ────────────────────────────
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

// ─── Inner component that initialises Paystack per purchase ──────────────────
function PaystackButton({ user, artwork, paymentMethod, onSuccess, onClose, disabled }) {
  const config = {
    reference: `art_${artwork.id}_${Date.now()}`,
    email: user?.email ?? "guest@example.com",
    amount: Math.round(artwork.price * 100), // Paystack expects kobo/cents
    currency: "KES",
    publicKey: PAYSTACK_PUBLIC_KEY,
    metadata: {
      custom_fields: [
        { display_name: "Artwork", variable_name: "artwork_title", value: artwork.title },
        { display_name: "Payment Method", variable_name: "payment_method", value: paymentMethod },
      ],
    },
  };

  const initializePayment = usePaystackPayment(config);

  function handleClick() {
    initializePayment({ onSuccess, onClose });
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold
                 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-all duration-200 flex items-center justify-center gap-2"
    >
      <span>🔒</span>
      <span>Pay KES {Number(artwork.price).toLocaleString()} via Paystack</span>
    </button>
  );
}

// ─── Main Purchase Component ──────────────────────────────────────────────────
export default function Purchase() {
  const [searchParams] = useSearchParams();
  const artworkIdParam = searchParams.get("artworkId");

  const [artwork, setArtwork] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" }); // type: success | warning | error
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const user = getUser(); // { id, name, email }
  const userId = user?.id ?? 1; // fallback to 1 only if no auth yet

  // ── Load artwork ────────────────────────────────────────────────────────────
  const loadArtwork = useCallback(async () => {
    try {
      if (artworkIdParam) {
        const res = await fetch(`${API}/artworks/${artworkIdParam}`);
        if (res.ok) setArtwork(await res.json());
      } else {
        const res = await fetch(`${API}/artworks`);
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) setArtwork(list[0]);
      }
    } catch (err) {
      console.error(err);
      showMessage("Failed to load artwork.", "error");
    }
  }, [artworkIdParam]);

  // ── Load cart ───────────────────────────────────────────────────────────────
  const loadCart = useCallback(async () => {
    try {
      const res = await fetch(`${API}/cart/${userId}`);
      setCartItems(res.ok ? await res.json() : []);
    } catch {
      setCartItems([]);
    }
  }, [userId]);

  useEffect(() => {
    loadArtwork();
    loadCart();
  }, [loadArtwork, loadCart]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function showMessage(text, type = "error") {
    setMessage({ text, type });
    // Auto-clear after 6 seconds
    setTimeout(() => setMessage({ text: "", type: "" }), 6000);
  }

  // ── After Paystack confirms payment on its side ─────────────────────────────
  async function handlePaystackSuccess(transaction) {
    setLoading(true);
    try {
      const res = await fetch(`${API}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          artwork_id: artwork.id,
          payment_method: paymentMethod,
          payment_reference: transaction.reference, // verified by backend
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Purchase confirmed! Check your email for the receipt. 🎉", "success");
        loadCart();
      } else {
        showMessage(data.error || "Purchase could not be saved after payment.", "error");
      }
    } catch {
      showMessage("Network error saving your purchase. Contact support with ref: " + transaction.reference, "error");
    } finally {
      setLoading(false);
    }
  }

  function handlePaystackClose() {
    showMessage("Payment window closed. No charge was made.", "warning");
  }

  // ── Add to cart ─────────────────────────────────────────────────────────────
  async function handleAddToCart() {
    if (!artwork) return;
    try {
      const res = await fetch(`${API}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, artwork_id: artwork.id }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Added to cart!", "success");
        loadCart();
      } else {
        showMessage(data.error || data.message || "Could not add to cart.", "error");
      }
    } catch {
      showMessage("Network error adding to cart.", "error");
    }
  }

  // ── Cart checkout ───────────────────────────────────────────────────────────
  async function handleCheckoutCart() {
    try {
      const res = await fetch(`${API}/cart/checkout/${userId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showMessage("Checkout complete — all purchases saved! 🎉", "success");
        setCartItems([]);
      } else {
        showMessage(data.error || "Checkout failed.", "error");
      }
    } catch {
      showMessage("Network error during checkout.", "error");
    }
  }

  // ── Remove cart item ────────────────────────────────────────────────────────
  async function handleRemoveCartItem(cartId) {
    try {
      const res = await fetch(`${API}/cart/${cartId}`, { method: "DELETE" });
      if (res.ok) {
        showMessage("Removed from cart.", "success");
        loadCart();
      } else {
        const data = await res.json();
        showMessage(data.error || "Could not remove item.", "error");
      }
    } catch {
      showMessage("Network error.", "error");
    }
  }

  // ── Message colour helper ───────────────────────────────────────────────────
  const msgStyle = {
    success: "bg-green-50 border border-green-200 text-green-800",
    warning: "bg-yellow-50 border border-yellow-200 text-yellow-800",
    error: "bg-red-50 border border-red-200 text-red-700",
  };

  const canPay = !!paymentMethod && !!artwork && !loading;

  return (
    <div className="max-w-5xl mx-auto mt-10 p-8 bg-gray-50 rounded-xl shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-center">🖼️ Complete Your Purchase</h1>

      {/* ── Artwork + Payment ── */}
      {!artwork ? (
        <p className="text-center text-gray-500 animate-pulse">Loading artwork...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">

          {/* LEFT: Artwork card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <img
              src={artwork.image_url}
              alt={artwork.title}
              onError={(e) => (e.target.src = "/placeholder.png")}
              className="w-full h-64 object-cover rounded-lg mb-4"
            />
            <h2 className="text-2xl font-semibold">{artwork.title}</h2>
            <p className="text-gray-500">by {artwork.artist?.name ?? "Unknown"}</p>
            <p className="text-2xl font-bold mt-2">
              KES {Number(artwork.price).toLocaleString()}
            </p>
            <p className="text-green-600 mt-2 text-sm">✔ Available & Ready for Purchase</p>
            <button
              onClick={handleAddToCart}
              className="mt-4 w-full border border-blue-600 text-blue-600 py-2 rounded-lg
                         hover:bg-blue-50 transition-all duration-200"
            >
              🛒 Add to Cart Instead
            </button>
          </div>

          {/* RIGHT: Payment form */}
          <div className="bg-white p-6 rounded-lg shadow flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-4">Purchase Information</h3>

              <div className="space-y-2 mb-6 text-sm">
                <p>
                  👤 Buyer:{" "}
                  <strong>{user?.userName ?? "Guest (log in for receipt)"}</strong>
                </p>
                <p>
                  📧 Email:{" "}
                  <strong>{user?.email ?? "—"}</strong>
                </p>
                <p>
                  🖼️ Artwork: <strong>{artwork.title}</strong>
                </p>
                <p>
                  💲 Price:{" "}
                  <strong>KES {Number(artwork.price).toLocaleString()}</strong>
                </p>
              </div>

              {/* Payment method selector */}
              <div className="mb-6">
                <label className="block mb-2 font-medium text-sm">
                  🪪 Select Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border p-3 rounded-lg bg-gray-50 focus:outline-none
                             focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Please select —</option>
                  <option value="card">💳 Credit / Debit Card</option>
                  <option value="mpesa">📱 M-Pesa</option>
                  <option value="paypal">🅿️ PayPal</option>
                </select>
                {!paymentMethod && (
                  <p className="text-xs text-gray-400 mt-1">
                    You must select a payment method to proceed.
                  </p>
                )}
              </div>
            </div>

            {/* Paystack button — only mounts when we have what we need */}
            {canPay ? (
              <PaystackButton
                user={user}
                artwork={artwork}
                paymentMethod={paymentMethod}
                onSuccess={handlePaystackSuccess}
                onClose={handlePaystackClose}
                disabled={loading}
              />
            ) : (
              <button
                disabled
                className="w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-semibold
                           cursor-not-allowed flex items-center justify-center gap-2"
              >
                🔒 Select a payment method to continue
              </button>
            )}

            <p className="text-xs text-gray-400 mt-3 text-center">
              Payments are processed securely by Paystack. You'll receive an email
              confirmation &amp; digital certificate within 24 hours.
            </p>
          </div>
        </div>
      )}

      {/* ── Cart Section ── */}
      <div className="mt-10 bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">🛒 Your Cart</h3>
        {cartItems.length === 0 ? (
          <p className="text-gray-500 text-sm">No items in cart yet.</p>
        ) : (
          <>
            <ul className="space-y-3 mb-4">
              {cartItems.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between items-center border p-3 rounded-lg
                             hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="font-medium">{item.artwork.title}</div>
                    <div className="text-sm text-gray-500">
                      by {item.artwork.artist?.name ?? "Unknown"}
                    </div>
                    <div className="text-sm font-semibold">
                      KES {Number(item.artwork.price).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveCartItem(item.id)}
                    className="text-sm text-red-500 hover:text-red-700 hover:underline transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between">
              <button
                onClick={handleCheckoutCart}
                className="bg-indigo-600 text-white py-2 px-6 rounded-lg
                           hover:bg-indigo-700 transition-all duration-200 font-medium"
              >
                Checkout All
              </button>
              <div className="text-right">
                <span className="text-sm text-gray-500">Total</span>
                <div className="text-xl font-bold">
                  KES{" "}
                  {cartItems
                    .reduce((sum, it) => sum + (it.artwork?.price || 0), 0)
                    .toLocaleString()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Status Message ── */}
      {message.text && (
        <div
          className={`mt-6 text-center text-sm font-medium px-4 py-3 rounded-lg
                      ${msgStyle[message.type] ?? msgStyle.error}`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}