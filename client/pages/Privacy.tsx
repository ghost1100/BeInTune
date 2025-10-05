export default function Privacy() {
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-4 text-sm text-foreground/70">
        This privacy policy explains how In Tune Music Tuition collects and uses personal data. It is a draft and should be reviewed by legal counsel.
      </p>

      <h2 className="mt-6 font-semibold">Data we collect</h2>
      <ul className="list-disc ml-6 mt-2 text-sm text-foreground/70">
        <li>Contact information (name, email, phone)</li>
        <li>Student profile information (age, parent contact, preferences)</li>
        <li>Messages and discussion posts (ephemeral by default)</li>
        <li>Booking and payment-related metadata (no payments are processed in-app)</li>
      </ul>

      <h2 className="mt-6 font-semibold">How we use data</h2>
      <p className="text-sm text-foreground/70 mt-2">We use personal data to provide lessons booking, communicate between students and teachers, and moderate content. Messages are automatically removed after 21 days unless saved by users.</p>

      <h2 className="mt-6 font-semibold">Your rights</h2>
      <p className="text-sm text-foreground/70 mt-2">Users can request access to their data, correction, or deletion. Contact the site admin for data requests.</p>

      <h2 className="mt-6 font-semibold">Contact</h2>
      <p className="text-sm text-foreground/70 mt-2">Email: bookings@intunemusictuition.co.uk</p>
    </div>
  );
}
