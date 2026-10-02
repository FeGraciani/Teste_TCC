"use client";

import { ErrorView } from "@/shared/ui/error-view";

export default function SiteError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="px-4 sm:px-6">
      <ErrorView {...props} />
    </div>
  );
}
