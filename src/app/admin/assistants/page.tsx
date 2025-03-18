"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminGuard } from "@/components/auth/admin-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Pencil, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import EditAssistantForm from "./components/edit-assistant-form";

interface Assistant {
  id: string;
  name: string;
  model: string;
  openaiAssistantId: string | null;
  configuration: any;
  createdAt: string;
  updatedAt: string;
  projects: {
    id: string;
    name: string;
    description: string | null;
  }[];
}

export default function AssistantsPage() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchAssistants();
  }, []);

  const fetchAssistants = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/assistants");
      if (!response.ok) {
        throw new Error("Failed to fetch assistants");
      }
      const data = await response.json();
      setAssistants(data);
    } catch (error) {
      console.error("Error fetching assistants:", error);
      toast.error("Failed to load assistants");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAssistant = (assistant: Assistant) => {
    setSelectedAssistant(assistant);
    setIsEditDialogOpen(true);
  };

  const handleAssistantUpdated = () => {
    setIsEditDialogOpen(false);
    fetchAssistants();
    toast.success("Assistant updated successfully");
  };

  const getInstructions = (assistant: Assistant) => {
    if (assistant.configuration && typeof assistant.configuration === 'object') {
      const config = assistant.configuration as Record<string, any>;
      return config.instructions || "No instructions set";
    }
    return "No instructions set";
  };

  return (
    <ProtectedRoute>
      <AdminGuard>
        <MainLayout>
          <div className="space-y-6">
            <div>
              <h1 className="text-display mb-2">Assistants Management</h1>
              <p className="text-muted-foreground text-lg">
                Manage and configure assistants in the system
              </p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>All Assistants</CardTitle>
                <CardDescription>
                  View and manage AI assistants
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="py-2">Name</TableHead>
                          <TableHead className="py-2">Project</TableHead>
                          <TableHead className="py-2">Model</TableHead>
                          <TableHead className="py-2">Last Updated</TableHead>
                          <TableHead className="py-2 w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assistants.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                              No assistants found
                            </TableCell>
                          </TableRow>
                        ) : (
                          assistants.map((assistant) => (
                            <TableRow key={assistant.id} className="py-1">
                              <TableCell className="font-medium py-2">{assistant.name}</TableCell>
                              <TableCell className="py-2">
                                {assistant.projects.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {assistant.projects.map(project => (
                                      <Badge 
                                        key={project.id} 
                                        variant="outline" 
                                        className="cursor-pointer hover:bg-secondary"
                                        onClick={() => router.push(`/projects/${project.id}`)}
                                      >
                                        {project.name}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">No project</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge variant="secondary">
                                  {assistant.model}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground py-2">
                                {formatDistanceToNow(new Date(assistant.updatedAt), { addSuffix: true })}
                              </TableCell>
                              <TableCell className="py-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditAssistant(assistant)}
                                  className="h-7 w-7"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Assistant</DialogTitle>
              </DialogHeader>
              {selectedAssistant && (
                <EditAssistantForm
                  assistant={selectedAssistant}
                  onSuccess={handleAssistantUpdated}
                  onCancel={() => setIsEditDialogOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        </MainLayout>
      </AdminGuard>
    </ProtectedRoute>
  );
} 