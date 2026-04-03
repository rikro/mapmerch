import { Edit3, ShoppingCart } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { AppStep } from '../types.js';

interface LayoutProps {
  children: React.ReactNode;
  step: AppStep;
  onStepChange: (step: AppStep) => void;
}

export default function Layout({ children, step, onStepChange }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm flex justify-between items-center px-8 h-20">
        <div className="flex items-center gap-8">
          <span
            className="text-2xl font-black text-slate-900 font-headline cursor-pointer"
            onClick={() => onStepChange('home')}
          >
            MapMerch
          </span>
          <div className="hidden md:flex items-center gap-8 font-headline font-semibold tracking-tight">
            {[
              { id: 'draw' as AppStep, label: 'Map Explorer' },
              { id: 'customize' as AppStep, label: 'Studio' },
              { id: 'checkout' as AppStep, label: 'Checkout' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onStepChange(item.id)}
                className={cn(
                  'pb-1 transition-colors hover:text-primary',
                  step === item.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-slate-500',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="p-2 rounded-full hover:bg-slate-100 transition-transform active:scale-90 relative"
            onClick={() => onStepChange('checkout')}
          >
            <ShoppingCart className="w-6 h-6 text-slate-600" />
          </button>
        </div>
      </nav>

      <main className="flex-1 pt-20">
        {children}
      </main>

      {/* FAB on home/draw */}
      {(step === 'home' || step === 'draw') && (
        <button
          className="fixed bottom-8 right-8 bg-primary text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50"
          onClick={() => onStepChange('draw')}
        >
          <Edit3 className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
