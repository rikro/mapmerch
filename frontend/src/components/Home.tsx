import { ArrowRight, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeProps {
  onStart: () => void;
}

export default function Home({ onStart }: HomeProps) {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center overflow-hidden px-8 lg:px-20">
        <div className="container mx-auto grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 z-10">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-primary font-semibold tracking-widest uppercase text-xs mb-4 block"
            >
              Map Art · Print on Demand
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-headline text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6"
            >
              Wear Your <br /> <span className="text-primary">Streets.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 text-lg lg:text-xl mb-10 max-w-md leading-relaxed"
            >
              Draw any neighborhood on the map. We generate custom street art and print it on premium products — delivered to your door.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <button
                onClick={onStart}
                className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-4 rounded-lg font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
              >
                Start Your Map
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={onStart}
                className="border border-slate-200 text-slate-900 px-8 py-4 rounded-lg font-bold hover:bg-slate-50 transition-colors"
              >
                See How It Works
              </button>
            </motion.div>
          </div>
          <div className="lg:col-span-7 relative h-[560px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
              animate={{ opacity: 1, scale: 1, rotate: 2 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 bg-slate-100 rounded-xl overflow-hidden translate-x-4 shadow-2xl"
            >
              <img
                src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1200"
                alt="Map Art Preview"
                className="w-full h-full object-cover"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -50, rotate: -10 }}
              animate={{ opacity: 1, x: -20, rotate: -6 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="absolute top-1/2 left-0 -translate-y-1/2 w-56 h-72 bg-white rounded-lg overflow-hidden shadow-2xl z-20 hidden md:block"
            >
              <img
                src="https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&q=80&w=800"
                alt="Print Mockup"
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Styles Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-8">
          <div className="mb-16">
            <h2 className="font-headline text-3xl font-bold mb-4">Four Artistic Styles</h2>
            <p className="text-slate-600 max-w-xl">Each style transforms your street data into a distinct visual aesthetic.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { title: 'Minimal', desc: 'Clean black on white.', bg: '#ffffff', stroke: '#000000' },
              { title: 'Blueprint', desc: 'Technical precision in cyan.', bg: '#1a3a5c', stroke: '#a8c8f0' },
              { title: 'Watercolor', desc: 'Warm earthy tones.', bg: '#f5f0e8', stroke: '#8b6f47' },
              { title: 'Bold', desc: 'High contrast gold.', bg: '#1a1a1a', stroke: '#f5c518' },
            ].map((style) => (
              <motion.div
                key={style.title}
                whileHover={{ y: -8 }}
                className="group relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer shadow-sm border border-slate-100"
                style={{ background: style.bg }}
              >
                <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice">
                  <polyline points="20,220 60,100 100,160 160,50 190,80" fill="none" stroke={style.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="10,140 70,180 130,120 190,150" fill="none" stroke={style.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="30,80 90,50 150,90 190,30" fill="none" stroke={style.stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <h3 className="text-white font-headline text-xl font-bold">{style.title}</h3>
                  <p className="text-white/80 text-sm">{style.desc}</p>
                </div>
                <div className="absolute top-4 left-4 opacity-100 group-hover:opacity-0 transition-opacity">
                  <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ color: style.stroke, background: `${style.stroke}20` }}>
                    {style.title}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <h2 className="font-headline text-4xl font-extrabold mb-6 tracking-tight">Premium Print Products</h2>
              <p className="text-slate-600 leading-relaxed">From museum-grade fine art prints to stretched canvas — every product is made to order with your unique map design.</p>
            </div>
            <button onClick={onStart} className="text-primary font-bold flex items-center gap-2 group">
              Create Your Design
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { name: 'Fine Art Print', price: 'from $25', img: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&q=80&w=800' },
              { name: 'Poster', price: 'from $30', img: 'https://images.unsplash.com/photo-1513519247388-446602b3b03a?auto=format&fit=crop&q=80&w=800' },
              { name: 'Canvas Print', price: 'from $55', img: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=800' },
            ].map((product) => (
              <div key={product.name} className="group">
                <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden mb-6 relative">
                  <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-4 right-4 glass-panel p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <h4 className="font-headline text-xl font-bold mb-1">{product.name}</h4>
                <p className="text-slate-500 text-sm mb-2">Museum Grade · Archival Inks</p>
                <p className="font-bold text-primary">{product.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 bg-primary">
        <div className="container mx-auto px-8 text-center">
          <h2 className="font-headline text-4xl font-extrabold text-white mb-6">Your neighborhood, as art.</h2>
          <p className="text-white/80 text-lg mb-10 max-w-md mx-auto">Draw any area on the map and get a unique piece of street art printed on premium products.</p>
          <button
            onClick={onStart}
            className="bg-white text-primary px-10 py-4 rounded-xl font-bold shadow-xl hover:scale-105 transition-transform"
          >
            Start Drawing — It's Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16 px-8">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-start gap-10">
          <div>
            <div className="text-2xl font-black font-headline mb-4">MapMerch</div>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">Custom map art printed on premium products. Your streets, your story.</p>
          </div>
          <div className="flex gap-16">
            <div>
              <h5 className="font-bold mb-4">Create</h5>
              <ul className="space-y-3 text-sm text-slate-400">
                <li><button onClick={onStart} className="hover:text-primary transition-colors">Map Explorer</button></li>
                <li><button className="hover:text-primary transition-colors">Style Guide</button></li>
                <li><button className="hover:text-primary transition-colors">Print Quality</button></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-4">Support</h5>
              <ul className="space-y-3 text-sm text-slate-400">
                <li><button className="hover:text-primary transition-colors">Shipping Info</button></li>
                <li><button className="hover:text-primary transition-colors">Contact</button></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="container mx-auto mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} MapMerch. All rights reserved.</p>
          <div className="flex gap-8">
            <button className="hover:text-white transition-colors">Privacy Policy</button>
            <button className="hover:text-white transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
