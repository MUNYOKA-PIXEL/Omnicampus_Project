import { AlertTriangle } from "lucide-react";

const MedicalEmergencyBanner = () => (
  <section className="mt-8 flex flex-col gap-5 rounded-xl bg-red-600 px-6 py-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-8">
    <div className="flex items-center gap-5">
      <AlertTriangle className="h-11 w-11 shrink-0 text-accent" />
      <div>
        <h2 className="text-xl font-bold">Medical emergency?</h2>
        <p className="mt-1 text-base font-medium">
          Call campus security:{" "}
          <a href="tel:+254700123911" className="font-bold underline underline-offset-2">
            +254 700 123 911
          </a>{" "}
          or dial 911
        </p>
      </div>
    </div>
    <a
      href="tel:+254700123911"
      className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-bold text-red-600 transition-colors hover:bg-red-50"
    >
      Call now
    </a>
  </section>
);

export default MedicalEmergencyBanner;
