import { useState, FormEvent } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ShippingAddress, ProductType } from '../types.js';
import { createOrder } from '../api/client.js';

interface Props {
  draftId: string;
  sessionToken: string;
  product: ProductType;
  size: string;
  onOrderComplete: (orderId: string) => void;
}

const EMPTY_ADDRESS: ShippingAddress = {
  name: '', address1: '', address2: '', city: '',
  state: '', zip: '', country: 'US', email: '',
};

export default function CheckoutForm({
  draftId, sessionToken, product, size, onOrderComplete,
}: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof ShippingAddress, value: string) {
    setAddress(a => ({ ...a, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed');
      setSubmitting(false);
      return;
    }

    if (!paymentIntent) {
      setError('Payment incomplete. Please try again.');
      setSubmitting(false);
      return;
    }

    try {
      const { orderId } = await createOrder(
        draftId, sessionToken, product, size, address, paymentIntent.id,
      );
      onOrderComplete(orderId);
    } catch {
      setError('Order creation failed. Please contact support.');
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '8px 12px',
    marginBottom: 12, borderRadius: 6, border: '1px solid #ccc',
    fontSize: 16, boxSizing: 'border-box',
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <h3>Shipping Information</h3>
      <input placeholder="Full name" required style={inputStyle}
        value={address.name} onChange={e => updateField('name', e.target.value)} />
      <input placeholder="Address line 1" required style={inputStyle}
        value={address.address1} onChange={e => updateField('address1', e.target.value)} />
      <input placeholder="Address line 2 (optional)" style={inputStyle}
        value={address.address2} onChange={e => updateField('address2', e.target.value)} />
      <input placeholder="City" required style={inputStyle}
        value={address.city} onChange={e => updateField('city', e.target.value)} />
      <input placeholder="State" required style={inputStyle}
        value={address.state} onChange={e => updateField('state', e.target.value)} />
      <input placeholder="ZIP code" required style={inputStyle}
        value={address.zip} onChange={e => updateField('zip', e.target.value)} />
      <input placeholder="Email" type="email" required style={inputStyle}
        value={address.email} onChange={e => updateField('email', e.target.value)} />

      <h3>Payment</h3>
      <PaymentElement />

      {error && <p style={{ color: 'red', marginTop: 12 }} role="alert">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !stripe}
        style={{
          marginTop: 16, padding: '12px 24px', borderRadius: 6,
          background: '#333', color: '#fff', border: 'none',
          fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Placing order…' : 'Place Order'}
      </button>
    </form>
  );
}
