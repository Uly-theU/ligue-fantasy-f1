import type { Metadata } from 'next';
import { IntroTimingEditor } from '@/components/fx/IntroTimingEditor';

export const metadata: Metadata = {title: 'Motion Studio — Fantasy F1', robots: {index: false, follow: false}};
export default function IntroTimingPage() { return <IntroTimingEditor />; }
