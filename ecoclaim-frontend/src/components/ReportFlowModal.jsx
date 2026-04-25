import { useState, useRef } from "react";
import { fileToDataUrl, getCurrentPosition, downscaleImage } from "../lib/imageCapture";
import { formatKg } from "../lib/api";
const STEPS = {
  PICK: "pick",
  ANALYZING: "analyzing",
  RESULT: "result",
  ERROR: "error",
};

export default function ReportFlowModal({ onClose, onSubmit }) {
  const [step, setStep] = useState(STEPS.PICK);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [coords, setCoords] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

 const handleFile = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setError("");
  setStep(STEPS.ANALYZING);

  try {
    const [preview, downscaled, position] = await Promise.all([
      fileToDataUrl(file),
      downscaleImage(file),
      getCurrentPosition().catch(() => null),
    ]);
    setPreviewUrl(preview);
    setImageData(downscaled);
    const finalCoords = position || { lat: 43.8356, lng: 25.9657 };
    setCoords(finalCoords);

    const result = await onSubmit({
      image: downscaled,
      lat: finalCoords.lat,
      lng: finalCoords.lng,
    });

    setAnalysis(result);
    setStep(STEPS.RESULT);
  } catch (err) {
    // Special-case the "not a dump" rejection
    if (err.detail?.error === "not_a_dump") {
      setError(
        err.detail.description
          ? `AI says: "${err.detail.description}". Try a clearer photo of waste.`
          : "AI did not detect illegal dumping in this photo."
      );
    } else {
      setError(err.message || "Something went wrong");
    }
    setStep(STEPS.ERROR);
  }
};

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000] p-4"
      onClick={step !== STEPS.ANALYZING ? onClose : undefined}
    >
      <div
        className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Report a dump</h3>
          {step !== STEPS.ANALYZING && (
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
              <div className="bg-slate-900 rounded-lg h-48 flex items-center justify-center text-slate-500 text-sm mb-4">
                No photo selected
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Take or upload a photo of an illegal dump. We'll capture your
                location and let our AI analyze it.
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
                📷 Choose photo
              </button>
            </div>
          )}

          {step === STEPS.ANALYZING && (
            <div className="text-center py-8">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="preview"
                  className="rounded-lg max-h-48 mx-auto mb-4"
                />
              )}
              <div className="inline-block w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
              <p className="text-white font-medium">Analyzing photo...</p>
              <p className="text-slate-400 text-sm mt-1">
                Saving and assessing hazard
              </p>
            </div>
          )}

          {step === STEPS.RESULT && analysis && (
            <div>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="captured"
                  className="rounded-lg w-full max-h-64 object-cover mb-4"
                />
              )}
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-sm">Hazard score</span>
                  <span className="text-white font-bold">
                    {analysis.hazard_score}/10
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-sm">Estimated volume</span>
                  <span className="text-white font-bold">
                    {formatKg(analysis.estimated_volume_kg)} kg
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-sm">Bounty</span>
                  <span className="text-emerald-400 font-bold">
                    {analysis.bounty_tokens} tokens
                  </span>
                </div>
                {analysis.waste_types?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {analysis.waste_types.map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-3 italic">
                  {analysis.description}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition"
              >
                Done
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