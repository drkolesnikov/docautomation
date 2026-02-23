/** Three-dot bouncing animation used as a streaming-in-progress indicator. */
export default function BouncingDots() {
  return (
    <span className="flex gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/60 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/60 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/60 animate-bounce [animation-delay:300ms]" />
    </span>
  );
}
