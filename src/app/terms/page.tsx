"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function TermsPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p>
              Welcome to ATLAS. By using our services, you agree to these Terms of Service ("Terms"). Please read them carefully.
            </p>
            <p>
              ATLAS provides a collaborative AI-powered workspace platform ("Service"). By using our Service, you are agreeing to these Terms. If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Using Our Services</h2>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">2.1 Account Registration</h3>
              <p>
                To use certain features of the Service, you must register for an account. You agree to provide accurate information and keep it updated. You are responsible for maintaining the security of your account and password.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">2.2 Acceptable Use</h3>
              <p>
                You agree not to misuse our Service. For example, you must not:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the intellectual property rights of others</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Interfere with the operation of the Service</li>
                <li>Upload malicious code or content</li>
                <li>Conduct any automated use of the system</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Content and Intellectual Property</h2>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">3.1 Your Content</h3>
              <p>
                You retain ownership of any intellectual property rights that you hold in content you upload to the Service. By uploading content, you grant ATLAS a worldwide, royalty-free license to use, host, store, and display that content in connection with providing the Service.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">3.2 ATLAS Intellectual Property</h3>
              <p>
                The Service and its original content, features, and functionality are owned by ATLAS and are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works based on our Service without our express written permission.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including breach of these Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, ATLAS shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide notice of significant changes by posting a notice on our website or by sending you an email.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at legal@atlas-ai.com.
            </p>
          </section>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
} 