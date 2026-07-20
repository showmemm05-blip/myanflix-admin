import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { RoleDefinition } from "@/types/role";

export function RoleCard({ role, userCount }: { role: RoleDefinition; userCount: number }) {
  return (
    <Card className="glass-card border-white/[0.08]">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{role.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
          </div>
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: `color-mix(in oklch, ${role.color} 15%, transparent)`, color: role.color }}
          >
            {userCount}
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          {role.capabilities.map((capability) => (
            <li key={capability} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-3.5 shrink-0 text-success" />
              {capability}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
