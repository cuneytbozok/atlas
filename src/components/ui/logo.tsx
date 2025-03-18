import React from 'react';
import { cn } from '@/lib/utils';
import { LucideBrain } from 'lucide-react';

type LogoProps = {
  variant?: 'default' | 'icon-only' | 'full';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * Logo component for ATLAS branding
 */
export function Logo({ 
  variant = 'default', 
  size = 'md', 
  className 
}: LogoProps) {
  const sizeClasses = {
    sm: {
      container: 'h-6 w-6',
      icon: 'h-4 w-4',
      text: 'text-sm'
    },
    md: {
      container: 'h-8 w-8',
      icon: 'h-6 w-6',
      text: 'text-base'
    },
    lg: {
      container: 'h-10 w-10',
      icon: 'h-7 w-7',
      text: 'text-lg'
    }
  };

  // For custom branded image
  if (variant === 'default' || variant === 'icon-only') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn('rounded-full bg-primary flex items-center justify-center', sizeClasses[size].container)}>
          <LucideBrain className={cn('text-primary-foreground', sizeClasses[size].icon)} />
        </div>
        {variant === 'default' && (
          <span className={cn('font-bold text-foreground', sizeClasses[size].text)}>ATLAS</span>
        )}
      </div>
    );
  }

  // Full logo with slogan
  return (
    <div className={cn('flex flex-col items-start', className)}>
      <div className="flex items-center gap-2">
        <div className={cn('rounded-full bg-primary flex items-center justify-center', sizeClasses[size].container)}>
          <LucideBrain className={cn('text-primary-foreground', sizeClasses[size].icon)} />
        </div>
        <span className={cn('font-bold text-foreground', sizeClasses[size].text)}>ATLAS</span>
      </div>
      <span className="text-xs text-muted-foreground ml-10">Advanced Team Learning Assistant System</span>
    </div>
  );
}