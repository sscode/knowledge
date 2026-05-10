import { Suspense } from "react";
import { ManageClient } from "./manage-client";

export default function ManagePage() {
  return (
    <Suspense fallback={<div className="muted-text">Loading manager...</div>}>
      <ManageClient />
    </Suspense>
  );
}
