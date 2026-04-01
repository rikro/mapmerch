import { motion } from 'motion/react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ onConfirm, onCancel }: Props) {
  return (
    <div
      className="absolute inset-0 z-[2000] flex items-center justify-center"
      data-testid="delete-confirm-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4"
      >
        <div className="space-y-1">
          <h3 className="font-headline font-bold text-slate-900 text-base">Delete selection?</h3>
          <p className="text-sm text-slate-500">
            This will remove your drawn shape. You can draw a new one immediately after.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}
