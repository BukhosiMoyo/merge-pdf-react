import { useEffect, useState } from "react";
import ReviewModal from "../components/ReviewModal";
import { useReviewPromptController } from "../hooks/useReviewPrompt";

// …your existing imports for the tool…

export default function Home() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const { shouldOpenNow, markSubmitted } = useReviewPromptController();

  // Show once when landing (if allowed by rule)
  useEffect(() => {
    if (shouldOpenNow()) setReviewOpen(true);
  }, []);

  // Call this after a successful compression as well
  const onCompressionSuccess = () => {
    // …your existing success code…
    if (shouldOpenNow()) setReviewOpen(true);
  };

  const handleSubmitRating = async (stars) => {
    // Persist locally so we don’t nag within a day
    markSubmitted(stars);

    // (Optional) send to backend for aggregation later:
    // await fetch(`${import.meta.env.VITE_API_BASE}/v1/ratings`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ stars }),
    // });

    setReviewOpen(false);
  };

  return (
    <>
      {/* your existing header + tool UI … */}
      {/* Example: pass onCompressionSuccess to wherever your "compression completed" callback is */}
      {/* <Uploader onCompleted={onCompressionSuccess} /> */}

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={handleSubmitRating}
      />
    </>
  );
}
