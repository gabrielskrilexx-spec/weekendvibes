import React from "react";
import { AlertTriangle, LogIn } from "lucide-react";
import { getSafeReturnPath } from "@shared/const";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AdminAuthRecoveryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AdminAuthRecoveryDialog({
  open,
  onOpenChange,
}: AdminAuthRecoveryDialogProps) {
  const handleLogin = () => {
    const returnTo =
      typeof window === "undefined"
        ? "/admin"
        : getSafeReturnPath(
            `${window.location.pathname}${window.location.search}`
          );
    startLogin(returnTo);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-orange-300/25 bg-zinc-950 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-300/10 text-orange-200">
            <AlertTriangle size={21} aria-hidden="true" />
          </div>
          <DialogTitle>Sessão administrativa necessária</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Sua sessão não está autorizada para esta operação. Entre novamente
            para continuar acompanhando a ingestão com segurança.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continuar depois
          </Button>
          <Button
            onClick={handleLogin}
            className="bg-gradient-to-r from-orange-400 to-fuchsia-500 text-zinc-950 hover:brightness-110"
          >
            <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
            Entrar novamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
