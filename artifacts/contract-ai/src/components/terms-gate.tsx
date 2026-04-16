import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UserAgreementPopup } from "@/components/user-agreement-popup";

export function TermsGate({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe();
  const [accepted, setAccepted] = useState(false);

  if (isLoading || !user) return <>{children}</>;

  const termsAccepted = (user as Record<string, unknown>).termsAccepted === true;

  if (termsAccepted || accepted) return <>{children}</>;

  return (
    <UserAgreementPopup
      onAccept={() => {
        setAccepted(true);
        queryClient.invalidateQueries({ queryKey: ["getMe"] });
      }}
      onDecline={() => {
        setLocation("/", { replace: true });
      }}
    />
  );
}
