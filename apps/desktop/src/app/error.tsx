"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[80vh] flex-col items-center justify-center text-center">
      <div className="bg-surface-container-high border border-outline-variant rounded-lg p-xl max-w-[600px] w-full tech-shadow">
        <span className="material-symbols-outlined text-error text-6xl mb-md">warning</span>
        <h2 className="text-[24px] font-bold text-on-surface mb-sm font-[Inter]">Something went wrong!</h2>
        <p className="text-on-surface-variant mb-xl font-[Inter]">{error.message || "An unexpected error occurred while rendering the page."}</p>
        
        <div className="flex justify-center gap-md">
          <button
            onClick={() => reset()}
            className="bg-primary text-on-primary px-6 py-2 rounded font-semibold hover:bg-primary-container transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-outline text-on-surface px-6 py-2 rounded font-semibold hover:bg-surface-bright transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
