import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideFolder, LucideUsers } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-display mb-2">Welcome to ATLAS</h1>
          <p className="text-muted-foreground text-lg">
            Your AI-powered workspace for enhanced productivity
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <DashboardCard
            title="Projects"
            description="Manage your AI-assisted projects and workflows"
            icon={<LucideFolder className="h-8 w-8 text-primary" />}
            action={
              <Button asChild>
                <Link href="/projects">View Projects</Link>
              </Button>
            }
          />
          <DashboardCard
            title="Team"
            description="Collaborate with your team members in real-time"
            icon={<LucideUsers className="h-8 w-8 text-secondary" />}
            action={<Button variant="secondary">View Team</Button>}
          />
        </div>
      </div>
    </MainLayout>
  );
}

interface DashboardCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function DashboardCard({ title, description, icon, action }: DashboardCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        {icon && <div className="mb-2">{icon}</div>}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action && (
        <CardFooter className="pt-4">
          {action}
        </CardFooter>
      )}
    </Card>
  );
}
