'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  // UX-I-02 (2026-06-22): the Radix slider Thumb is the focusable element
  // screen readers announce, but `aria-label` set on the Root doesn't
  // automatically propagate to the Thumb in this @radix-ui/react-slider
  // version. Forward it explicitly so the Thumb announces the descriptive
  // label callers pass (e.g. "Music gain — +3 dB"), not a generic "slider".
  // Other aria-* attributes set on Root keep working as before because
  // Radix Root handles those internally.
  const ariaLabel = (props as { 'aria-label'?: string })['aria-label'];
  const ariaLabelledBy = (props as { 'aria-labelledby'?: string })['aria-labelledby'];
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex w-full touch-none select-none items-center',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
