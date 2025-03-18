"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, FormEvent } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface EditAssistantFormProps {
  assistant: Assistant;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EditAssistantForm({ assistant, onSuccess, onCancel }: EditAssistantFormProps) {
  const [formData, setFormData] = useState({
    name: assistant.name || "",
    model: assistant.model || "gpt-4o",
    instructions: "",
    projectName: assistant.projects.length > 0 ? assistant.projects[0].name : "",
    projectDescription: assistant.projects.length > 0 ? assistant.projects[0].description || "" : "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Extract instructions from configuration
  useEffect(() => {
    if (assistant.configuration && typeof assistant.configuration === 'object') {
      const config = assistant.configuration as Record<string, any>;
      if (config.instructions) {
        setFormData(prev => ({
          ...prev,
          instructions: config.instructions
        }));
      }
    }
  }, [assistant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Create submission data that keeps the original project name and description
    // (since the UI fields are just for display)
    const submissionData = {
      ...formData,
      projectName: assistant.projects.length > 0 ? assistant.projects[0].name : formData.projectName,
      projectDescription: assistant.projects.length > 0 ? assistant.projects[0].description : formData.projectDescription,
    };

    try {
      const response = await fetch(`/api/assistants/${assistant.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update assistant");
      }

      onSuccess();
    } catch (err) {
      console.error("Error updating assistant:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to update assistant. Please try again.";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="name">Assistant Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          name="model"
          value={formData.model}
          onChange={handleChange}
          placeholder="Enter model name (e.g. gpt-4o, gpt-4-turbo)"
          required
        />
        <p className="text-xs text-muted-foreground">
          Popular models: gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4-turbo
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="instructions">Custom Instructions</Label>
        <Textarea
          id="instructions"
          name="instructions"
          value={formData.instructions}
          onChange={handleChange}
          rows={4}
          placeholder="Enter custom instructions for the assistant..."
        />
        <p className="text-xs text-muted-foreground">
          These instructions guide the assistant's responses and behavior.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="projectName">Project Name</Label>
          <Input
            id="projectName"
            name="projectName"
            value={formData.projectName}
            onChange={handleChange}
            disabled
            className="opacity-70"
          />
          <p className="text-xs text-muted-foreground">
            Referenced from the project.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="projectDescription">Project Description</Label>
          <Textarea
            id="projectDescription"
            name="projectDescription"
            value={formData.projectDescription}
            onChange={handleChange}
            rows={2}
            disabled
            className="opacity-70"
            placeholder="No description"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Updating..." : "Update Assistant"}
        </Button>
      </div>
    </form>
  );
} 