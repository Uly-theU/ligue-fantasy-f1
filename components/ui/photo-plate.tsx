import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const scrims = {
  bottom: 'bg-gradient-to-t from-night/85 via-night/40 to-night/15',
  left: 'bg-gradient-to-r from-night via-night/70 to-night/15',
  veil: 'bg-night/55',
};

export function PhotoPlate({
  src,
  alt = '',
  className,
  scrim = 'bottom',
  children,
}: {
  src: string;
  alt?: string;
  className?: string;
  scrim?: keyof typeof scrims;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-3xl border border-white/10', className)}>
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover object-[center_62%]" />
      <div className={cn('absolute inset-0', scrims[scrim])} />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgb(255_255_255/0.16)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
