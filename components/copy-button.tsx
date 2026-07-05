'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface CopyButtonProps {
  getText: () => string;
  children: React.ReactNode;
  copiedChildren?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
}

export function CopyButton({
  getText,
  children,
  copiedChildren = '✓ Copied',
  variant = 'outline',
  size = 'sm',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleCopy}>
      {copied ? copiedChildren : children}
    </Button>
  );
}
