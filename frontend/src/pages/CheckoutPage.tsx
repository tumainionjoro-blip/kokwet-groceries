import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { addAddress } from "../services/authService";
import { createOrder } from "../services/orderService";
import { formatKES } from "../utils";
import Button from "../components/ui/Button";
import BrandVisual from "../components/ui/BrandVisual";

const FREE_DELIVERY_THRESHOLD = 3000;
const STANDARD_DELIVERY_FEE = 150;
const MPESA_RECEIVING_NUMBER = import.meta.env.VITE_MPESA_RECEIVING_NUMBER || "0793048318";
const AREAS = ["Kitale Town Centre", "Milimani", "Bidii", "Tuwan", "Mitume", "Kipsongo", "Matisi", "Sikhendu"];

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const saved = user?.addresses?.find((address) => address.isDefault) || user?.addresses?.[0];
  const [recipientName, setRecipientName] = useState(saved?.recipientName || user?.name || "");
  const [phone, setPhone] = useState(saved?.phone || user?.phone || "");
  const [area, setArea] = useState(saved?.area || AREAS[0]);
  const [landmark, setLandmark] = useState(saved?.landmark || "");
  const [mapsUrl, setMapsUrl] = useState(saved?.mapsUrl || "");
  const [latitude, setLatitude] = useState<number | undefined>(saved?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(saved?.longitude);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) return <Navigate to="/login?redirect=/checkout" replace />;
  if (items.length === 0) return <Navigate to="/cart" replace />;

  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const grandTotal = subtotal + deliveryFee;
  const mapsLink = mapsUrl.trim() || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${landmark}, ${area}`)}`;

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is unavailable in this browser. Paste a Google Maps link instead.");
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude);
        setLongitude(coords.longitude);
        setMapsUrl(`https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`);
        setLocationBusy(false);
        setError("");
      },
      () => {
        setError("We couldn't read your location. Allow location access or paste a Google Maps link.");
        setLocationBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const address = { label: "Home", area, landmark: landmark.trim(), phone, recipientName, mapsUrl: mapsLink, latitude, longitude };
      await addAddress(address);
      await refreshUser();
      const order = await createOrder({
        items: items.map((item) => ({ productId: item.product._id, quantity: item.quantity })),
        deliveryAddress: address,
        paymentMethod: "mpesa",
        notes: notes || undefined,
      });
      clearCart();
      navigate(`/order-confirmation/${order._id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-brand-400 outline-none";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-xl font-bold text-gray-800 mb-5">Checkout</h1>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <section className="border border-gray-100 rounded-xl shadow-card p-5">
            <h2 className="font-bold text-gray-800 mb-4">Delivery details</h2>
            <p className="text-xs text-gray-500 mb-4">These details are saved to your account and stay the same for your next order until you update them.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium text-gray-600">Recipient name<input required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className={inputClass} /></label>
              <label className="text-sm font-medium text-gray-600">Phone number<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" className={inputClass} /></label>
              <label className="text-sm font-medium text-gray-600">Delivery area<select value={area} onChange={(e) => setArea(e.target.value)} className={`${inputClass} bg-white`}>{AREAS.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-sm font-medium text-gray-600">Landmark (required)<input required value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Near Total petrol station" className={inputClass} /></label>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-600">Google Maps link (optional)</label>
              <input type="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="Paste a pin or place link from Google Maps" className={inputClass} />
              <div className="mt-2 flex flex-wrap gap-3 items-center">
                <button type="button" onClick={useCurrentLocation} disabled={locationBusy} className="text-sm text-brand-700 font-semibold hover:underline">{locationBusy ? "Finding location..." : "Use my current location"}</button>
                <a href={mapsLink} target="_blank" rel="noreferrer" className="text-sm text-brand-700 font-semibold hover:underline">Preview destination in Google Maps</a>
              </div>
              <p className="text-xs text-gray-400 mt-1">A maps link is generated from your area and landmark if you leave this blank.</p>
            </div>
            <label className="block mt-4 text-sm font-medium text-gray-600">Notes for the rider (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} /></label>
          </section>

          <section className="border border-gray-100 rounded-xl shadow-card p-5">
            <h2 className="font-bold text-gray-800 mb-2">Payment method</h2>
            <div className="flex items-center gap-3 border border-brand-500 bg-brand-50 rounded-lg p-4">
              <BrandVisual slot="checkoutPayment" fallback="📱" className="h-8 w-8 text-xl" imageClassName="h-full w-full rounded object-cover" />
              <div>
                <p className="font-semibold text-sm text-gray-800">M-Pesa · Pochi la Biashara</p>
                <p className="text-xs text-gray-500">An STK Push will be sent to your delivery phone. Payment is received by {MPESA_RECEIVING_NUMBER}.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="h-fit border border-gray-100 rounded-xl shadow-card p-5 space-y-3">
          <h2 className="font-bold text-gray-800">Order summary</h2>
          <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">{items.map(({ product, quantity }) => <li key={product._id} className="flex justify-between text-gray-600"><span className="line-clamp-1">{product.name} × {quantity}</span><span className="font-medium text-gray-800 shrink-0 ml-2">{formatKES(product.price * quantity)}</span></li>)}</ul>
          <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatKES(subtotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Delivery fee</span><span>{deliveryFee === 0 ? "Free" : formatKES(deliveryFee)}</span></div>
            <div className="flex justify-between font-bold text-gray-800 text-base pt-1"><span>Total</span><span>{formatKES(grandTotal)}</span></div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" fullWidth size="lg" disabled={submitting}>{submitting ? "Placing order..." : `Place order — ${formatKES(grandTotal)}`}</Button>
          <p className="text-xs text-gray-400 text-center">Confirm the M-Pesa prompt on your phone to complete payment.</p>
        </div>
      </form>
    </div>
  );
}
