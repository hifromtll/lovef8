export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-sm leading-6">
      <h1 className="text-2xl font-bold mb-6">LoveF8 Terms of Service</h1>

      <p className="mb-4">
        Welcome to LoveF8. By using this platform, you agree to the following terms.
      </p>

      <h2 className="font-semibold mt-6 mb-2">1. Platform Overview</h2>
      <p className="mb-4">
        LoveF8 is a communication platform that allows users to connect, chat,
        and exchange digital appreciation ("Sparks").
      </p>

      <h2 className="font-semibold mt-6 mb-2">2. Accounts</h2>
      <p className="mb-4">
        You are responsible for maintaining the security of your account and for
        all activity that occurs under it.
      </p>

      <h2 className="font-semibold mt-6 mb-2">3. Sparks</h2>
      <p className="mb-4">
        Sparks are digital items used within the platform. They have no cash value,
        are non-transferable, and are non-refundable.
      </p>

      <h2 className="font-semibold mt-6 mb-2">4. Payments</h2>
      <p className="mb-4">
        Payments are processed through third-party providers. LoveF8 does not store
        full payment details.
      </p>

      <h2 className="font-semibold mt-6 mb-2">5. Host Earnings</h2>
      <p className="mb-4">
        Hosts may earn compensation based on platform activity. LoveF8 reserves the
        right to review, delay, or adjust payouts in cases of suspected abuse,
        fraud, or policy violations.
      </p>

      <h2 className="font-semibold mt-6 mb-2">6. Prohibited Use</h2>
      <p className="mb-4">
        Users may not engage in harassment, fraud, or any illegal activity.
      </p>

      <h2 className="font-semibold mt-6 mb-2">7. Termination</h2>
      <p className="mb-4">
        LoveF8 may suspend or terminate accounts at its discretion if terms are violated.
      </p>

      <h2 className="font-semibold mt-6 mb-2">8. Changes</h2>
      <p className="mb-4">
        These terms may be updated at any time. Continued use of the platform means
        you accept those changes.
      </p>

      <p className="mt-8 text-xs text-gray-500">
        Last updated: {new Date().toLocaleDateString()}
      </p>
    </div>
  );
}