"use client";
import { useEffect, useState, useRef, Dispatch, SetStateAction } from "react";
import { useCompletion } from "@ai-sdk/react";
import { useASR } from "@/hooks/use-asr";
import {
  Mic,
  Send,
  Copy,
  FileVolume2,
  Sparkles,
  FileUp,
  FileText,
} from "lucide-react";

interface TextLLM {
  old: string;
  new: string;
}

export default function Creation() {
  const [displayStatus, setDisplayStatus] = useState<"write" | "export">(
    "write"
  );
  const [textLLM, setTextLLM] = useState<TextLLM>({
    old: "",
    new: "",
  });

  if (displayStatus === "write")
    return (
      <>
        <button onClick={() => setDisplayStatus("export")}>
          <FileUp />
        </button>
        <Write textLLM={textLLM} setTextLLM={setTextLLM} />
      </>
    );
  else
    return (
      <>
        <button onClick={() => setDisplayStatus("write")}>
          <FileText />
        </button>
        <Export textLLM={textLLM} />
      </>
    );
}

function Write({
  textLLM,
  setTextLLM,
}: {
  textLLM: TextLLM;
  setTextLLM: Dispatch<SetStateAction<TextLLM>>;
}) {
  const [isDisplayLLM, setIsDisplayLLM] = useState<boolean>(true);

  const oldTextLLMRef = useRef<string>("");

  const { transcript, asrStatus, error, startRecording, stopRecording } =
    useASR();
  const { completion, input, setInput, handleSubmit, isLoading } =
    useCompletion({
      api: process.env.NEXT_PUBLIC_API_URL + "/llm/completion",
      onFinish: (_: string, completion: string) => {
        setTextLLM({
          old: oldTextLLMRef.current,
          new: completion.slice(10, -11),
        });
      },
    });

  useEffect(() => {
    if (error) {
      console.error("ASR Error:", error);
    }
  }, [error]);

  return (
    <div className="grid grid-rows-[1fr_20px] items-center justify-items-center min-h-screen min-w-screen p-8 pb-20 gap-24 ">
      <main className="gap-16 w-full h-4/5">
        <button onClick={() => setIsDisplayLLM(!isDisplayLLM)}>
          {isDisplayLLM ? <FileVolume2 /> : <Sparkles />}
        </button>
        {isDisplayLLM ? (
          <div>
            <div className="flex items-center gap-2">
              <h2>Text after LLM</h2>
              <CopyButton
                text={
                  !isLoading || asrStatus === "recording"
                    ? textLLM.new
                    : completion.slice(10)
                }
              />
            </div>
            <p className="border border-gray-300 rounded-md w-full h-56 resize-none overflow-auto">
              {!isLoading || asrStatus === "recording"
                ? textLLM.new
                : completion.slice(10)}
            </p>
            {textLLM.old && (
              <>
                <h2>Old text from LLM</h2>
                <p className="border border-gray-300 rounded-md w-full h-56 resize-none overflow-auto">
                  {textLLM.old}
                </p>
              </>
            )}
          </div>
        ) : (
          <div>
            <h2>Speech to Text</h2>
            <p className="border border-gray-300 rounded-md w-full h-56 resize-none overflow-auto">
              {transcript}
            </p>
          </div>
        )}
      </main>

      {asrStatus === "recording" ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input type="hidden" name="prompt" value={input} />
          <button
            type="submit"
            onClick={() => {
              // asrStatus change will be delayed avoiding tsx state change issues.
              stopRecording();
              setInput(generateUserInput(oldTextLLMRef.current, transcript));
            }}
          >
            <Send className="w-16 h-16 text-blue-500" />
          </button>
        </form>
      ) : (
        <button
          onClick={() => {
            startRecording();
            oldTextLLMRef.current = textLLM.new;
            setTextLLM({ old: oldTextLLMRef.current, new: "" });
          }}
          disabled={isLoading}
        >
          <Mic
            className={`w-16 h-16 ${
              isLoading ? "text-gray-600" : "text-green-500"
            }`}
          />
        </button>
      )}
    </div>
  );
}

function Export({ textLLM }: { textLLM: TextLLM }) {
  const targetLanguageRef = useRef<"english" | "spanish">("english");
  const { completion, input, setInput, handleSubmit, isLoading } =
    useCompletion({
      api: process.env.NEXT_PUBLIC_API_URL + "/llm/translate",
    });

  const translatedText = isLoading ? completion.slice(11) : completion.slice(11, -12);

  return (
    <div>
      <select
        name="select"
        className="border-purple-600 border rounded-md p-1"
        onChange={(e) => {
          targetLanguageRef.current = e.currentTarget.value as
            | "english"
            | "spanish";
        }}
      >
        <option value="english">English</option>
        <option value="spanish">Spanish</option>
      </select>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="original-text" value={input} />
        <button
          className="border-gray-300 border rounded-md p-1"
          type="submit"
          onClick={() => {
            setInput(
              generateTranslateInput(
                textLLM.new,
                targetLanguageRef.current
              )
            );
          }}
        >
          Translate
        </button>
      </form>

      <h2>Original text</h2>
      <p className="border border-gray-300 rounded-md w-full h-56 resize-none overflow-auto">
        {textLLM.new}
      </p>
      <h2>Translated text</h2>
      <CopyButton text={translatedText} />
      <p className="border border-gray-300 rounded-md w-full h-56 resize-none overflow-auto">
        {translatedText}
      </p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
      }}
      className="p-1 hover:bg-gray-100 rounded"
    >
      <Copy className="w-4 h-4" />
    </button>
  );
}

function generateUserInput(oldText: string, transcript: string): string {
  return `<old_text>${oldText}</old_text><speech>${transcript}</speech>`;
}

function generateTranslateInput(text: string, target_language: string): string {
  return `<text>${text}</text><target_language>${target_language}</target_language>`;
}
