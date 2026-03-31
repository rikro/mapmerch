import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

import MapView from './components/MapView.js';
import ArtworkPreview from './components/ArtworkPreview.js';
import StyleSelector from './components/StyleSelector.js';
import ProductSelector from './components/ProductSelector.js';
import CheckoutForm from './components/CheckoutForm.js';

import { useSession } from './hooks/useSession.js';
import { useArtwork } from './hooks/useArtwork.js';
import { createPaymentIntent } from './api/client.js';

import { STYLE_OPTIONS, PRODUCT_OPTIONS } from './constants.js';
import { AppStep, PolygonCoords, StyleName, ProductType } from './types.js';

const stripePromise = loadStripe(
  (import.meta as unknown as { env: { VITE_STRIPE_PUBLISHABLE_KEY: string } }).env.VITE_STRIPE_PUBLISHABLE_KEY,
);

export default function App() {
  const sessionToken = useSession();
  const { draftId, svg, loading, error, generate } = useArtwork(sessionToken);

  const [step, setStep] = useState<AppStep>('draw');
  const [polygon, setPolygon] = useState<PolygonCoords | null>(null);
  const [style, setStyle] = useState<StyleName>('minimal-line-art');
  const [product, setProduct] = useState<ProductType>('print');
  const [size, setSize] = useState<string>('12x12');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const handleAreaTooLarge = useCallback(() => {
    setAreaError('Selected area is too large. Please draw a smaller boundary.');
  }, []);

  const handlePolygonComplete = useCallback(
    (p: PolygonCoords) => {
      setPolygon(p);
      setAreaError(null);
      generate(p, style);
      setStep('customize');
    },
    [generate, style],
  );

  const handleStyleChange = useCallback(
    (newStyle: StyleName) => {
      setStyle(newStyle);
      if (polygon) generate(polygon, newStyle);
    },
    [generate, polygon],
  );

  const handleProceedToCheckout = async () => {
    const { clientSecret } = await createPaymentIntent(product, size);
    setStripeClientSecret(clientSecret);
    setStep('checkout');
  };

  const handleOrderComplete = (id: string) => {
    setOrderId(id);
    setStep('confirmation');
  };

  if (step === 'draw') {
    return (
      <div>
        {areaError && (
          <div
            style={{
              position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: '#fff', border: '1px solid #f00', borderRadius: 8,
              padding: '12px 24px', zIndex: 1000, color: '#c00',
            }}
            role="alert"
          >
            {areaError}
          </div>
        )}
        <MapView
          onPolygonComplete={handlePolygonComplete}
          onAreaTooLarge={handleAreaTooLarge}
        />
      </div>
    );
  }

  if (step === 'customize') {
    return (
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* Left: map stays visible */}
        <div style={{ flex: 1 }}>
          <MapView
            onPolygonComplete={handlePolygonComplete}
            onAreaTooLarge={handleAreaTooLarge}
          />
        </div>

        {/* Right: controls */}
        <div style={{ width: 400, padding: 24, overflowY: 'auto', borderLeft: '1px solid #eee' }}>
          <h2>Your Artwork</h2>
          <ArtworkPreview svg={svg} loading={loading} error={error} />

          <h3 style={{ marginTop: 24 }}>Style</h3>
          <StyleSelector
            options={STYLE_OPTIONS}
            selected={style}
            onChange={handleStyleChange}
          />

          <h3 style={{ marginTop: 24 }}>Product</h3>
          <ProductSelector
            options={PRODUCT_OPTIONS}
            selectedProduct={product}
            selectedSize={size}
            onProductChange={setProduct}
            onSizeChange={setSize}
          />

          <button
            onClick={handleProceedToCheckout}
            disabled={!draftId || loading}
            style={{
              marginTop: 24, padding: '12px 24px', borderRadius: 6,
              background: '#333', color: '#fff', border: 'none',
              fontSize: 16, cursor: 'pointer', width: '100%',
            }}
          >
            Continue to Checkout
          </button>
        </div>
      </div>
    );
  }

  if (step === 'checkout' && stripeClientSecret && draftId) {
    return (
      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px' }}>
        <h2>Checkout</h2>
        <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
          <CheckoutForm
            draftId={draftId}
            sessionToken={sessionToken}
            product={product}
            size={size}
            onOrderComplete={handleOrderComplete}
          />
        </Elements>
      </div>
    );
  }

  if (step === 'confirmation') {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
        <h1>Order placed!</h1>
        <p>Your artwork is being prepared for printing.</p>
        <p style={{ color: '#888', fontSize: 14 }}>Order ID: {orderId}</p>
        <button
          onClick={() => {
            setStep('draw');
            setPolygon(null);
            setOrderId(null);
            setStripeClientSecret(null);
          }}
          style={{
            marginTop: 24, padding: '12px 24px', borderRadius: 6,
            background: '#333', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          Create another
        </button>
      </div>
    );
  }

  return null;
}
