import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

// StrictMode removed — it double-invokes effects which tears down and
// recreates the Leaflet map mid-draw, breaking leaflet-draw's internal state.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
