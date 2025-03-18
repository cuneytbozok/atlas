"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function PrivacyPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p>
              ATLAS ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information about you when you use our services.
            </p>
            <p>
              By using ATLAS, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Information We Collect</h2>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">2.1 Personal Information</h3>
              <p>
                We may collect personal information that you provide directly to us, such as:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account information (name, email, profile picture)</li>
                <li>Content you upload (documents, files, messages)</li>
                <li>Information you provide in communications with us</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">2.2 Usage Information</h3>
              <p>
                We automatically collect certain information about your interaction with our services, including:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Log data (IP address, browser type, pages visited)</li>
                <li>Device information</li>
                <li>Usage patterns and preferences</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve our services</li>
              <li>Develop new features and functionality</li>
              <li>Process transactions and send related information</li>
              <li>Send administrative messages and updates</li>
              <li>Respond to your comments and questions</li>
              <li>Monitor and analyze trends and usage</li>
              <li>Protect against fraud and abuse</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Data Security</h2>
            <p>
              We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at privacy@atlas-ai.com.
            </p>
          </section>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
} 