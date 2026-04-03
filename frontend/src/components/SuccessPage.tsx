import { CheckCircle, Map as MapIcon, Truck, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

interface SuccessPageProps {
  orderId: string;
  onReset: () => void;
}

export default function SuccessPage({ orderId, onReset }: SuccessPageProps) {
  return (
    <div className="pt-12 pb-20 px-6 max-w-5xl mx-auto">
      {/* Success Header */}
      <div className="text-center mb-16">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-6"
        >
          <CheckCircle className="w-10 h-10 fill-primary/20" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-headline text-5xl font-extrabold tracking-tight text-slate-900 mb-4"
        >
          Your masterpiece is on its way.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-500 text-lg max-w-xl mx-auto"
        >
          Thank you for your order. We've received your design and our production team is already preparing your custom map art piece.
        </motion.p>
      </div>

      {/* Order Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Order Core Info */}
        <div className="md:col-span-8 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Order Number</p>
                <h2 className="font-headline text-2xl font-bold text-slate-900 font-mono">#{orderId.slice(0, 12).toUpperCase()}</h2>
              </div>
              <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Status: Processing</p>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="font-headline text-lg font-bold text-slate-900">What's Next</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { step: '01', title: 'Artwork Generation', desc: 'Your SVG is being finalized and prepared for print.' },
                  { step: '02', title: 'Production', desc: 'Printed and quality-checked by our fulfillment partner.' },
                  { step: '03', title: 'Shipping', desc: 'Carefully packaged and dispatched to your address.' },
                ].map((item) => (
                  <div key={item.step} className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-widest text-primary/60 block mb-2">{item.step}</span>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Logistics Sidebar */}
        <div className="md:col-span-4 space-y-6">
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center gap-3 mb-4 text-primary">
              <Truck className="w-5 h-5" />
              <span className="font-bold text-sm uppercase tracking-wider">Estimated Delivery</span>
            </div>
            <p className="text-2xl font-headline font-bold text-slate-900 mb-1">7–12 Business Days</p>
            <p className="text-sm text-slate-500">Standard production + shipping</p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center gap-3 mb-4 text-slate-400">
              <MapPin className="w-5 h-5" />
              <span className="font-bold text-sm uppercase tracking-wider">Order Confirmation</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              A confirmation email will be sent to your email address with tracking details once your order ships.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mt-16 flex flex-col md:flex-row justify-center items-center gap-4">
        <button
          onClick={onReset}
          className="bg-primary text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-primary/20"
        >
          Create Another Map
          <MapIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-24 text-center border-t border-slate-100 pt-12">
        <p className="text-slate-400 text-sm">
          Need to make a change?{' '}
          <span className="font-bold text-slate-900">Contact support with your order ID: {orderId}</span>
        </p>
      </div>
    </div>
  );
}
