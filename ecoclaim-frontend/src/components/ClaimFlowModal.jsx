import { useState, useRef } from "react";
import { fileToDataUrl, downscaleImage } from "../lib/imageCapture";

const STEPS = {
  PICK: "pick",
  VERIFYING: "verifying",
  SUCCESS: "success",
  FAILED: "failed",
  ERROR: "error",
};

export default function ClaimFlowModal({ report, onClose, onSubmit }) {
  const [step, setStep] = useState(STEPS.PICK);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [verification, setVerification] = useState(null);
  const [gpsCheck, setGpsCheck] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  if (!report) return null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setStep(STEPS.VERIFYING);

    try {
      const [preview, downscaled] = await Promise.all([
        fileToDataUrl(file),
        downscaleImage(file),
      ]);
      setPreviewUrl(preview);

      const result = await onSubmit({
        report_id: report.id,
        image: downscaled,
      });

      setVerification(result.verification);
      setGpsCheck(result.gps_check);
      setStep(result.success ? STEPS.SUCCESS : STEPS.FAILED);
    } catch (err) {
      setError(err.message);
      setStep(STEPS.ERROR);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000] p-4"
      onClick={step !== STEPS.VERIFYING ? onClose : undefined}
    >
      <div
        className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            Claim cleanup · {report.bounty_tokens} tokens
          </h3>
          {step !== STEPS.VERIFYING && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-6">
          {step === STEPS.PICK && (
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-4">
                Take an "after" photo at the same location. Our AI will compare
                it to the original report to verify the cleanup.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition"
              >
                📷 Take "after" photo
              </button>
            </div>
          )}

          {step === STEPS.VERIFYING && (
            <div className="text-center py-8">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="preview"
                  className="rounded-lg max-h-48 mx-auto mb-4"
                />
              )}
              <div className="inline-block w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
              <p className="text-white font-medium">Verifying cleanup...</p>
              <p className="text-slate-400 text-sm mt-1">
                Comparing background landmarks
              </p>
            </div>
          )}

          {step === STEPS.SUCCESS && verification && (
  <div>
    {previewUrl && (
      <img
        src={previewUrl}
        alt="after"
        className="rounded-lg w-full max-h-64 object-cover mb-4"
      />
    )}
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-4">
      <p className="text-emerald-400 font-semibold mb-1">
        ✅ Cleanup verified · +{report.bounty_tokens} tokens
      </p>
      <p className="text-xs text-slate-400 mb-2">
        {verification.reasoning}
      </p>
      {gpsCheck?.distance_m != null && (
        <p className="text-xs text-slate-500">
          📍 GPS: {gpsCheck.distance_m}m from reported site (within 50m limit)
        </p>
      )}
    </div>
    <button
      onClick={onClose}
      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition"
    >
      Done
    </button>
  </div>
)}

          {step === STEPS.FAILED && (
  <div className="text-center py-4">
    <div className="text-4xl mb-3">❌</div>
    <p className="text-white font-medium mb-2">Verification failed</p>
    <p className="text-slate-400 text-sm mb-2">
      {verification?.reasoning ||
        "Could not confirm this is the same location."}
    </p>
    {gpsCheck?.passed === false && gpsCheck.distance_m != null && (
      <p className="text-xs text-red-400 mb-4">
        📍 GPS distance: {gpsCheck.distance_m}m (limit: 50m)
      </p>
    )}
    <button
      onClick={() => setStep(STEPS.PICK)}
      className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2 rounded-lg transition"
    >
      Try again
    </button>
  </div>
)}

          {step === STEPS.ERROR && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-white font-medium mb-2">Something went wrong</p>
              <p className="text-slate-400 text-sm mb-4">{error}</p>
              <button
                onClick={() => setStep(STEPS.PICK)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2 rounded-lg transition"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}