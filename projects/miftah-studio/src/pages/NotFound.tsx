import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Compass, Home } from 'lucide-react';
import { BrandMark } from '@/components/Brand';
import { Button } from '@/components/ui/primitives';

export function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative w-full max-w-lg overflow-hidden p-8 text-center"
      >
        <div className="pointer-events-none absolute -top-16 start-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface-2">
          <BrandMark size={38} />
        </div>
        <p className="text-gradient numeric text-6xl font-black">404</p>
        <h1 className="mt-3 text-lg font-bold text-ink">الصفحة غير موجودة</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
          الرابط الذي حاولت الوصول إليه غير متاح أو تم نقله. يمكنك العودة إلى لوحة التحكم ومتابعة العمل.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link to="/"><Button variant="primary"><Home size={15} /> لوحة التحكم</Button></Link>
          <Link to="/licenses"><Button variant="secondary"><Compass size={15} /> إدارة التراخيص <ArrowRight size={13} /></Button></Link>
        </div>
      </motion.div>
    </div>
  );
}
