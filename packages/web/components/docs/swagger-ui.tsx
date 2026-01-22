'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-muted-foreground">Loading API documentation...</div>
    </div>
  ),
});

interface SwaggerUIWrapperProps {
  spec: object;
}

export function SwaggerUIWrapper({ spec }: SwaggerUIWrapperProps) {
  return (
    <div className="swagger-ui-wrapper">
      <SwaggerUI spec={spec} />
      <style jsx global>{`
        .swagger-ui-wrapper {
          background: white;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin-bottom: 2rem;
        }
        .swagger-ui .info .title {
          font-size: 2rem !important;
        }
        .swagger-ui .opblock-tag {
          border-bottom: 1px solid #e5e7eb;
        }
        .swagger-ui .opblock {
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .swagger-ui .opblock .opblock-summary {
          border-radius: 0.5rem;
        }
        .swagger-ui .btn {
          border-radius: 0.375rem;
        }
        .swagger-ui select {
          border-radius: 0.375rem;
        }
        .swagger-ui input[type=text] {
          border-radius: 0.375rem;
        }
        .swagger-ui textarea {
          border-radius: 0.375rem;
        }
        .swagger-ui .model-box {
          border-radius: 0.5rem;
        }
        .dark .swagger-ui-wrapper {
          background: #0f172a;
        }
        .dark .swagger-ui {
          filter: invert(1) hue-rotate(180deg);
        }
        .dark .swagger-ui .opblock {
          filter: invert(1) hue-rotate(180deg);
        }
      `}</style>
    </div>
  );
}
