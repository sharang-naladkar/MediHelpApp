"use client";

import AppGateway from "@/components/AppGateway";

/**
 * Single entry point. The profile lives only in the client's localStorage, so
 * the gateway decides routing on the client: no profile → Setup, profile → Home.
 */
export default function Page() {
  return <AppGateway />;
}
