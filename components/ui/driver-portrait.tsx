import { driverPhoto } from '@/lib/photos';
import { cn } from '@/lib/utils';

export function DriverPortrait({
  shortName,
  name,
  className,
}: {
  shortName: string;
  name: string;
  className?: string;
}) {
  const src = driverPhoto(shortName);

  return (
    <div
      className={cn(
        'relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-[10px] font-semibold tracking-wide',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{shortName}</span>
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}
