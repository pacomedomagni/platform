'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, Tablet, Smartphone, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme/types';
import { generateThemeCSS } from '@/lib/services/theme-service';

interface PreviewFrameProps {
  theme: Theme;
  responsive: 'desktop' | 'tablet' | 'mobile';
  onResponsiveChange: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  className?: string;
}

const FRAME_SIZES = {
  desktop: { width: '100%', height: '100%' },
  tablet: { width: '768px', height: '1024px' },
  mobile: { width: '375px', height: '667px' },
};

export function PreviewFrame({
  theme,
  responsive,
  onResponsiveChange,
  className,
}: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    // In a real implementation, this would be the actual storefront URL
    // For now, we'll create a simple preview
    setPreviewUrl('/preview');
  }, []);

  useEffect(() => {
    if (!iframeRef.current || !theme) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    // Generate CSS from theme
    const themeCSS = generateThemeCSS(theme);

    // Inject theme CSS into iframe
    const styleId = 'theme-preview-styles';
    let styleElement = iframeDoc.getElementById(styleId);

    if (!styleElement) {
      styleElement = iframeDoc.createElement('style');
      styleElement.id = styleId;
      iframeDoc.head.appendChild(styleElement);
    }

    styleElement.textContent = themeCSS;
  }, [theme]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = currentSrc;
    }
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-1">
          <Button
            variant={responsive === 'desktop' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onResponsiveChange('desktop')}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant={responsive === 'tablet' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onResponsiveChange('tablet')}
          >
            <Tablet className="h-4 w-4" />
          </Button>
          <Button
            variant={responsive === 'mobile' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onResponsiveChange('mobile')}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleOpenInNewTab}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Container */}
      <div className="flex-1 bg-muted/20 overflow-auto flex items-start justify-center p-4">
        <div
          className={cn(
            'relative bg-background shadow-xl transition-all duration-300',
            responsive === 'desktop' && 'w-full h-full',
            responsive === 'tablet' && 'rounded-lg',
            responsive === 'mobile' && 'rounded-2xl'
          )}
          style={{
            width: FRAME_SIZES[responsive].width,
            height: FRAME_SIZES[responsive].height,
            maxWidth: '100%',
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            sandbox="allow-same-origin allow-scripts"
            title="Theme Preview"
          />
        </div>
      </div>
    </div>
  );
}
