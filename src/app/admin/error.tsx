"use client";

import { ErrorView } from "@/shared/ui/error-view";

export default function AreaError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView {...props} />;
}
