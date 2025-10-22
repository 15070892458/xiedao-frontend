"use client";
import { useEffect, useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { useASR } from "@/hooks/use-asr";
import { Mic, Send } from "lucide-react";

export default function Home() {
  const [textLLM, setTextLLM] = useState<string>("");

  const { transcript, asrStatus, error, startRecording, stopRecording } =
    useASR();
  const { completion, input, setInput, handleSubmit, isLoading } =
    useCompletion({
      api: process.env.NEXT_PUBLIC_API_URL + "/llm/completion",
      onFinish: (_: string, completion: string) => {
        setTextLLM(completion);
      },
    });

  useEffect(() => {
    if (error) {
      console.error("ASR Error:", error);
    }
  }, [error]);

  return (
    <div className="grid grid-rows-[1fr_20px] items-center justify-items-center min-h-screen min-w-screen p-8 pb-20 gap-24 ">
      <main className="grid grid-rows-[1fr_1fr] gap-16 w-full h-4/5">
        <div>
          <h2>Speech to Text</h2>
          <p className="border border-gray-300 rounded-md w-full h-56 resize-none overflow-auto">
            {transcript}
          </p>
        </div>
        <div>
          <h2>Text after LLM</h2>
          <p className="border border-gray-300 rounded-md w-full h-56 resize-none overflow-auto">
            {!isLoading || asrStatus === "recording"
              ? textLLM.slice(10, -11)
              : completion.slice(10)}
          </p>
        </div>
      </main>

      <div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input type="hidden" name="prompt" value={input} />

          {asrStatus === "recording" ? (
            <button
              type="submit"
              onClick={() => {
                // asrStatus change will be delayed avoiding tsx state change issues.
                stopRecording();
                setInput(generateUserInput(textLLM.slice(10, -11), transcript));
              }}
            >
              <Send className="w-16 h-16 text-blue-500" />
            </button>
          ) : (
            <button type="button" onClick={startRecording} disabled={isLoading}>
              <Mic
                className={`w-16 h-16 ${
                  isLoading ? "text-gray-600" : "text-green-500"
                }`}
              />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function generateUserInput(oldText: string, transcript: string): string {
  return `<old_text>${oldText}</old_text><speech>${transcript}</speech>`;
}