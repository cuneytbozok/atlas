"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Logo } from "@/components/ui/logo";

export default function AboutPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <Logo variant="full" size="lg" className="mb-4" />
            <h1 className="text-3xl font-bold">About ATLAS</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Advanced Team Learning Assistant System - Empowering teams with AI-enhanced collaborative learning
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Our Mission</h2>
            <p>
              ATLAS was created to transform how teams collaborate, learn, and solve problems together. 
              By combining the power of artificial intelligence with collaborative tools, we've built a 
              platform that enhances productivity and facilitates knowledge sharing across organizations.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Core Features</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>AI-powered document analysis and insights</li>
              <li>Collaborative workspaces for teams</li>
              <li>Intelligent knowledge management</li>
              <li>Context-aware AI assistance</li>
              <li>Seamless project organization</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Our Team</h2>
            <p>
              ATLAS is developed by a passionate team of developers, designers, and AI specialists who 
              believe in the transformative power of combining human creativity with artificial intelligence.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Contact Us</h2>
            <p>
              Have questions or feedback? We'd love to hear from you!
            </p>
            <p>
              <strong>Email:</strong> contact@atlas-ai.com
            </p>
          </section>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
} 