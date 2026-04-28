export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-sm leading-6">
      <h1 className="text-2xl font-bold mb-6">LoveF8 Privacy Policy</h1>

      <p className="mb-4">
        LoveF8 respects your privacy. This Privacy Policy explains what information
        we collect, how we use it, and how we protect it.
      </p>

      <h2 className="font-semibold mt-6 mb-2">1. Information We Collect</h2>
      <p className="mb-4">
        We may collect information such as your email address, username, profile
        details, account activity, messages, and platform usage information.
      </p>

      <h2 className="font-semibold mt-6 mb-2">2. How We Use Information</h2>
      <p className="mb-4">
        We use collected information to operate the platform, provide features,
        improve user experience, maintain safety, process transactions, and
        communicate important account or service updates.
      </p>

      <h2 className="font-semibold mt-6 mb-2">3. Payments</h2>
      <p className="mb-4">
        Payments are processed by third-party providers. LoveF8 does not store full
        payment card details on its own servers.
      </p>

      <h2 className="font-semibold mt-6 mb-2">4. Sharing of Information</h2>
      <p className="mb-4">
        We do not sell your personal information. We may share limited information
        with trusted service providers that help us operate the platform, process
        payments, or comply with legal obligations.
      </p>

      <h2 className="font-semibold mt-6 mb-2">5. User Content</h2>
      <p className="mb-4">
        Information you choose to place on your profile or send through the platform
        may be visible to other users as part of the service.
      </p>

      <h2 className="font-semibold mt-6 mb-2">6. Data Security</h2>
      <p className="mb-4">
        We use reasonable safeguards intended to protect your information, but no
        system can be guaranteed to be completely secure.
      </p>

      <h2 className="font-semibold mt-6 mb-2">7. Account Management</h2>
      <p className="mb-4">
        You may update certain account information through your profile or account
        settings.
      </p>

      <h2 className="font-semibold mt-6 mb-2">8. Changes to This Policy</h2>
      <p className="mb-4">
        We may update this Privacy Policy from time to time. Continued use of the
        platform after updates means you accept the revised policy.
      </p>

      <p className="mt-8 text-xs text-gray-500">
        Last updated: {new Date().toLocaleDateString()}
      </p>
    </div>
  );
}